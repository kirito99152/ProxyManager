package dashboard

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/kirito99152/ProxyManager/internal/api"
	"github.com/kirito99152/ProxyManager/internal/config"
	"github.com/kirito99152/ProxyManager/internal/db"
	"github.com/kirito99152/ProxyManager/internal/models"
	psnet "github.com/shirou/gopsutil/v3/net"
	"github.com/shirou/gopsutil/v3/process"
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

func (h *DashboardHandler) UpdateAgent(c *gin.Context) {
	id := c.Param("id")
	var payload struct {
		Name string `json:"name" binding:"required"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	_, err := h.database.Exec("UPDATE agents SET name = ? WHERE id = ?", payload.Name, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update agent name"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Agent name updated successfully"})
}

func (h *DashboardHandler) UpgradeAgent(c *gin.Context) {
	agentID := c.Param("id")

	serverIP := os.Getenv("SERVER_IP")
	if serverIP == "" {
		serverIP = "localhost" // Fallback
	}

	dashboardPort := os.Getenv("DASHBOARD_PORT")
	if dashboardPort == "" {
		dashboardPort = "8000"
	}

	url := fmt.Sprintf("http://%s:%s/downloads/agent-linux-amd64", serverIP, dashboardPort)

	err := h.apiHandler.SendCommand(agentID, "UPGRADE_AGENT", url)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send upgrade command: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Upgrade command sent to agent"})
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

	// 1. Fetch the agent to get its hostname
	var agent models.Agent
	err := h.database.Get(&agent, "SELECT hostname FROM agents WHERE id = ?", proxy.AgentID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Agent not found"})
		return
	}

	// 2. Validate Proxy Name format: hostname_<user_input>
	expectedPrefix := agent.Hostname + "_"
	if !strings.HasPrefix(proxy.Name, expectedPrefix) {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Proxy name must start with '%s'", expectedPrefix)})
		return
	}
	suffix := strings.TrimPrefix(proxy.Name, expectedPrefix)
	if suffix == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Proxy name suffix cannot be empty"})
		return
	}
	// Regex for lowercase alphanumeric, no accents/spaces
	matched, _ := regexp.MatchString(`^[a-z0-9-]+$`, suffix)
	if !matched {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Proxy name suffix must be lowercase alphanumeric (can include hyphens, no spaces or accents)"})
		return
	}

	// 3. Ensure Proxy Name is unique globally
	var nameCount int
	err = h.database.Get(&nameCount, "SELECT COUNT(*) FROM proxies WHERE name = ?", proxy.Name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error checking name uniqueness"})
		return
	}
	if nameCount > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "Proxy name already exists"})
		return
	}

	// 4. Validation for Domain / Port Uniqueness
	if proxy.ProxyType == "http" || proxy.ProxyType == "https" {
		if proxy.CustomDomain == nil || *proxy.CustomDomain == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Custom domain is required for HTTP/HTTPS proxies"})
			return
		}

		var count int
		err := h.database.Get(&count, "SELECT COUNT(*) FROM proxies WHERE custom_domain = ?", proxy.CustomDomain)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error checking domain uniqueness"})
			return
		}
		if count > 0 {
			c.JSON(http.StatusConflict, gin.H{"error": "This domain is already in use"})
			return
		}
	} else if proxy.ProxyType == "tcp" || proxy.ProxyType == "udp" {
		if proxy.RemotePort == nil || *proxy.RemotePort == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Remote port is required for TCP/UDP proxies"})
			return
		}

		var count int
		err := h.database.Get(&count, "SELECT COUNT(*) FROM proxies WHERE remote_port = ?", proxy.RemotePort)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error checking port uniqueness"})
			return
		}
		if count > 0 {
			c.JSON(http.StatusConflict, gin.H{"error": "This remote port is already in use by another proxy"})
			return
		}

		// Validation: Ensure remote port is not physically listening on the ProxyManager Server
		connections, err := psnet.Connections("all")
		if err == nil {
			for _, conn := range connections {
				if conn.Status == "LISTEN" && conn.Laddr.Port == uint32(*proxy.RemotePort) {
					c.JSON(http.StatusConflict, gin.H{"error": "This remote port is already occupied by a system process on the server"})
					return
				}
			}
		}
	}

	if proxy.LocalIP == "" {
		proxy.LocalIP = "127.0.0.1"
	}

	result, err := h.database.NamedExec("INSERT INTO proxies (agent_id, name, proxy_type, local_ip, local_port, remote_port, custom_domain, status) VALUES (:agent_id, :name, :proxy_type, :local_ip, :local_port, :remote_port, :custom_domain, :status)", &proxy)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create proxy: " + err.Error()})
		return
	}
	id, _ := result.LastInsertId()
	proxy.ID = int(id)

	// Notify Agent to reload config
	go h.syncAgentFRPConfig(proxy.AgentID)

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

	// Validation: Ensure domain is unique for HTTP/HTTPS (excluding current proxy)
	if proxy.ProxyType == "http" || proxy.ProxyType == "https" {
		if proxy.CustomDomain != nil && *proxy.CustomDomain != "" {
			var count int
			err := h.database.Get(&count, "SELECT COUNT(*) FROM proxies WHERE custom_domain = ? AND id != ?", proxy.CustomDomain, id)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error checking domain uniqueness"})
				return
			}
			if count > 0 {
				c.JSON(http.StatusConflict, gin.H{"error": "This domain is already in use"})
				return
			}
		}
	} else if proxy.ProxyType == "tcp" || proxy.ProxyType == "udp" {
		// Validation: Ensure remote port is unique (excluding current proxy)
		if proxy.RemotePort != nil && *proxy.RemotePort != 0 {
			var count int
			err := h.database.Get(&count, "SELECT COUNT(*) FROM proxies WHERE remote_port = ? AND (proxy_type = 'tcp' OR proxy_type = 'udp') AND id != ?", proxy.RemotePort, id)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error checking port uniqueness"})
				return
			}
			if count > 0 {
				c.JSON(http.StatusConflict, gin.H{"error": "This remote port is already in use by another proxy"})
				return
			}

			// Validation: Ensure remote port is not physically listening on the ProxyManager Server
			connections, err := psnet.Connections("all")
			if err == nil {
				for _, conn := range connections {
					if conn.Status == "LISTEN" && conn.Laddr.Port == uint32(*proxy.RemotePort) {
						c.JSON(http.StatusConflict, gin.H{"error": "This remote port is already occupied by a system process on the server"})
						return
					}
				}
			}
		}
	}

	if proxy.LocalIP == "" {
		proxy.LocalIP = "127.0.0.1"
	}

	_, err := h.database.NamedExec("UPDATE proxies SET name=:name, proxy_type=:proxy_type, local_ip=:local_ip, local_port=:local_port, remote_port=:remote_port, custom_domain=:custom_domain, status=:status WHERE id=:id", &proxy)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update proxy: " + err.Error()})
		return
	}

	// Fetch agent_id for this proxy to notify it
	var agentID string
	h.database.Get(&agentID, "SELECT agent_id FROM proxies WHERE id = ?", id)
	go h.syncAgentFRPConfig(agentID)

	c.JSON(http.StatusOK, gin.H{"message": "Proxy updated successfully"})
}

func (h *DashboardHandler) DeleteProxy(c *gin.Context) {
	id := c.Param("id")

	// Fetch agent_id before deleting
	var agentID string
	err := h.database.Get(&agentID, "SELECT agent_id FROM proxies WHERE id = ?", id)

	_, err = h.database.Exec("DELETE FROM proxies WHERE id = ?", id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete proxy"})
		return
	}

	if agentID != "" {
		go h.syncAgentFRPConfig(agentID)
	}

	c.JSON(http.StatusOK, gin.H{"message": "Proxy deleted successfully"})
}

// syncAgentFRPConfig generates frpc config and sends it to the agent
func (h *DashboardHandler) syncAgentFRPConfig(agentID string) {
	var proxies []models.Proxy
	err := h.database.Select(&proxies, "SELECT * FROM proxies WHERE agent_id = ?", agentID)
	if err != nil {
		log.Printf("SyncFRP Error: Failed to fetch proxies: %v", err)
		return
	}

	serverIP := os.Getenv("SERVER_IP")
	frpPort := os.Getenv("FRPS_BIND_PORT")
	frpToken := os.Getenv("FRPS_TOKEN")

	// Generate YAML config
	config := fmt.Sprintf("serverAddr: \"%s\"\nserverPort: %s\nauth:\n  token: \"%s\"\n\nproxies:\n", serverIP, frpPort, frpToken)

	for _, p := range proxies {
		localIP := p.LocalIP
		if localIP == "" {
			localIP = "127.0.0.1"
		}
		config += fmt.Sprintf("  - name: \"%s\"\n    type: \"%s\"\n    localIP: \"%s\"\n", p.Name, p.ProxyType, localIP)
		if p.ProxyType == "http" || p.ProxyType == "https" {
			domain := ""
			if p.CustomDomain != nil {
				domain = *p.CustomDomain
			}
			config += fmt.Sprintf("    localPort: %d\n    customDomains: [\"%s\"]\n", p.LocalPort, domain)
		} else {
			remotePort := 0
			if p.RemotePort != nil {
				remotePort = *p.RemotePort
			}
			config += fmt.Sprintf("    localPort: %d\n    remotePort: %d\n", p.LocalPort, remotePort)
		}
	}

	// Send command via gRPC
	err = h.apiHandler.SendCommand(agentID, "RELOAD_FRPC", config)
	if err != nil {
		log.Printf("SyncFRP Error: Failed to send command to agent %s: %v", agentID, err)
	} else {
		log.Printf("SyncFRP: Successfully sent reload command to agent %s", agentID)
	}
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
	// 1. Fetch info from FRPS Dashboard API
	client := &http.Client{}

	// Get FRPS port and auth from config
	cfg, err := config.GetFrpsConfig()
	dashboardPort := "7500"
	user := "admin"
	password := "your_secure_password"

	if err == nil {
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
	}

	req, _ := http.NewRequest("GET", fmt.Sprintf("http://127.0.0.1:%s/api/status", dashboardPort), nil)
	req.SetBasicAuth(user, password)

	resp, err := client.Do(req)
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "FRPS Dashboard API unreachable: " + err.Error()})
		return
	}
	defer resp.Body.Close()

	var status map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&status)
	c.JSON(http.StatusOK, status)
}

func (h *DashboardHandler) GetHostPorts(c *gin.Context) {
	var ports []map[string]interface{}
	conns, _ := psnet.Connections("all")
	seen := make(map[uint32]bool)

	for _, conn := range conns {
		if conn.Status == "LISTEN" {
			if seen[conn.Laddr.Port] {
				continue
			}
			seen[conn.Laddr.Port] = true

			procName := "Unknown"
			if conn.Pid > 0 {
				p, err := process.NewProcess(conn.Pid)
				if err == nil {
					name, _ := p.Name()
					procName = name
				}
			}

			ports = append(ports, map[string]interface{}{
				"port":     conn.Laddr.Port,
				"process":  procName,
				"pid":      conn.Pid,
				"protocol": "tcp",
			})
		}
	}
	c.JSON(http.StatusOK, ports)
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
	targetOS := strings.ToLower(strings.TrimSpace(c.DefaultQuery("os", "")))

	if targetOS == "" {
		c.Header("Content-Type", "text/plain; charset=utf-8")
		c.String(http.StatusOK, buildInstallInstructions(c))
		return
	}

	switch targetOS {
	case "linux":
		c.Header("Content-Type", "text/x-shellscript; charset=utf-8")
		c.String(http.StatusOK, buildLinuxInstallScript(c))
	case "windows":
		c.Header("Content-Type", "text/plain; charset=utf-8")
		c.String(http.StatusOK, buildWindowsInstallScript(c))
	default:
		c.JSON(http.StatusBadRequest, gin.H{
			"error":     "unsupported os",
			"supported": []string{"linux", "windows"},
		})
	}
}

func buildInstallInstructions(c *gin.Context) string {
	baseURL := publicBaseURL(c)
	return fmt.Sprintf(`ProxyManager quick install

Linux:
curl -fsSL %s/api/v1/install/script?os=linux | sudo bash

Windows (PowerShell):
curl.exe -fsSL "%s/api/v1/install/script?os=windows" | powershell -NoProfile -ExecutionPolicy Bypass -

Notes:
- Agent binaries are served from %s/downloads/
- Expected files:
  - agent-linux-amd64
  - agent-linux-arm64
  - agent-windows-amd64.exe
  - agent-windows-arm64.exe
`, baseURL, baseURL, baseURL)
}

func buildLinuxInstallScript(c *gin.Context) string {
	baseURL := publicBaseURL(c)
	return fmt.Sprintf(`#!/usr/bin/env bash
set -euo pipefail

BASE_URL=%q
WORKDIR="/opt/proxymanager"
SERVICE_NAME="proxymanager-agent"
SERVER_ADDR=%q
AGENT_AUTH_TOKEN=%q

if [ "$(id -u)" -ne 0 ]; then
  echo "Please run as root"
  exit 1
fi

ARCH="$(uname -m)"
case "$ARCH" in
  x86_64|amd64)
    AGENT_FILE="agent-linux-amd64"
    FRP_FILE="frpc-linux-amd64"
    ;;
  aarch64|arm64)
    AGENT_FILE="agent-linux-arm64"
    FRP_FILE="frpc-linux-arm64"
    ;;
  *)
    echo "Unsupported architecture: $ARCH"
    exit 1
    ;;
