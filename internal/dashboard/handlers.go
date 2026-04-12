package dashboard

import (
	"database/sql"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/kirito99152/ProxyManager/internal/api"
	"github.com/kirito99152/ProxyManager/internal/config"
	"github.com/kirito99152/ProxyManager/internal/db"
	"github.com/kirito99152/ProxyManager/internal/models"
)

// Re-combining all handler logic into one file after git reset
type DashboardHandler struct {
	database   *db.DB
	apiHandler *api.Handler
}

func NewDashboardHandler(database *db.DB, apiHandler *api.Handler) *DashboardHandler {
	return &DashboardHandler{database: database, apiHandler: apiHandler}
}

// --- Agent Handlers ---

func (h *DashboardHandler) GetAgents(c *gin.Context) {
	var agents []models.Agent
	err := h.database.Select(&agents, "SELECT * FROM agents ORDER BY last_heartbeat DESC")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch agents"})
		return
	}
	c.JSON(http.StatusOK, agents)
}

func (h *DashboardHandler) GetAgentByID(c *gin.Context) {
	id := c.Param("id")
	var agent models.Agent
	err := h.database.Get(&agent, "SELECT * FROM agents WHERE id = ?", id)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Agent not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		}
		return
	}
	c.JSON(http.StatusOK, agent)
}

func (h *DashboardHandler) ExecuteCommand(c *gin.Context) {
	agentID := c.Param("id")
	var req struct {
		Command string `json:"command" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid payload"})
		return
	}

	// Use the shared apiHandler to send a command
	err := h.apiHandler.SendCommand(agentID, "EXEC", req.Command)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send command to agent: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Command queued for execution"})
}


// --- Proxy Handlers ---

func (h *DashboardHandler) GetProxiesForAgent(c *gin.Context) {
	agentID := c.Param("id")
	var proxies []models.Proxy
	err := h.database.Select(&proxies, "SELECT * FROM proxies WHERE agent_id = ?", agentID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch proxies"})
		return
	}
	c.JSON(http.StatusOK, proxies)
}

func (h *DashboardHandler) CreateProxy(c *gin.Context) {
	var proxy models.Proxy
	if err := c.ShouldBindJSON(&proxy); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	result, err := h.database.NamedExec("INSERT INTO proxies (agent_id, name, proxy_type, local_port, remote_port, custom_domain, status) VALUES (:agent_id, :name, :proxy_type, :local_port, :remote_port, :custom_domain, :status)", &proxy)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create proxy"})
		return
	}
	id, _ := result.LastInsertId()
	proxy.ID = int(id)
	c.JSON(http.StatusCreated, proxy)
}

func (h *DashboardHandler) UpdateProxy(c *gin.Context) {
	idStr := c.Param("id")
	id, _ := strconv.Atoi(idStr)
	var proxy models.Proxy
	if err := c.ShouldBindJSON(&proxy); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	proxy.ID = id
	_, err := h.database.NamedExec("UPDATE proxies SET name=:name, proxy_type=:proxy_type, local_port=:local_port, remote_port=:remote_port, custom_domain=:custom_domain, status=:status WHERE id=:id", &proxy)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update proxy"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Proxy updated successfully"})
}

func (h *DashboardHandler) DeleteProxy(c *gin.Context) {
	id := c.Param("id")
	_, err := h.database.Exec("DELETE FROM proxies WHERE id = ?", id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete proxy"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Proxy deleted successfully"})
}

// --- FRPS & Settings Handlers ---

func (h *DashboardHandler) GetFrpsConfig(c *gin.Context) {
	cfg, err := config.GetFrpsConfig()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read FRPS config"})
		return
	}
	c.JSON(http.StatusOK, cfg)
}

func (h *DashboardHandler) UpdateFrpsConfig(c *gin.Context) {
	var cfg map[string]interface{}
	if err := c.ShouldBindJSON(&cfg); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON payload"})
		return
	}
	if err := config.UpdateFrpsConfig(cfg); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update FRPS config"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "FRPS config updated and service reloaded"})
}

func (h *DashboardHandler) GetFrpsStatus(c *gin.Context) {
	// info, err := frp.GetServerInfo()
	// if err != nil {
	// 	c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get FRPS server info", "details": err.Error()})
	// 	return
	// }
	// tcp, _ := frp.GetProxies("tcp")
	// http, _ := frp.GetProxies("http")
	// c.JSON(http.StatusOK, gin.H{"server_info": info, "tcp_proxies": tcp, "http_proxies": http})
	c.JSON(http.StatusNotImplemented, gin.H{"message": "Not implemented due to missing internal/frp package"})
}


type SettingPayload struct {
	Key   string `json:"key" binding:"required"`
	Value string `json:"value"`
}

func (h *DashboardHandler) GetSettings(c *gin.Context) {
	var settings []map[string]interface{}
	rows, err := h.database.Queryx("SELECT `key`, `value` FROM settings")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch settings"})
		return
	}
	defer rows.Close()
	for rows.Next() {
		result := make(map[string]interface{})
		rows.MapScan(result)
		if b, ok := result["value"].([]byte); ok {
			result["value"] = string(b)
		}
		settings = append(settings, result)
	}
	c.JSON(http.StatusOK, settings)
}

func (h *DashboardHandler) UpdateSetting(c *gin.Context) {
	var payload SettingPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	_, err := h.database.Exec("INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)", payload.Key, payload.Value)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update setting"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Setting updated"})
}

// --- Statistics & Logs Handlers ---

func (h *DashboardHandler) GetHardwareHistory(c *gin.Context) {
	agentID := c.Param("id")
	var history []models.HardwareLog
	err := h.database.Select(&history, "SELECT * FROM hardware_logs WHERE agent_id = ? ORDER BY created_at DESC LIMIT 60", agentID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch hardware history"})
		return
	}
	c.JSON(http.StatusOK, history)
}

func (h *DashboardHandler) GetTotalTraffic(c *gin.Context) {
	var totalRX, totalTX uint64
	err := h.database.QueryRow("SELECT COALESCE(SUM(network_rx), 0), COALESCE(SUM(network_tx), 0) FROM hardware_logs").Scan(&totalRX, &totalTX)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to calculate total traffic"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"total_rx": totalRX, "total_tx": totalTX})
}

func (h *DashboardHandler) GetLogs(c *gin.Context) {
	agentID := c.Query("agent_id")
	limit := c.DefaultQuery("limit", "100")
	query := "SELECT * FROM agent_logs"
	var args []interface{}
	if agentID != "" {
		query += " WHERE agent_id = ?"
		args = append(args, agentID)
	}
	query += " ORDER BY timestamp DESC LIMIT ?"
	args = append(args, limit)
	var logs []map[string]interface{}
	rows, err := h.database.Queryx(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch logs"})
		return
	}
	defer rows.Close()
	for rows.Next() {
		result := make(map[string]interface{})
		rows.MapScan(result)
		for k, v := range result {
			if b, ok := v.([]byte); ok {
				result[k] = string(b)
			}
		}
		logs = append(logs, result)
	}
	c.JSON(http.StatusOK, logs)
}


// --- Install Script Handler ---

func (h *DashboardHandler) GetInstallScript(c *gin.Context) {
	scriptContent := `#!/bin/bash
echo 'Install script will be provided by Agent #4'
`
	c.String(http.StatusOK, scriptContent)
}
