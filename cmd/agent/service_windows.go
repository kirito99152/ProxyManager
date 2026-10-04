//go:build windows
package main

import (
	"context"
	"io"
	"log"
	"os"
	"path/filepath"
	"time"

	"golang.org/x/sys/windows/svc"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	pb "github.com/kirito99152/ProxyManager/internal/api"
)

func isWindowsService() bool {
	isService, err := svc.IsWindowsService()
	if err != nil {
		return false
	}
	return isService
}

type agentService struct {
	serverAddr string
	token      string
}

func (m *agentService) Execute(args []string, r <-chan svc.ChangeRequest, changes chan<- svc.Status) (ssec bool, errno uint32) {
	const cmdsAccepted = svc.AcceptStop | svc.AcceptShutdown
	changes <- svc.Status{State: svc.StartPending}

	// Ensure working directory is the executable's directory
	if execPath, err := os.Executable(); err == nil {
		_ = os.Chdir(filepath.Dir(execPath))
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	agent := &Agent{
		ServerAddr:      m.serverAddr,
		Token:           m.token,
		reportedMissing: make(map[string]bool),
	}

	// Immediately report Running so Windows SCM knows the service is active at boot
	changes <- svc.Status{State: svc.Running, Accepts: cmdsAccepted}
	log.Printf("[WindowsService] Service started, entering background connection loop for %s...", m.serverAddr)

	// Run connection and registration in a robust retry loop in background
	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			default:
			}

			conn, err := grpc.NewClient(m.serverAddr, grpc.WithTransportCredentials(insecure.NewCredentials()))
			if err != nil {
				log.Printf("[WindowsService] gRPC client creation failed (%v). Retrying in 5s...", err)
				time.Sleep(5 * time.Second)
				continue
			}

			agent.Client = pb.NewAgentServiceClient(conn)

			redirector := &LogRedirector{agent: agent}
			log.SetOutput(io.MultiWriter(os.Stdout, redirector))

			log.Printf("[WindowsService] Attempting to register agent with %s...", m.serverAddr)
			if err := agent.Register(); err != nil {
				log.Printf("[WindowsService] Registration failed (%v). Retrying in 5 seconds...", err)
				conn.Close()
				time.Sleep(5 * time.Second)
				continue
			}

			log.Printf("[WindowsService] Agent registered successfully as %s. Starting background routines...", agent.ID)
			go agent.StartHeartbeat()
			go agent.StartCommandStream()
			break
		}
	}()

	for {
		select {
		case c := <-r:
			switch c.Cmd {
			case svc.Interrogate:
				changes <- c.CurrentStatus
			case svc.Stop, svc.Shutdown:
				changes <- svc.Status{State: svc.StopPending}
				cancel()
				agent.Stop()
				log.Println("[WindowsService] Agent service stopping...")
				return
			default:
				log.Printf("[WindowsService] Unexpected control request: %d", c.Cmd)
			}
		}
	}
}

func runService(serverAddr, token string) {
	err := svc.Run("ProxyManagerAgent", &agentService{serverAddr: serverAddr, token: token})
	if err != nil {
		log.Printf("Service Run failed: %v", err)
	}
}
