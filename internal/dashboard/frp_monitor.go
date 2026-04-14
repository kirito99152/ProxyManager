package dashboard

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/kirito99152/ProxyManager/internal/config"
	"github.com/kirito99152/ProxyManager/internal/db"
)

// StartFrpsMonitor periodically fetches proxy status from the local FRPS API
// and updates the 'proxies' table in the database.
func StartFrpsMonitor(database *db.DB) {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	log.Println("Started FRPS Status Monitor (Tunnel Detection)")

	for range ticker.C {
		activeProxies := make(map[string]bool)
		proxyTypes := []string{"tcp", "udp", "http", "https"}

		for _, pType := range proxyTypes {
			stats, err := fetchFrpsStatusByType(pType)
			if err != nil {
				continue
			}

			if proxies, ok := stats["proxies"].([]interface{}); ok {
				for _, p := range proxies {
					if m, ok := p.(map[string]interface{}); ok {
						if name, ok := m["name"].(string); ok {
							// In modern FRP, status is often included in the proxy info
							if status, ok := m["status"].(string); ok && status == "online" {
								activeProxies[name] = true
							}
						}
					}
				}
			}
		}

		// Update all proxies in DB: set 'offline' if not found or not online in FRPS
		// Note: We only update proxies that are supposed to be 'active' in our UI
		_, err := database.Exec("UPDATE proxies SET status = 'offline' WHERE status != 'inactive' AND status != 'online'")
		if err != nil {
			log.Printf("Monitor Error: Failed to reset proxy status: %v", err)
			continue
		}

		for name := range activeProxies {
			_, err = database.Exec("UPDATE proxies SET status = 'online' WHERE name = ? AND status != 'inactive'", name)
			if err != nil {
				log.Printf("Monitor Error: Failed to update status for %s: %v", name, err)
			}
		}
	}
}

func fetchFrpsStatusByType(proxyType string) (map[string]interface{}, error) {
	cfg, err := config.GetFrpsConfig()
	if err != nil {
		return nil, err
	}

	dashboardPort := "7501"
	user := "admin"
	password := ""

	if webServer, ok := cfg["webServer"].(map[string]interface{}); ok {
		if p, ok := webServer["port"].(int); ok {
			dashboardPort = fmt.Sprintf("%d", p)
		}
		if u, ok := webServer["user"].(string); ok {
			user = u
		}
		if pwd, ok := webServer["password"].(string); ok {
			password = pwd
		}
	}

	client := &http.Client{Timeout: 2 * time.Second}
	// Modern FRP API (0.64.0+) uses separate endpoints for each proxy type
	url := fmt.Sprintf("http://127.0.0.1:%s/api/proxy/%s", dashboardPort, proxyType)
	req, _ := http.NewRequest("GET", url, nil)
	req.SetBasicAuth(user, password)

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("FRP API returned status %d", resp.StatusCode)
	}

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return result, nil
}
