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
	go dashboard.Hub.Run()

	// Start Offline Agent Monitor
	go dashboard.StartAgentMonitor(database)

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
	dashboard.SetupRoutes(r, database, apiHandler)

	dashboardPort := os.Getenv("DASHBOARD_PORT")
	if dashboardPort == "" {
		dashboardPort = "8000"
	}

	log.Printf("Dashboard REST API listening at :%s", dashboardPort)
	if err := http.ListenAndServe(":"+dashboardPort, r); err != nil {
		log.Fatalf("failed to serve dashboard: %v", err)
	}
}
