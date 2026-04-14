package api

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"
	"sync"

	"github.com/google/uuid"
	"github.com/kirito99152/ProxyManager/internal/db"
	"github.com/kirito99152/ProxyManager/internal/hub"
	"github.com/kirito99152/ProxyManager/internal/models"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

type Handler struct {
	UnimplementedAgentServiceServer
	database *db.DB
	clients  map[string]chan *Command
	mu       sync.RWMutex
}

func NewHandler(database *db.DB) *Handler {
	return &Handler{
		database: database,
		clients:  make(map[string]chan *Command),
	}
}

// authenticate verifies the AGENT_AUTH_TOKEN in the gRPC metadata.
func (h *Handler) authenticate(ctx context.Context) error {
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return status.Errorf(codes.Unauthenticated, "metadata is not provided")
	}

	tokens := md["authorization"]
	if len(tokens) == 0 {
		return status.Errorf(codes.Unauthenticated, "authorization token is not provided")
	}

	expectedToken := os.Getenv("AGENT_AUTH_TOKEN")
	if expectedToken == "" {
		// If not set, we default to a safe "unauthenticated" unless explicit
		log.Println("Warning: AGENT_AUTH_TOKEN is not set in environment")
		return nil
	}

	if tokens[0] != expectedToken {
		return status.Errorf(codes.Unauthenticated, "invalid authorization token")
	}

	return nil
}

func (h *Handler) Register(ctx context.Context, req *RegisterRequest) (*RegisterResponse, error) {
	if err := h.authenticate(ctx); err != nil {
		return nil, err
	}

	agentID := stableAgentID(req)
	log.Printf("Registering agent: %s (%s) as %s", req.Hostname, req.PrivateIp, agentID)

	_, err := h.database.Exec(`
		INSERT INTO agents (id, hostname, os, private_ip, status, last_heartbeat)
		VALUES (?, ?, ?, ?, 'online', NOW())
		ON DUPLICATE KEY UPDATE
			hostname = VALUES(hostname),
			os = VALUES(os),
			private_ip = VALUES(private_ip),
			status = 'online',
			last_heartbeat = NOW()
	`, agentID, req.Hostname, req.Os, req.PrivateIp)
	if err != nil {
		return nil, fmt.Errorf("failed to register agent: %w", err)
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

func (h *Handler) Heartbeat(ctx context.Context, req *ReportRequest) (*ReportResponse, error) {
	if err := h.authenticate(ctx); err != nil {
		return nil, err
	}

	hardwareStats, _ := json.Marshal(req.Hardware)
	openPorts, _ := json.Marshal(req.OpenPorts)

	_, err := h.database.Exec("UPDATE agents SET status = 'online', last_heartbeat = NOW(), hardware_stats = ?, open_ports = ? WHERE id = ?",
		hardwareStats, openPorts, req.AgentId)
	if err != nil {
		return nil, fmt.Errorf("failed to update heartbeat: %w", err)
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

	return &ReportResponse{Success: true, Message: "Heartbeat received"}, nil
}

func (h *Handler) CommandStream(req *AgentID, stream AgentService_CommandStreamServer) error {
	if err := h.authenticate(stream.Context()); err != nil {
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
	h.mu.RUnlock()

	if !ok {
		return fmt.Errorf("agent %s not connected", agentID)
	}

	ch <- &Command{Action: action, Payload: payload}
	return nil
}

// ForwardLog receives a log entry from an agent, saves it, and broadcasts it.
func (h *Handler) ForwardLog(ctx context.Context, req *LogEntry) (*LogResponse, error) {
	if err := h.authenticate(ctx); err != nil {
		return nil, err
	}

	// Save log to the database
	_, err := h.database.Exec("INSERT INTO agent_logs (agent_id, log_level, message, timestamp, source) VALUES (?, ?, ?, ?, ?)",
		req.AgentId, req.LogLevel, req.Message, req.Timestamp, req.Source)
	if err != nil {
		log.Printf("Failed to insert agent log: %v", err)
		return &LogResponse{Success: false}, err
	}

	// Broadcast the log to the dashboard via WebSocket
	hub.BroadcastMessage("agent_log", req)

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
	if err := h.database.Select(&proxies, "SELECT * FROM proxies WHERE agent_id = ? AND status = 'active'", agentID); err != nil {
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
		config += fmt.Sprintf("  - name: \"%s\"\n    type: \"%s\"\n", p.Name, p.ProxyType)
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
