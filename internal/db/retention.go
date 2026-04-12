package db

import (
	"log"
	"time"
)

// StartRetentionPolicy runs a background job to delete old logs.
func StartRetentionPolicy(db *DB) {
	log.Println("Starting Data Retention Policy Worker (runs daily)")
	// Ticker to run once every 24 hours
	ticker := time.NewTicker(24 * time.Hour)
	defer ticker.Stop()

	// Run once on startup, then daily
	cleanup(db)

	for range ticker.C {
		cleanup(db)
	}
}

func cleanup(db *DB) {
	log.Println("Running daily log cleanup...")

	// Delete agent logs older than 7 days
	resAgent, err := db.Exec("DELETE FROM agent_logs WHERE timestamp < (NOW() - INTERVAL 7 DAY)")
	if err != nil {
		log.Printf("Error cleaning up agent_logs: %v", err)
	} else {
		rows, _ := resAgent.RowsAffected()
		log.Printf("Cleaned up %d old records from agent_logs", rows)
	}

	// Delete hardware logs older than 7 days
	resHardware, err := db.Exec("DELETE FROM hardware_logs WHERE created_at < (NOW() - INTERVAL 7 DAY)")
	if err != nil {
		log.Printf("Error cleaning up hardware_logs: %v", err)
	} else {
		rows, _ := resHardware.RowsAffected()
		log.Printf("Cleaned up %d old records from hardware_logs", rows)
	}
}
