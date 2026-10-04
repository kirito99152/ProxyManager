package dashboard

import (
	"github.com/gin-gonic/gin"
	"github.com/kirito99152/ProxyManager/internal/api"
	"github.com/kirito99152/ProxyManager/internal/db"
	"github.com/kirito99152/ProxyManager/internal/mailer"
)

// SetupRoutes configures the dashboard's REST API routes.
func SetupRoutes(r *gin.Engine, database *db.DB, apiHandler *api.Handler, alertManager *mailer.AlertManager) {
	handler := NewDashboardHandler(database, apiHandler, alertManager)

	// Standard LLM / AI Discovery Endpoint at root
	r.GET("/llms.txt", handler.GetAIDocs)

	api := r.Group("/api/v1")
	{
		// Public Routes
		api.POST("/auth/login", handler.Login)
		api.POST("/auth/verify-email", handler.VerifyEmail)
		api.POST("/auth/resend-code", handler.ResendVerificationCode)
		api.GET("/ws", ServeWS)
		api.GET("/install/script", handler.GetInstallScript)

		// AI Agent Documentation & OpenAPI Specs (100% Public - No API key required)
		api.GET("/docs", handler.GetAIDocs)
		api.GET("/ai/docs", handler.GetAIDocs)
		api.GET("/ai/ping", handler.AIPing)
		api.GET("/openapi.json", handler.GetOpenAPISpec)

		// Protected Routes
		protected := api.Group("/")
		protected.Use(AuthMiddleware(database))
		{
			// Agent management
			protected.GET("/agents", handler.GetAgents)
			protected.GET("/agents/:id", handler.GetAgentByID)
			protected.PUT("/agents/:id", handler.UpdateAgent)
			protected.GET("/agents/:id/managers", handler.GetAgentManagers)
			protected.PUT("/agents/:id/managers", handler.SetAgentManagers)
			protected.POST("/agents/:id/upgrade", handler.UpgradeAgent) // Self-Update
			protected.POST("/install/token", handler.CreateInstallToken)
			protected.GET("/members/verified", handler.GetVerifiedMembers)

			// Proxy management
			protected.GET("/agents/:id/proxies", handler.GetProxiesForAgent)
			protected.POST("/proxies", handler.CreateProxy)
			protected.PUT("/proxies/:id", handler.UpdateProxy)
			protected.DELETE("/proxies/:id", handler.DeleteProxy)
			protected.GET("/domains/status", handler.CheckDomainStatus)
			protected.POST("/domains/nginx", handler.SetupDomainNginx)
			protected.POST("/domains/cert", handler.RequestDomainCert)

			// User self-management
			protected.GET("/users/me", handler.GetMyProfile)
			protected.PUT("/users/me/email", handler.UpdateMyEmail)
			protected.PUT("/users/me/password", handler.ChangePassword)

			// API Key management (for programmatic & AI Agent access)
			protected.GET("/api-keys", handler.GetAPIKeys)
			protected.POST("/api-keys", handler.CreateAPIKey)
			protected.DELETE("/api-keys/:id", handler.DeleteAPIKey)

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

				// Emergency Fallback & Remote Recovery
				admin.POST("/agents/:id/emergency/reset-password", handler.EmergencyResetPassword)
				admin.POST("/agents/:id/emergency/inject-ssh-key", handler.EmergencyInjectSSHKey)
				admin.POST("/agents/:id/emergency/exec", handler.EmergencyExec)
				admin.POST("/agents/:id/emergency/rotate-key", handler.EmergencyRotateKey)
			}

			// Statistics
			protected.GET("/stats/history/:id", handler.GetHardwareHistory)
			protected.GET("/stats/traffic", handler.GetTotalTraffic)
		}
	}
}