esac

if systemctl list-unit-files | grep -q "^${SERVICE_NAME}.service"; then
  echo "Stopping existing agent service..."
  systemctl stop "$SERVICE_NAME" || true
  systemctl disable "$SERVICE_NAME" || true
fi

echo "Removing old agent files..."
rm -f /etc/systemd/system/${SERVICE_NAME}.service
rm -rf "$WORKDIR"

mkdir -p "$WORKDIR"
cd "$WORKDIR"

echo "Downloading agent binary (v1.1.0)..."
curl -fsSL "$BASE_URL/downloads/$AGENT_FILE" -o agent
chmod +x agent

FRP_VER="0.68.0"
echo "Downloading FRPC v$FRP_VER from official GitHub..."
curl -fsSL "https://github.com/fatedier/frp/releases/download/v$FRP_VER/frp_${FRP_VER}_linux_amd64.tar.gz" -o frp.tar.gz
tar -xzf frp.tar.gz
mv frp_${FRP_VER}_linux_amd64/frpc .
chmod +x frpc
rm -rf frp.tar.gz frp_${FRP_VER}_linux_amd64

cat > "$WORKDIR/agent.env" <<EOF
SERVER_ADDR=%s
AGENT_AUTH_TOKEN=%s
EOF

cat > /etc/systemd/system/${SERVICE_NAME}.service <<EOF
[Unit]
Description=ProxyManager Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/proxymanager
ExecStart=/opt/proxymanager/agent -server "${SERVER_ADDR}" -token "${AGENT_AUTH_TOKEN}"
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now "$SERVICE_NAME"

