package dashboard

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/kirito99152/ProxyManager/internal/config"
	"github.com/kirito99152/ProxyManager/internal/db"
	"github.com/kirito99152/ProxyManager/internal/models"
)

type DashboardHandler struct {
	database *db.DB
}

func NewDashboardHandler(database *db.DB) *DashboardHandler {
	return &DashboardHandler{database: database}
}

// --- Agent Handlers ---

func (h *DashboardHandler) GetAgents(c *gin.Context) {
	var agents []models.Agent
	err := h.database.Select(&agents, "SELECT * FROM agents")
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
		c.JSON(http.StatusNotFound, gin.H{"error": "Agent not found"})
		return
	}
	c.JSON(http.StatusOK, agent)
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

	result, err := h.database.NamedExec(`INSERT INTO proxies (agent_id, name, proxy_type, local_port, remote_port, custom_domain, status) 
		VALUES (:agent_id, :name, :proxy_type, :local_port, :remote_port, :custom_domain, :status)`, &proxy)
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
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid proxy ID"})
		return
	}

	var proxy models.Proxy
	if err := c.ShouldBindJSON(&proxy); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	proxy.ID = id

	_, err = h.database.NamedExec(`UPDATE proxies SET name=:name, proxy_type=:proxy_type, local_port=:local_port, 
		remote_port=:remote_port, custom_domain=:custom_domain, status=:status WHERE id=:id`, &proxy)
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

// --- FRPS Config Handlers ---

func (h *DashboardHandler) GetFrpsConfig(c *gin.Context) {
	cfg, err := config.GetFrpsConfig()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read config"})
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update config"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Config updated and service reloaded"})
}

// --- Statistics Handlers (Milestone 2) ---

func (h *DashboardHandler) GetHardwareHistory(c *gin.Context) {
	agentID := c.Param("id")
	var history []models.HardwareLog
	// Fetch last 60 minutes of hardware stats
	err := h.database.Select(&history, "SELECT * FROM hardware_logs WHERE agent_id = ? ORDER BY created_at DESC LIMIT 60", agentID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch hardware history"})
		return
	}
	c.JSON(http.StatusOK, history)
}

func (h *DashboardHandler) GetTotalTraffic(c *gin.Context) {
	// Parse from FRPS log logic (simplified for Milestone 2, normally read /var/log/frps.log or FRP metrics dashboard)
	// Alternatively, query the local hardware logs for network rx/tx sum
	var totalRX, totalTX uint64
	err := h.database.QueryRow("SELECT COALESCE(SUM(network_rx), 0), COALESCE(SUM(network_tx), 0) FROM hardware_logs").Scan(&totalRX, &totalTX)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to calculate total traffic"})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"total_rx": totalRX,
		"total_tx": totalTX,
	})
}

// --- Install Script Handler ---

func (h *DashboardHandler) GetInstallScript(c *gin.Context) {
	scriptContent := "#!/bin/bash\necho 'Install script will be provided by Agent #4'\n"
	c.String(http.StatusOK, scriptContent)
}
