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
	defaultAdminPassword = "admin123"
	legacyAdminHash      = "$2a$10$wTfH.d./k2vBInI3n7M0.eCq0L07H5mF4D9hVb5l3FhZ4D5X/r4T6"
	currentAdminHash     = "$2a$10$58Hpa.34o.70uQyvgDRJ1uXSVo6LDVVl4JEcgs/Nh1zr5DHoAFRcG"
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

	if err := ensureDefaultAdmin(db.DB); err != nil {
		return nil, fmt.Errorf("failed to ensure default admin: %w", err)
	}

	log.Println("Database connection established")
	return &DB{db}, nil
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
			"INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'admin')",
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

	if !existingHash.Valid || existingHash.String == "" || existingHash.String == legacyAdminHash {
		if _, err := db.Exec(
			"UPDATE users SET password_hash = ?, role = 'admin' WHERE username = ?",
			currentAdminHash,
			defaultAdminUsername,
		); err != nil {
			return err
		}
		log.Printf("Repaired default admin credentials for %q", defaultAdminUsername)
	}

	return nil
}
