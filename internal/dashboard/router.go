package dashboard

import (
	"github.com/gin-gonic/gin"
	"github.com/kirito99152/ProxyManager/internal/db"
)

// SetupRoutes configures the dashboard's REST API routes.
func SetupRoutes(r *gin.Engine, database *db.DB) {
	handler := NewDashboardHandler(database)

	api := r.Group("/api/v1")
	{
		// Agent management
		api.GET("/agents", handler.GetAgents)
		api.GET("/agents/:id", handler.GetAgentByID)

		// Proxy management
		api.GET("/agents/:id/proxies", handler.GetProxiesForAgent)
		api.POST("/proxies", handler.CreateProxy)
		api.PUT("/proxies/:id", handler.UpdateProxy)
		api.DELETE("/proxies/:id", handler.DeleteProxy)

		// FRPS config management
		api.GET("/frps/config", handler.GetFrpsConfig)
		api.PUT("/frps/config", handler.UpdateFrpsConfig)

		// Endpoint for Agent #4 to get install script
		api.GET("/install/script", handler.GetInstallScript)
	}
}
