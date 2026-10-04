package models

import "time"

// APIKey represents an authorized API Key for programmatic / AI Agent access
type APIKey struct {
	ID         int        `db:"id" json:"id"`
	UserID     int        `db:"user_id" json:"user_id"`
	Name       string     `db:"name" json:"name"`
	KeyHash    string     `db:"key_hash" json:"-"`
	KeyPrefix  string     `db:"key_prefix" json:"key_prefix"`
	Role       string     `db:"role" json:"role"`
	Scopes     string     `db:"scopes" json:"scopes"`
	LastUsedAt *time.Time `db:"last_used_at" json:"last_used_at"`
	ExpiresAt  *time.Time `db:"expires_at" json:"expires_at"`
	IsActive   bool       `db:"is_active" json:"is_active"`
	CreatedAt  time.Time  `db:"created_at" json:"created_at"`
}

// CreateAPIKeyRequest is the payload received when creating a new API Key
type CreateAPIKeyRequest struct {
	Name          string `json:"name" binding:"required"`
	ExpiresInDays int    `json:"expires_in_days"`
	Role          string `json:"role"`
	Scopes        string `json:"scopes"`
}

// CreateAPIKeyResponse includes the raw plain-text key (only revealed once)
type CreateAPIKeyResponse struct {
	ID        int        `json:"id"`
	Name      string     `json:"name"`
	Key       string     `json:"key"` // Plain text key, e.g. pm_live_...
	KeyPrefix string     `json:"key_prefix"`
	Role      string     `json:"role"`
	Scopes    string     `json:"scopes"`
	ExpiresAt *time.Time `json:"expires_at"`
	CreatedAt time.Time  `json:"created_at"`
}
