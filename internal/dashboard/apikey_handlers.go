package dashboard

import (
	"database/sql"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/kirito99152/ProxyManager/internal/auth"
	"github.com/kirito99152/ProxyManager/internal/models"
)

// GetAPIKeys lists all active/created API keys for the current user (or all if admin)
func (h *DashboardHandler) GetAPIKeys(c *gin.Context) {
	username, _ := c.Get("username")
	role, _ := c.Get("role")

	var keys []models.APIKey
	var err error

	if role == "admin" {
		err = h.database.Select(&keys, `
			SELECT id, user_id, name, '' AS key_hash, key_prefix, role, scopes, last_used_at, expires_at, is_active, created_at
			FROM api_keys
			ORDER BY created_at DESC
		`)
	} else {
		err = h.database.Select(&keys, `
			SELECT a.id, a.user_id, a.name, '' AS key_hash, a.key_prefix, a.role, a.scopes, a.last_used_at, a.expires_at, a.is_active, a.created_at
			FROM api_keys a
			JOIN users u ON a.user_id = u.id
			WHERE u.username = ?
			ORDER BY a.created_at DESC
		`, username)
	}

	if err != nil && err != sql.ErrNoRows {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch API keys: " + err.Error()})
		return
	}

	if keys == nil {
		keys = []models.APIKey{}
	}

	c.JSON(http.StatusOK, keys)
}

// CreateAPIKey generates a new API Key for programmatic / AI Agent access
func (h *DashboardHandler) CreateAPIKey(c *gin.Context) {
	usernameVal, exists := c.Get("username")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	username := usernameVal.(string)

	var req models.CreateAPIKeyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: name is required"})
		return
	}

	// Fetch user ID and Role
	var userID int
	var userRole string
	err := h.database.QueryRow("SELECT id, role FROM users WHERE username = ?", username).Scan(&userID, &userRole)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to resolve user account"})
		return
	}

	assignedRole := userRole
	if req.Role != "" {
		// Non-admins cannot grant admin role
		if userRole == "admin" || req.Role != "admin" {
			assignedRole = req.Role
		}
	}

	scopes := "full_access"
	if req.Scopes != "" {
		scopes = req.Scopes
	}

	var expiresAt *time.Time
	if req.ExpiresInDays > 0 {
		exp := time.Now().AddDate(0, 0, req.ExpiresInDays)
		expiresAt = &exp
	}

	rawKey, prefix, hash, err := auth.GenerateAPIKey()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate cryptographically secure key"})
		return
	}

	result, err := h.database.Exec(`
		INSERT INTO api_keys (user_id, name, key_hash, key_prefix, role, scopes, expires_at, is_active)
		VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)
	`, userID, req.Name, hash, prefix, assignedRole, scopes, expiresAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save API key in database: " + err.Error()})
		return
	}

	lastID, _ := result.LastInsertId()

	c.JSON(http.StatusCreated, models.CreateAPIKeyResponse{
		ID:        int(lastID),
		Name:      req.Name,
		Key:       rawKey,
		KeyPrefix: prefix,
		Role:      assignedRole,
		Scopes:    scopes,
		ExpiresAt: expiresAt,
		CreatedAt: time.Now(),
	})
}

// DeleteAPIKey revokes/deletes an existing API Key
func (h *DashboardHandler) DeleteAPIKey(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid API key ID"})
		return
	}

	username, _ := c.Get("username")
	role, _ := c.Get("role")

	var result sql.Result
	if role == "admin" {
		result, err = h.database.Exec("DELETE FROM api_keys WHERE id = ?", id)
	} else {
		result, err = h.database.Exec(`
			DELETE a FROM api_keys a
			JOIN users u ON a.user_id = u.id
			WHERE a.id = ? AND u.username = ?
		`, id, username)
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error deleting API key"})
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "API key not found or permission denied"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "API key revoked successfully"})
}
