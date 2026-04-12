package api

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"sync"

	"github.com/google/uuid"
	"github.com/kirito99152/ProxyManager/internal/db"
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

func (h *Handler) Register(ctx context.Context, req *RegisterRequest) (*RegisterResponse, error) {
	agentID := uuid.New().String()
	log.Printf("Registering agent: %s (%s)", req.Hostname, req.PrivateIp)

	_, err := h.database.Exec("INSERT INTO agents (id, hostname, os, private_ip, status) VALUES (?, ?, ?, ?, 'online')",
		agentID, req.Hostname, req.Os, req.PrivateIp)
	if err != nil {
		return nil, fmt.Errorf("failed to register agent: %w", err)
	}

	return &RegisterResponse{
		AgentId:            agentID,
		FrpcConfigTemplate: "", // Will be filled later
		FrpServerAddr:      os.Getenv("SERVER_IP"),
		FrpServerPort:      os.Getenv("FRPS_BIND_PORT"),
		FrpToken:           os.Getenv("FRPS_TOKEN"),
	}, nil
}

func (h *Handler) Heartbeat(ctx context.Context, req *ReportRequest) (*ReportResponse, error) {
	hardwareStats, _ := json.Marshal(req.Hardware)
	openPorts, _ := json.Marshal(req.OpenPorts)

	_, err := h.database.Exec("UPDATE agents SET status = 'online', last_heartbeat = NOW(), hardware_stats = ?, open_ports = ? WHERE id = ?",
		hardwareStats, openPorts, req.AgentId)
	if err != nil {
		return nil, fmt.Errorf("failed to update heartbeat: %w", err)
	}

	return &ReportResponse{Success: true, Message: "Heartbeat received"}, nil
}

func (h *Handler) CommandStream(req *AgentID, stream AgentService_CommandStreamServer) error {
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
