package main

import (
	"log"
	"net"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/kirito99152/ProxyManager/internal/api"
	"github.com/kirito99152/ProxyManager/internal/dashboard"
	"github.com/kirito99152/ProxyManager/internal/db"
	"github.com/kirito99152/ProxyManager/internal/hub"
	"google.golang.org/grpc"
)

func main() {
	// Load .env
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	// Initialize Database
	database, err := db.InitDB()
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	// Start WebSocket Hub
	go hub.Hub.Run()

	// Start Offline Agent Monitor
	go dashboard.StartAgentMonitor(database)

	// Start FRPS Status Monitor (Tunnel Detection)
	go dashboard.StartFrpsMonitor(database)

	// Start Data Retention Policy Worker
	go db.StartRetentionPolicy(database)

	// Create a single API handler to be shared
	apiHandler := api.NewHandler(database)

	// Start gRPC Server in a goroutine
	go startGRPCServer(apiHandler)

	// Start Dashboard REST API, passing the API handler
	startDashboardServer(database, apiHandler)
}

func startGRPCServer(apiHandler *api.Handler) {
	grpcPort := os.Getenv("GRPC_PORT")
	if grpcPort == "" {
		grpcPort = "50051"
	}

	lis, err := net.Listen("tcp", ":"+grpcPort)
	if err != nil {
		log.Fatalf("failed to listen: %v", err)
	}

	s := grpc.NewServer()
	api.RegisterAgentServiceServer(s, apiHandler)

	log.Printf("gRPC server listening at %v", lis.Addr())
	if err := s.Serve(lis); err != nil {
		log.Fatalf("failed to serve: %v", err)
	}
}

func startDashboardServer(database *db.DB, apiHandler *api.Handler) {
	r := gin.Default()

	// CORS Middleware
	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	dashboard.SetupRoutes(r, database, apiHandler)

	// Serve Static Files
	r.Static("/assets", "dashboard/dist/assets")
	r.Static("/downloads", "downloads")
	r.StaticFile("/favicon.svg", "dashboard/dist/favicon.svg")
	r.StaticFile("/icons.svg", "dashboard/dist/icons.svg")

	// SPA Fallback: Route everything else to index.html
	r.NoRoute(func(c *gin.Context) {
		c.File("dashboard/dist/index.html")
	})

	dashboardPort := os.Getenv("DASHBOARD_PORT")
	if dashboardPort == "" {
		dashboardPort = "8000"
	}

	log.Printf("Dashboard REST API listening at :%s", dashboardPort)
	if err := http.ListenAndServe(":"+dashboardPort, r); err != nil {
		log.Fatalf("failed to serve dashboard: %v", err)
	}
}
