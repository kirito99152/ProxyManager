package dashboard

import (
	"github.com/kirito99152/ProxyManager/internal/hub"
	"log"
	"time"

	"github.com/kirito99152/ProxyManager/internal/db"
	"github.com/kirito99152/ProxyManager/internal/models"
)

// StartAgentMonitor periodically checks for agents that haven't sent a heartbeat
// and marks them as offline, broadcasting the change to the dashboard.
func StartAgentMonitor(database *db.DB) {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	log.Println("Started Agent Monitor (Offline Detection)")

	for range ticker.C {
		// Find agents online but whose last heartbeat was > 30 seconds ago
		query := "SELECT * FROM agents WHERE status = 'online' AND last_heartbeat < (NOW() - INTERVAL 30 SECOND)"
		
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

			// Broadcast offline status to WebSocket
			payload := map[string]interface{}{
				"agent_id": agent.ID,
				"status":   "offline",
			}
			hub.BroadcastMessage("agent_status", payload)
		}
	}
}
