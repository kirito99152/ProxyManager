package dashboard

import (
	"github.com/gin-gonic/gin"
	"github.com/kirito99152/ProxyManager/internal/api"
	"github.com/kirito99152/ProxyManager/internal/db"
)

// SetupRoutes configures the dashboard's REST API routes.
func SetupRoutes(r *gin.Engine, database *db.DB, apiHandler *api.Handler) {
	handler := NewDashboardHandler(database, apiHandler)

	api := r.Group("/api/v1")
	{
		// Public Routes
		api.POST("/auth/login", handler.Login)
		api.GET("/ws", ServeWS)
		api.GET("/install/script", handler.GetInstallScript)

		// Protected Routes
		protected := api.Group("/")
		protected.Use(AuthMiddleware())
		{
			// Agent management
			protected.GET("/agents", handler.GetAgents)
			protected.GET("/agents/:id", handler.GetAgentByID)
			protected.PUT("/agents/:id", handler.UpdateAgent)
			protected.POST("/agents/:id/upgrade", handler.UpgradeAgent) // Self-Update

			// Proxy management
			protected.GET("/agents/:id/proxies", handler.GetProxiesForAgent)
			protected.POST("/proxies", handler.CreateProxy)
			protected.PUT("/proxies/:id", handler.UpdateProxy)
			protected.DELETE("/proxies/:id", handler.DeleteProxy)
			protected.GET("/domains/status", handler.CheckDomainStatus)
			protected.POST("/domains/nginx", handler.SetupDomainNginx)
			protected.POST("/domains/cert", handler.RequestDomainCert)

			// User self-management
			protected.PUT("/users/me/password", handler.ChangePassword)

			// Admin-Only Routes
			admin := protected.Group("/")
			admin.Use(AdminMiddleware())
			{
				// FRPS Management
				admin.GET("/frps/config", handler.GetFrpsConfig)
				admin.PUT("/frps/config", handler.UpdateFrpsConfig)
				admin.GET("/frps/status", handler.GetFrpsStatus)
				admin.GET("/host/ports", handler.GetHostPorts)

				// System Settings & Logs
				admin.GET("/settings", handler.GetSettings)
				admin.PUT("/settings", handler.UpdateSetting)
				admin.GET("/logs", handler.GetLogs)

				// User Management
				admin.GET("/users", handler.GetUsers)
				admin.POST("/users", handler.CreateUser)
				admin.PUT("/users/:id", handler.UpdateUser)
				admin.DELETE("/users/:id", handler.DeleteUser)
			}

			// Statistics
			protected.GET("/stats/history/:id", handler.GetHardwareHistory)
			protected.GET("/stats/traffic", handler.GetTotalTraffic)
		}
	}
}
