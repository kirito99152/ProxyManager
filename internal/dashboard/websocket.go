package dashboard

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/kirito99152/ProxyManager/internal/auth"
	"github.com/kirito99152/ProxyManager/internal/hub"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for the dashboard
	},
}

func ServeWS(c *gin.Context) {
	// Authenticate WebSocket connection using token from query param
	tokenString := c.Query("token")
	if tokenString == "" {
		log.Printf("WS Error: No token provided")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication token required"})
		return
	}

	_, err := auth.ValidateToken(tokenString)
	if err != nil {
		log.Printf("WS Auth Error: %v", err)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid authentication token"})
		return
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("Failed to set websocket upgrade: %+v", err)
		return
	}
	hub.Hub.Register <- conn

	// Basic read loop to keep the connection alive and handle client disconnects
	go func() {
		defer func() {
			hub.Hub.Unregister <- conn
		}()
		for {
			_, _, err := conn.ReadMessage()
			if err != nil {
				if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
					log.Printf("WS close error: %v", err)
				}
				break
			}
		}
	}()
}
