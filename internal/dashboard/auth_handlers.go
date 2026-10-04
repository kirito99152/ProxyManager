package dashboard

import (
	"database/sql"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/kirito99152/ProxyManager/internal/auth"
	"github.com/kirito99152/ProxyManager/internal/db"
)

type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

func (h *DashboardHandler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	var hash string
	var role string
	err := h.database.QueryRow("SELECT password_hash, role FROM users WHERE username = ?", req.Username).Scan(&hash, &role)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		}
		return
	}

	if !auth.CheckPasswordHash(req.Password, hash) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	token, err := auth.GenerateToken(req.Username, role)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not generate token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token": token,
		"user": map[string]string{
			"username": req.Username,
			"role":     role,
		},
	})
}

// AuthMiddleware validates JWT token from Authorization header or API Key from X-API-Key / Bearer header
func AuthMiddleware(database *db.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 1. Check for API Key first (X-API-Key or Bearer pm_live_...)
		apiKey := c.GetHeader("X-API-Key")
		authHeader := c.GetHeader("Authorization")
		if apiKey == "" && strings.HasPrefix(authHeader, "Bearer pm_live_") {
			apiKey = strings.TrimPrefix(authHeader, "Bearer ")
		}

		if apiKey != "" {
			keyHash := auth.HashAPIKey(apiKey)
			var (
				keyID     int
				userID    int
				keyName   string
				role      string
				scopes    string
				isActive  bool
				expiresAt *time.Time
				username  string
			)
			err := database.QueryRow(`
				SELECT a.id, a.user_id, a.name, a.role, a.scopes, a.is_active, a.expires_at, u.username
				FROM api_keys a
				JOIN users u ON a.user_id = u.id
				WHERE a.key_hash = ?
			`, keyHash).Scan(&keyID, &userID, &keyName, &role, &scopes, &isActive, &expiresAt, &username)

			if err != nil {
				if err == sql.ErrNoRows {
					c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid API key"})
				} else {
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error validating API key"})
				}
				c.Abort()
				return
			}

			if !isActive {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "API key is deactivated"})
				c.Abort()
				return
			}

			if expiresAt != nil && time.Now().After(*expiresAt) {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "API key has expired"})
				c.Abort()
				return
			}

			// Update last_used_at in background
			go func(id int) {
				_, _ = database.Exec("UPDATE api_keys SET last_used_at = NOW() WHERE id = ?", id)
			}(keyID)

			c.Set("username", username)
			c.Set("role", role)
			c.Set("user_id", userID)
			c.Set("auth_type", "api_key")
			c.Set("api_key_id", keyID)
			c.Set("scopes", scopes)
			c.Next()
			return
		}

		// 2. Fallback to standard JWT token
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header or X-API-Key required"})
			c.Abort()
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid authorization format"})
			c.Abort()
			return
		}

		tokenString := parts[1]
		claims, err := auth.ValidateToken(tokenString)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
			c.Abort()
			return
		}

		// Store user info in context
		c.Set("username", claims.Username)
		c.Set("role", claims.Role)
		c.Set("auth_type", "jwt")
		c.Next()
	}
}

// AdminMiddleware ensures the user has admin role
func AdminMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		role, exists := c.Get("role")
		if !exists || role != "admin" {
			c.JSON(http.StatusForbidden, gin.H{"error": "Admin access required"})
			c.Abort()
			return
		}
		c.Next()
	}
}
