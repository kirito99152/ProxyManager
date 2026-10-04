package api

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/kirito99152/ProxyManager/internal/db"
	"github.com/kirito99152/ProxyManager/internal/hub"
	"github.com/kirito99152/ProxyManager/internal/mailer"
	"github.com/kirito99152/ProxyManager/internal/models"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

type Handler struct {
	UnimplementedAgentServiceServer
	database     *db.DB
	alertManager *mailer.AlertManager
	clients      map[string]chan *Command
	mu           sync.RWMutex
}

func NewHandler(database *db.DB, alertManager *mailer.AlertManager) *Handler {
	return &Handler{
		database:     database,
		alertManager: alertManager,
		clients:      make(map[string]chan *Command),
	}
}

// authenticate verifies the agent token in the gRPC metadata.
// Empty-token agents are allowed only when their agent ID already exists,
// preserving compatibility with older installs without opening enrollment.
func (h *Handler) authenticate(ctx context.Context, agentID string) error {
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return status.Errorf(codes.Unauthenticated, "metadata is not provided")
	}

	tokens := md["authorization"]
	if len(tokens) == 0 {
		return status.Errorf(codes.Unauthenticated, "authorization token is not provided")
	}

	token := strings.TrimSpace(tokens[0])
	if token == "" {
		if h.isKnownAgent(agentID) {
			log.Printf("Allowing legacy empty-token agent %s", agentID)
			return nil
		}
		return status.Errorf(codes.Unauthenticated, "authorization token is empty")
	}

	// Backward-compatible fallback for agents installed before one-time install tokens.
	if expectedToken := strings.TrimSpace(os.Getenv("AGENT_AUTH_TOKEN")); expectedToken != "" && token == expectedToken {
		return nil
	}

	var count int
	if err := h.database.Get(&count, `
		SELECT COUNT(*)
		FROM install_tokens
		WHERE token_hash = ?
		  AND used_at IS NOT NULL
	`, agentTokenHash(token)); err != nil {
		log.Printf("Failed to validate agent token: %v", err)
		return status.Errorf(codes.Unauthenticated, "failed to validate authorization token")
	}
	if count == 0 {
		return status.Errorf(codes.Unauthenticated, "invalid authorization token")
	}

	return nil
}

func (h *Handler) isKnownAgent(agentID string) bool {
	agentID = strings.TrimSpace(agentID)
	if agentID == "" {
		return false
	}

	var count int
	if err := h.database.Get(&count, "SELECT COUNT(*) FROM agents WHERE id = ?", agentID); err != nil {
		log.Printf("Failed to check legacy agent %s: %v", agentID, err)
		return false
	}
	return count > 0
}

