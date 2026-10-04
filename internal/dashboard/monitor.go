package dashboard

import (
	"fmt"
	"log"
	"time"

	"github.com/kirito99152/ProxyManager/internal/db"
	"github.com/kirito99152/ProxyManager/internal/hub"
	"github.com/kirito99152/ProxyManager/internal/mailer"
	"github.com/kirito99152/ProxyManager/internal/models"
)

// StartAgentMonitor periodically checks for agents that haven't sent a heartbeat
// and marks them as offline, broadcasting the change to the dashboard and sending alert emails.
func StartAgentMonitor(database *db.DB, alertManager *mailer.AlertManager) {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	log.Println("Started Agent Monitor (Offline Detection)")

	for range ticker.C {
		timeoutSec := 30
		if alertManager != nil {
			timeoutSec = alertManager.GetSettingInt("alert_offline_timeout_seconds", 30)
		}

		// Find agents online but whose last heartbeat was > timeoutSec ago
		query := fmt.Sprintf("SELECT * FROM agents WHERE status = 'online' AND last_heartbeat < (NOW() - INTERVAL %d SECOND)", timeoutSec)
		
		var staleAgents []models.Agent
		err := database.Select(&staleAgents, query)
		if err != nil {
			log.Printf("Error checking for stale agents: %v", err)
			continue
		}

		for _, agent := range staleAgents {
			log.Printf("Agent %s (%s) went offline (heartbeat timeout)", agent.Hostname, agent.ID)
			
			// Update status in DB
			_, err := database.Exec("UPDATE agents SET status = 'offline' WHERE id = ?", agent.ID)
			if err != nil {
				log.Printf("Failed to update agent %s status to offline: %v", agent.ID, err)
				continue
			}

			// Trigger offline alert email
			if alertManager != nil {
				alertManager.TriggerOfflineAlert(agent)
			}

			// Broadcast offline status to WebSocket
			payload := map[string]interface{}{
				"agent_id": agent.ID,
				"status":   "offline",
			}
			hub.BroadcastMessage("agent_status", payload)
		}
	}
}

