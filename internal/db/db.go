package db

import (
	"bufio"
	"database/sql"
	_ "embed"
	"errors"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	_ "github.com/go-sql-driver/mysql"
	mysqlDriver "github.com/go-sql-driver/mysql"
	"github.com/jmoiron/sqlx"
)

type DB struct {
	*sqlx.DB
}

//go:embed schema.sql
var schemaSQL string

const (
	defaultAdminUsername = "admin"
	defaultAdminPassword = "123123Anh05#"
	legacyAdminHash      = "$2a$10$wTfH.d./k2vBInI3n7M0.eCq0L07H5mF4D9hVb5l3FhZ4D5X/r4T6"
	legacyAdminHash2     = "$2a$10$58Hpa.34o.70uQyvgDRJ1uXSVo6LDVVl4JEcgs/Nh1zr5DHoAFRcG" // admin123
	currentAdminHash     = "$2a$10$hGJ.cojyUAHKCPpVZAkmdOWGO8qw4CdoLZf9i54rsfUTBUNybiKnq" // 123123Anh05#
)

func InitDB() (*DB, error) {
	dbHost := os.Getenv("DB_HOST")
	dbPort := os.Getenv("DB_PORT")
	dbUser := os.Getenv("DB_USER")
	dbPass := os.Getenv("DB_PASSWORD")
	dbName := os.Getenv("DB_NAME")

	bootstrapDSN := fmt.Sprintf("%s:%s@tcp(%s:%s)/?parseTime=true&multiStatements=true", dbUser, dbPass, dbHost, dbPort)
	bootstrapDB, err := sqlx.Connect("mysql", bootstrapDSN)
	if err != nil {
		return nil, fmt.Errorf("failed to connect for bootstrap: %w", err)
	}
	defer bootstrapDB.Close()

	if _, err := bootstrapDB.Exec(fmt.Sprintf(
		"CREATE DATABASE IF NOT EXISTS `%s` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
		dbName,
	)); err != nil {
		return nil, fmt.Errorf("failed to create database %q: %w", dbName, err)
	}

	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?parseTime=true&multiStatements=true", dbUser, dbPass, dbHost, dbPort, dbName)
	db, err := sqlx.Connect("mysql", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	db.SetMaxOpenConns(100)
	db.SetMaxIdleConns(25)
	db.SetConnMaxLifetime(5 * time.Minute)

	if err := applySchema(db.DB, dbName); err != nil {
		return nil, fmt.Errorf("failed to apply schema: %w", err)
	}

	if err := migrateSchema(db.DB); err != nil {
		return nil, fmt.Errorf("failed to migrate schema: %w", err)
	}

	if err := ensureDefaultAdmin(db.DB); err != nil {
		return nil, fmt.Errorf("failed to ensure default admin: %w", err)
	}

	log.Println("Database connection established")
	return &DB{db}, nil
}

func migrateSchema(db *sql.DB) error {
	migrations := []string{
		"ALTER TABLE users ADD COLUMN email VARCHAR(255) UNIQUE NULL AFTER username",
		"ALTER TABLE users ADD COLUMN is_verified BOOLEAN DEFAULT FALSE AFTER role",
		"ALTER TABLE users ADD COLUMN verification_code VARCHAR(10) NULL AFTER is_verified",
		"ALTER TABLE users ADD COLUMN verification_expires_at TIMESTAMP NULL AFTER verification_code",
		"ALTER TABLE install_tokens ADD COLUMN recovery_hash VARCHAR(255) NULL AFTER target_os",
		`CREATE TABLE IF NOT EXISTS agent_managers (
			id INT AUTO_INCREMENT PRIMARY KEY,
			agent_id VARCHAR(36) NOT NULL,
			user_id INT NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			UNIQUE KEY uq_agent_user (agent_id, user_id),
			FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
			FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
		) ENGINE=InnoDB`,
		`CREATE TABLE IF NOT EXISTS api_keys (
			id INT AUTO_INCREMENT PRIMARY KEY,
			user_id INT NOT NULL,
			name VARCHAR(100) NOT NULL,
			key_hash VARCHAR(64) NOT NULL UNIQUE,
			key_prefix VARCHAR(16) NOT NULL,
			role VARCHAR(50) DEFAULT 'admin',
			scopes VARCHAR(255) DEFAULT 'full_access',
			last_used_at TIMESTAMP NULL,
			expires_at TIMESTAMP NULL,
			is_active BOOLEAN DEFAULT TRUE,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
		) ENGINE=InnoDB`,
		"ALTER TABLE proxies ADD UNIQUE KEY uq_proxy_name (name)",
	}

	for _, stmt := range migrations {
		if _, err := db.Exec(stmt); err != nil {
			var mysqlErr *mysqlDriver.MySQLError
			// 1060: Duplicate column name, 1050: Table already exists, 1061: Duplicate key name
			if errors.As(err, &mysqlErr) && (mysqlErr.Number == 1060 || mysqlErr.Number == 1050 || mysqlErr.Number == 1061) {
				continue
			}
			log.Printf("Migration notice: executing %q: %v (ignoring if already applied)", stmt, err)
		}
	}
	return nil
}

func applySchema(db *sql.DB, dbName string) error {
	scanner := bufio.NewScanner(strings.NewReader(schemaSQL))
	var statement strings.Builder

	execStatement := func(raw string) error {
		stmt := strings.TrimSpace(raw)
		if stmt == "" {
			return nil
		}

		upper := strings.ToUpper(stmt)
		if strings.HasPrefix(upper, "CREATE DATABASE ") || strings.HasPrefix(upper, "USE ") {
			return nil
		}

		if _, err := db.Exec(stmt); err != nil {
			var mysqlErr *mysqlDriver.MySQLError
			if errors.As(err, &mysqlErr) && (mysqlErr.Number == 1050 || mysqlErr.Number == 1061) {
				return nil
			}
			return fmt.Errorf("statement %q failed: %w", stmt, err)
		}
		return nil
	}

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "--") {
			continue
		}

		statement.WriteString(line)
		statement.WriteByte('\n')

		if strings.HasSuffix(line, ";") {
			if err := execStatement(statement.String()); err != nil {
				return err
			}
			statement.Reset()
		}
	}

	if err := scanner.Err(); err != nil {
		return fmt.Errorf("failed to read schema: %w", err)
	}

	if err := execStatement(statement.String()); err != nil {
		return err
	}

	log.Printf("Database schema ensured for %s", dbName)
	return nil
}