func agentTokenHash(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func (h *Handler) Register(ctx context.Context, req *RegisterRequest) (*RegisterResponse, error) {
	agentID := stableAgentID(req)

	// If hostname contains #, the part after # is the Machine ID (most persistent)
	hostname := req.Hostname
	if strings.Contains(req.Hostname, "#") {
		parts := strings.Split(req.Hostname, "#")
		hostname = parts[0]
		agentID = parts[1] // Use Machine ID directly
	}

	if err := h.authenticate(ctx, agentID); err != nil {
		return nil, err
	}

	log.Printf("Registering agent: %s (%s) as %s", hostname, req.PrivateIp, agentID)

	var prevStatus string
	var existingAgent models.Agent
	if err := h.database.Get(&existingAgent, "SELECT * FROM agents WHERE id = ?", agentID); err == nil {
		prevStatus = existingAgent.Status
	}

	_, err := h.database.Exec(`
		INSERT INTO agents (id, name, hostname, os, private_ip, status, last_heartbeat)
		VALUES (?, ?, ?, ?, ?, 'online', NOW())
		ON DUPLICATE KEY UPDATE
			hostname = VALUES(hostname),
			os = VALUES(os),
			private_ip = VALUES(private_ip),
			status = 'online',
			last_heartbeat = NOW()
	`, agentID, hostname, hostname, req.Os, req.PrivateIp)
	if err != nil {
		return nil, fmt.Errorf("failed to register agent: %w", err)
	}

	if prevStatus == "offline" && h.alertManager != nil {
		existingAgent.Status = "online"
		existingAgent.Hostname = hostname
		existingAgent.PrivateIP = req.PrivateIp
		h.alertManager.TriggerOnlineAlert(existingAgent)
	}

	frpcConfig, err := h.buildAgentFRPCConfig(agentID)
	if err != nil {
		return nil, fmt.Errorf("failed to build frpc config: %w", err)
	}

	return &RegisterResponse{
		AgentId:            agentID,
		FrpcConfigTemplate: frpcConfig,
		FrpServerAddr:      os.Getenv("SERVER_IP"),
		FrpServerPort:      os.Getenv("FRPS_BIND_PORT"),
		FrpToken:           os.Getenv("FRPS_TOKEN"),
	}, nil
}

const LatestAgentVersion = "1.1.1"

func (h *Handler) Heartbeat(ctx context.Context, req *ReportRequest) (*ReportResponse, error) {
	if err := h.authenticate(ctx, req.AgentId); err != nil {
		return nil, err
	}

	var prevAgent models.Agent
	prevStatus := "online"
	if err := h.database.Get(&prevAgent, "SELECT * FROM agents WHERE id = ?", req.AgentId); err == nil {
		prevStatus = prevAgent.Status
	}

	hardwareStats, _ := json.Marshal(req.Hardware)
	openPorts, _ := json.Marshal(req.OpenPorts)

	_, err := h.database.Exec("UPDATE agents SET status = 'online', last_heartbeat = NOW(), hardware_stats = ?, open_ports = ? WHERE id = ?",
		hardwareStats, openPorts, req.AgentId)
	if err != nil {
		return nil, fmt.Errorf("failed to update heartbeat: %w", err)
	}

	if prevStatus == "offline" && h.alertManager != nil {
		prevAgent.Status = "online"
		h.alertManager.TriggerOnlineAlert(prevAgent)
	}

	// Resource threshold check (CPU, RAM, Disk)
	if h.alertManager != nil && req.Hardware != nil {
		currAgent := prevAgent
		if currAgent.ID == "" {
			currAgent.ID = req.AgentId
		}

		cpuThreshold := h.alertManager.GetThreshold(mailer.AlertTypeCPU, 95.0)
		ramThreshold := h.alertManager.GetThreshold(mailer.AlertTypeRAM, 95.0)
		diskThreshold := h.alertManager.GetThreshold(mailer.AlertTypeDisk, 95.0)

		// CPU Threshold
		cpu := req.Hardware.CpuUsage
		if cpu > cpuThreshold {
			h.alertManager.TriggerResourceAlert(currAgent, mailer.AlertTypeCPU, "CPU", cpu, cpuThreshold, fmt.Sprintf("Mức sử dụng CPU: %.1f%%", cpu))
		} else if cpu < (cpuThreshold - 5.0) {
			h.alertManager.ClearResourceAlert(req.AgentId, mailer.AlertTypeCPU)
		}

		// RAM Threshold
		if req.Hardware.RamTotal > 0 {
			ramPct := float64(req.Hardware.RamUsed) * 100.0 / float64(req.Hardware.RamTotal)
			if ramPct > ramThreshold {
				h.alertManager.TriggerResourceAlert(currAgent, mailer.AlertTypeRAM, "RAM", ramPct, ramThreshold, fmt.Sprintf("Đã dùng %s / %s (%.1f%%)", formatByteCount(req.Hardware.RamUsed), formatByteCount(req.Hardware.RamTotal), ramPct))
			} else if ramPct < (ramThreshold - 5.0) {
				h.alertManager.ClearResourceAlert(req.AgentId, mailer.AlertTypeRAM)
			}
		}

		// Disk Threshold
		if req.Hardware.DiskTotal > 0 {
			diskPct := float64(req.Hardware.DiskUsed) * 100.0 / float64(req.Hardware.DiskTotal)
			if diskPct > diskThreshold {
				h.alertManager.TriggerResourceAlert(currAgent, mailer.AlertTypeDisk, "Ổ đĩa (Disk)", diskPct, diskThreshold, fmt.Sprintf("Đã dùng %s / %s (%.1f%%)", formatByteCount(req.Hardware.DiskUsed), formatByteCount(req.Hardware.DiskTotal), diskPct))
			} else if diskPct < (diskThreshold - 5.0) {
				h.alertManager.ClearResourceAlert(req.AgentId, mailer.AlertTypeDisk)
			}
		}
	}

	// Insert into hardware_logs
	if req.Hardware != nil {
		_, err = h.database.Exec("INSERT INTO hardware_logs (agent_id, cpu_usage, ram_used, ram_total, network_rx, network_tx) VALUES (?, ?, ?, ?, ?, ?)",
			req.AgentId, req.Hardware.CpuUsage, req.Hardware.RamUsed, req.Hardware.RamTotal, req.Hardware.NetIn, req.Hardware.NetOut)
		if err != nil {
			log.Printf("Failed to insert hardware log: %v", err)
		}
	}

	// Broadcast Real-time Data to Dashboard
	payload := map[string]interface{}{
		"agent_id": req.AgentId,
		"hardware": req.Hardware,
		"ports":    req.OpenPorts,
	}
	hub.BroadcastMessage("agent_heartbeat", payload)

	// Determine OS for upgrade URL
	// baseURL determines where the agent can download its binaries.
	baseURL := os.Getenv("PUBLIC_URL")
	if baseURL == "" {
		serverIP := os.Getenv("SERVER_IP")
		if serverIP != "" {
			dashboardPort := os.Getenv("DASHBOARD_PORT")
			if dashboardPort == "" {
				dashboardPort = "8000"
			}
			baseURL = fmt.Sprintf("http://%s:%s", serverIP, dashboardPort)
		} else {
			baseURL = "http://59.153.245.146" // last resort fallback
		}
	}

	return &ReportResponse{
		Success:       true,
		Message:       "Heartbeat received",
		LatestVersion: LatestAgentVersion,
		UpgradeUrl:    fmt.Sprintf("%s/downloads", baseURL),
	}, nil
}

func (h *Handler) CommandStream(req *AgentID, stream AgentService_CommandStreamServer) error {
	if err := h.authenticate(stream.Context(), req.AgentId); err != nil {
		return err
	}

	ch := make(chan *Command, 10)
	h.mu.Lock()
	h.clients[req.AgentId] = ch
	h.mu.Unlock()

	defer func() {
		h.mu.Lock()
		delete(h.clients, req.AgentId)
		h.mu.Unlock()
	}()

	log.Printf("Agent %s connected for command stream", req.AgentId)

	if config, err := h.buildAgentFRPCConfig(req.AgentId); err == nil && config != "" {
		if err := stream.Send(&Command{Action: "RELOAD_FRPC", Payload: config}); err != nil {
			return err
		}
	}

	for {
		select {
		case cmd := <-ch:
			if err := stream.Send(cmd); err != nil {
				return err
			}
		case <-stream.Context().Done():
			return nil
		}
	}
}

func (h *Handler) SendCommand(agentID string, action string, payload string) error {
	h.mu.RLock()
	ch, ok := h.clients[agentID]

	// Debug connected clients
	var connected []string
	for k := range h.clients {
		connected = append(connected, k)
	}
	h.mu.RUnlock()

	if !ok {
		return fmt.Errorf("agent %s not connected (currently connected: %v)", agentID, connected)
	}

	ch <- &Command{Action: action, Payload: payload}
	return nil
}

// ForwardLog receives a log entry from an agent, saves it, and broadcasts it.
func (h *Handler) ForwardLog(ctx context.Context, req *LogEntry) (*LogResponse, error) {
	if err := h.authenticate(ctx, req.AgentId); err != nil {
		log.Printf("ForwardLog Auth Failed for Agent %s: %v", req.AgentId, err)
		return nil, err
	}
	log.Printf("Received ForwardLog from %s: Source=%s, Msg=%s", req.AgentId, req.Source, req.Message)

	// Save log to the database
	logTime := time.Now()
	if t, parseErr := time.Parse(time.RFC3339, req.Timestamp); parseErr == nil {
		logTime = t
	}

	_, err := h.database.Exec("INSERT INTO agent_logs (agent_id, log_level, message, timestamp, source) VALUES (?, ?, ?, ?, ?)",
		req.AgentId, req.LogLevel, req.Message, logTime, req.Source)
	if err != nil {
		log.Printf("Failed to insert agent log: %v", err)
		return &LogResponse{Success: false}, err
	}

	payload := map[string]interface{}{
		"agent_id":  req.AgentId,
		"message":   req.Message,
		"source":    req.Source,
		"log_level": req.LogLevel,
		"timestamp": req.Timestamp,
	}
	hub.BroadcastMessage("agent_log", payload)

	return &LogResponse{Success: true}, nil
}

func stableAgentID(req *RegisterRequest) string {
	hostname := strings.TrimSpace(strings.ToLower(req.Hostname))
	privateIP := strings.TrimSpace(strings.ToLower(req.PrivateIp))
	osName := strings.TrimSpace(strings.ToLower(req.Os))

	source := fmt.Sprintf("%s|%s|%s", hostname, privateIP, osName)
	if strings.Trim(source, "|") == "" {
		source = uuid.NewString()
	}

	return uuid.NewSHA1(uuid.NameSpaceURL, []byte(source)).String()
}

func (h *Handler) buildAgentFRPCConfig(agentID string) (string, error) {
	var proxies []models.Proxy
	if err := h.database.Select(&proxies, "SELECT * FROM proxies WHERE agent_id = ?", agentID); err != nil {
		return "", err
	}

	if len(proxies) == 0 {
		return "", nil
	}

	serverIP := os.Getenv("SERVER_IP")
	frpPort := os.Getenv("FRPS_BIND_PORT")
	frpToken := os.Getenv("FRPS_TOKEN")

	config := fmt.Sprintf("serverAddr: \"%s\"\nserverPort: %s\nauth:\n  token: \"%s\"\n\nproxies:\n", serverIP, frpPort, frpToken)
	for _, p := range proxies {
		localIP := p.LocalIP
		if localIP == "" {
			localIP = "127.0.0.1"
		}
		config += fmt.Sprintf("  - name: \"%s\"\n    type: \"%s\"\n    localIP: \"%s\"\n", p.Name, p.ProxyType, localIP)
		if p.ProxyType == "http" || p.ProxyType == "https" {
			config += fmt.Sprintf("    localPort: %d\n    customDomains: [\"%s\"]\n", p.LocalPort, valueOrEmpty(p.CustomDomain))
		} else {
			config += fmt.Sprintf("    localPort: %d\n    remotePort: %d\n", p.LocalPort, valueOrZero(p.RemotePort))
		}
	}

	return config, nil
}

func valueOrEmpty(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func valueOrZero(value *int) int {
	if value == nil {
		return 0
	}
	return *value
}

func formatByteCount(b uint64) string {
	const unit = 1024
	if b < unit {
		return fmt.Sprintf("%d B", b)
	}
	div, exp := int64(unit), 0
	for n := b / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.2f %cB", float64(b)/float64(div), "KMGTPE"[exp])
}

