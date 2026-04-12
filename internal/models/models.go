package models

import (
	"time"
)

// Agent represents a client agent connected to the ProxyManager.
type Agent struct {
	ID           string    `db:"id" json:"id"`
	Hostname     string    `db:"hostname" json:"hostname"`
	OS           string    `db:"os" json:"os"`
	PrivateIP    string    `db:"private_ip" json:"private_ip"`
	Status       string    `db:"status" json:"status"` // e.g., 'online', 'offline'
	LastHeartbeat time.Time `db:"last_heartbeat" json:"last_heartbeat"`
	HardwareStats string    `db:"hardware_stats" json:"hardware_stats"` // JSON string
	OpenPorts     string    `db:"open_ports" json:"open_ports"`         // JSON string
	CreatedAt    time.Time `db:"created_at" json:"created_at"`
}

// Proxy represents a proxy configuration for an agent.
type Proxy struct {
	ID          int       `db:"id" json:"id"`
	AgentID     string    `db:"agent_id" json:"agent_id"`
	Name        string    `db:"name" json:"name"`
	ProxyType   string    `db:"proxy_type" json:"proxy_type"` // e.g., 'http', 'https', 'tcp', 'udp'
	LocalPort   int       `db:"local_port" json:"local_port"`
	RemotePort  *int      `db:"remote_port" json:"remote_port,omitempty"` // Nullable
	CustomDomain *string   `db:"custom_domain" json:"custom_domain,omitempty"` // Nullable
	Status      string    `db:"status" json:"status"` // e.g., 'active', 'inactive'
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
}

// ActivityLog represents an activity log entry.
type ActivityLog struct {
	ID        int       `db:"id" json:"id"`
	AgentID   *string   `db:"agent_id" json:"agent_id,omitempty"` // Nullable
	Action    string    `db:"action" json:"action"`
	Details   string    `db:"details" json:"details"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
}

// HardwareLog represents historical hardware stats for charts.
type HardwareLog struct {
	ID        int       `db:"id" json:"id"`
	AgentID   string    `db:"agent_id" json:"agent_id"`
	CPUUsage  float64   `db:"cpu_usage" json:"cpu_usage"`
	RAMUsed   uint64    `db:"ram_used" json:"ram_used"`
	RAMTotal  uint64    `db:"ram_total" json:"ram_total"`
	NetworkRX uint64    `db:"network_rx" json:"network_rx"`
	NetworkTX uint64    `db:"network_tx" json:"network_tx"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
}