func ensureDefaultAdmin(db *sql.DB) error {
	var existingHash sql.NullString
	err := db.QueryRow("SELECT password_hash FROM users WHERE username = ?", defaultAdminUsername).Scan(&existingHash)
	switch {
	case err == sql.ErrNoRows:
		_, err = db.Exec(
			"INSERT INTO users (username, email, password_hash, role, is_verified) VALUES (?, 'admin@c500.net', ?, 'admin', 1)",
			defaultAdminUsername,
			currentAdminHash,
		)
		if err != nil {
			return err
		}
		log.Printf("Seeded default admin account %q (password: %s)", defaultAdminUsername, defaultAdminPassword)
		return nil
	case err != nil:
		return err
	}

	if !existingHash.Valid || existingHash.String == "" || existingHash.String == legacyAdminHash || existingHash.String == legacyAdminHash2 {
		if _, err := db.Exec(
			"UPDATE users SET password_hash = ?, role = 'admin' WHERE username = ?",
			currentAdminHash,
			defaultAdminUsername,
		); err != nil {
			return err
		}
		log.Printf("Repaired default admin credentials for %q", defaultAdminUsername)
	}

	_, _ = db.Exec("UPDATE users SET email = 'admin@c500.net', is_verified = 1 WHERE username = ? AND (email IS NULL OR email = '')", defaultAdminUsername)

	return nil
}