echo "ProxyManager agent installed successfully."
systemctl --no-pager --full status "$SERVICE_NAME" || true
`, baseURL, grpcServerAddr(c), os.Getenv("AGENT_AUTH_TOKEN"), grpcServerAddr(c), os.Getenv("AGENT_AUTH_TOKEN"))
}

func buildWindowsInstallScript(c *gin.Context) string {
	baseURL := publicBaseURL(c)
	return fmt.Sprintf(`$ErrorActionPreference = "Stop"

$BaseUrl = %q
$WorkDir = "C:\ProxyManager"
$ServiceName = "ProxyManagerAgent"
$ServerAddr = %q
$AgentToken = %q

# Force kill only processes running from our WorkDir to avoid touching unrelated frpc.exe instances
Get-Process agent, frpc -ErrorAction SilentlyContinue | Where-Object { 
  try { $_.Path -like "$WorkDir\*" } catch { $false }
} | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

if (Get-Service -Name $ServiceName -ErrorAction SilentlyContinue) {
  Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
  sc.exe delete $ServiceName | Out-Null
  Start-Sleep -Seconds 1
}

# Attempt to remove old files, ensuring they aren't locked
if (Test-Path "$WorkDir\agent.exe") { Remove-Item -Path "$WorkDir\agent.exe" -Force -ErrorAction SilentlyContinue }
if (Test-Path "$WorkDir\frpc.exe") { Remove-Item -Path "$WorkDir\frpc.exe" -Force -ErrorAction SilentlyContinue }

if (-not (Test-Path $WorkDir)) {
  New-Item -ItemType Directory -Force -Path $WorkDir | Out-Null
}

Set-Location $WorkDir

switch ($env:PROCESSOR_ARCHITECTURE) {
  "AMD64" { 
    $AgentFile = "agent-windows-amd64.exe"
    $FrpFile = "frpc-windows-amd64.exe"
  }
  "ARM64" { 
    $AgentFile = "agent-windows-arm64.exe"
    $FrpFile = "frpc-windows-arm64.exe"
  }
  default { throw "Unsupported architecture: $env:PROCESSOR_ARCHITECTURE" }
}

Write-Host "Setting up TLS 1.2..."
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

Write-Host "Adding Windows Defender exclusion for $WorkDir..."
Add-MpPreference -ExclusionPath $WorkDir -ErrorAction SilentlyContinue

Write-Host "Downloading agent binary (v1.1.0)..."
Invoke-WebRequest -Uri "$BaseUrl/downloads/$AgentFile" -OutFile "$WorkDir\agent.exe" -UseBasicParsing

$FRP_VER = "0.68.0"
Write-Host "Downloading frpc v$FRP_VER from official GitHub..."
$ZipFile = "$WorkDir\frp.zip"
Invoke-WebRequest -Uri "https://github.com/fatedier/frp/releases/download/v$FRP_VER/frp_${FRP_VER}_windows_amd64.zip" -OutFile $ZipFile -UseBasicParsing
Expand-Archive -Path $ZipFile -DestinationPath "$WorkDir\temp" -Force
$ExtractedDir = Get-ChildItem -Path "$WorkDir\temp" -Directory | Select-Object -First 1
Move-Item -Path "$($ExtractedDir.FullName)\frpc.exe" -Destination "$WorkDir\frpc.exe" -Force
Remove-Item -Path "$WorkDir\temp" -Recurse -Force
Remove-Item -Path $ZipFile -Force

[Environment]::SetEnvironmentVariable("SERVER_ADDR", $ServerAddr, "Machine")
[Environment]::SetEnvironmentVariable("AGENT_AUTH_TOKEN", $AgentToken, "Machine")

if (-not (Get-Service -Name $ServiceName -ErrorAction SilentlyContinue)) {
    $binPath = "$WorkDir\agent.exe"
    New-Service -Name $ServiceName -BinaryPathName $binPath -DisplayName "ProxyManager Agent" -StartupType Automatic | Out-Null
}

Start-Service -Name $ServiceName

Write-Host "ProxyManager agent installed successfully."
Get-Service -Name $ServiceName
`, baseURL, grpcServerAddr(c), os.Getenv("AGENT_AUTH_TOKEN"))
}

func publicBaseURL(c *gin.Context) string {
	serverIP := os.Getenv("SERVER_IP")
	dashboardPort := os.Getenv("DASHBOARD_PORT")
	if dashboardPort == "" {
		dashboardPort = "8000"
	}

	scheme := c.GetHeader("X-Forwarded-Proto")
	if scheme == "" {
		if c.Request.TLS != nil {
			scheme = "https"
		} else {
			scheme = "http"
		}
	}

	// Use the Host header from the request (e.g., proxy.ovncr.vn)
	// This is passed correctly by Nginx and matches the SSL certificate.
	host := c.Request.Host

	if host == "" || strings.HasPrefix(host, "localhost") || strings.HasPrefix(host, "127.0.0.1") {
		if serverIP != "" {
			host = serverIP
			if dashboardPort != "80" && dashboardPort != "443" {
				host = fmt.Sprintf("%s:%s", serverIP, dashboardPort)
			}
		} else if host == "" {
			host = fmt.Sprintf("localhost:%s", dashboardPort)
		}
	}

	return fmt.Sprintf("%s://%s", scheme, host)
}

func grpcServerAddr(c *gin.Context) string {
	host := c.Request.Host
	if host != "" {
		// Remove port if exists in host header
		if h, _, err := net.SplitHostPort(host); err == nil {
			host = h
		}
	} else {
		host = os.Getenv("SERVER_IP")
	}

	grpcPort := os.Getenv("GRPC_PORT")
	if grpcPort == "" {
		grpcPort = "50051"
	}
	return fmt.Sprintf("%s:%s", host, grpcPort)
}

// --- Domain, Nginx & Certificate Handlers ---

type DomainActionPayload struct {
	Domain string `json:"domain" binding:"required"`
}

type DomainStatus struct {
	Domain      string   `json:"domain"`
	ServerIP    string   `json:"server_ip"`
	ResolvedIPs []string `json:"resolved_ips"`
	Pointed     bool     `json:"pointed"`
	NginxReady  bool     `json:"nginx_ready"`
	CertReady   bool     `json:"cert_ready"`
}

func (h *DashboardHandler) CheckDomainStatus(c *gin.Context) {
	domain := strings.TrimSpace(c.Query("domain"))
	if domain == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "domain is required"})
		return
	}
	status := buildDomainStatus(c.Request.Context(), domain)
	c.JSON(http.StatusOK, status)
}

func (h *DashboardHandler) SetupDomainNginx(c *gin.Context) {
	var payload DomainActionPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := writeDomainNginxConfig(strings.TrimSpace(payload.Domain)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Nginx config generated and reloaded", "status": buildDomainStatus(c.Request.Context(), payload.Domain)})
}

func (h *DashboardHandler) RequestDomainCert(c *gin.Context) {
	var payload DomainActionPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	domain := strings.TrimSpace(payload.Domain)
	if domain == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "domain is required"})
		return
	}
	if !buildDomainStatus(c.Request.Context(), domain).Pointed {
		c.JSON(http.StatusConflict, gin.H{"error": "Domain has not pointed to this VPS IP yet"})
		return
	}
	if err := runCertbot(c.Request.Context(), domain); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	_ = writeDomainNginxConfig(domain)
	c.JSON(http.StatusOK, gin.H{"message": "Certificate requested and Nginx reloaded", "status": buildDomainStatus(c.Request.Context(), domain)})
}

func buildDomainStatus(ctx context.Context, domain string) DomainStatus {
	serverIP := os.Getenv("SERVER_IP")
	if publicIP := strings.TrimSpace(os.Getenv("PUBLIC_IP")); publicIP != "" {
		serverIP = publicIP
	}
	status := DomainStatus{Domain: domain, ServerIP: serverIP, NginxReady: nginxConfigExists(domain), CertReady: certExists(domain)}
	ips, err := net.DefaultResolver.LookupHost(ctx, domain)
	if err == nil {
		status.ResolvedIPs = ips
		for _, ip := range ips {
			if ip == serverIP && serverIP != "" {
				status.Pointed = true
				break
			}
		}
	}
	return status
}

func writeDomainNginxConfig(domain string) error {
	if err := validateDomainName(domain); err != nil {
		return err
	}
	confDir := strings.TrimSpace(os.Getenv("NGINX_PROXY_CONF_DIR"))
	if confDir == "" {
		confDir = "/etc/nginx/conf.d"
	}
	if err := os.MkdirAll(confDir, 0755); err != nil {
		return fmt.Errorf("failed to create nginx config dir: %w", err)
	}
	confPath := filepath.Join(confDir, "proxymanager-"+domain+".conf")
	content := renderDomainNginxConfig(domain)
	if err := os.WriteFile(confPath, []byte(content), 0644); err != nil {
		return fmt.Errorf("failed to write nginx config: %w", err)
	}
	if err := runCommand(context.Background(), "nginx", "-t"); err != nil {
		return err
	}
	if err := runCommand(context.Background(), "nginx", "-s", "reload"); err != nil {
		return err
	}
	return nil
}

func renderDomainNginxConfig(domain string) string {
	sslCert := fmt.Sprintf("/etc/letsencrypt/live/%s/fullchain.pem", domain)
	sslKey := fmt.Sprintf("/etc/letsencrypt/live/%s/privkey.pem", domain)
	if !certExists(domain) {
		return fmt.Sprintf(`server {
    listen 80;
    server_name %s;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        proxy_pass http://127.0.0.1:18081;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }
}
`, domain)
	}
	return fmt.Sprintf(`server {
    listen 80;
    server_name %s;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name %s;

    ssl_certificate %s;
    ssl_certificate_key %s;

    location / {
        proxy_pass http://127.0.0.1:18081;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }
}
`, domain, domain, sslCert, sslKey)
}

func runCertbot(ctx context.Context, domain string) error {
	if err := validateDomainName(domain); err != nil {
		return err
	}
	email := strings.TrimSpace(os.Getenv("CERTBOT_EMAIL"))
	args := []string{"certonly", "--webroot", "-w", "/var/www/html", "-d", domain, "--agree-tos", "--non-interactive"}
	if email != "" {
		args = append(args, "-m", email)
	} else {
		args = append(args, "--register-unsafely-without-email")
	}
	return runCommand(ctx, "certbot", args...)
}

func runCommand(ctx context.Context, name string, args ...string) error {
	cmd := exec.CommandContext(ctx, name, args...)
	var out bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &out
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("%s failed: %w: %s", name, err, strings.TrimSpace(out.String()))
	}
	return nil
}

func validateDomainName(domain string) error {
	if domain == "" {
		return errors.New("domain is required")
	}
	matched, _ := regexp.MatchString(`^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$`, domain)
	if !matched || strings.Contains(domain, "..") {
		return errors.New("invalid domain")
	}
	return nil
}

func nginxConfigExists(domain string) bool {
	confDir := strings.TrimSpace(os.Getenv("NGINX_PROXY_CONF_DIR"))
	if confDir == "" {
		confDir = "/etc/nginx/conf.d"
	}
	_, err := os.Stat(filepath.Join(confDir, "proxymanager-"+domain+".conf"))
	return err == nil
}

func certExists(domain string) bool {
	_, err := os.Stat(fmt.Sprintf("/etc/letsencrypt/live/%s/fullchain.pem", domain))
	return err == nil
}
