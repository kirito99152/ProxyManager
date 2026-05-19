//go:build windows
package main

import (
	"log"

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

	conn, err := grpc.NewClient(m.serverAddr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		log.Printf("did not connect: %v", err)
		return false, 1
	}
	defer conn.Close()

	client := pb.NewAgentServiceClient(conn)
	agent := &Agent{
		ServerAddr: m.serverAddr,
		Token:      m.token,
		Client:     client,
	}

	if err := agent.Register(); err != nil {
		log.Printf("failed to register: %v", err)
		return false, 2
	}

	go agent.StartHeartbeat()
	go agent.StartCommandStream()

	changes <- svc.Status{State: svc.Running, Accepts: cmdsAccepted}

	for {
		select {
		case c := <-r:
			switch c.Cmd {
			case svc.Interrogate:
				changes <- c.CurrentStatus
			case svc.Stop, svc.Shutdown:
				changes <- svc.Status{State: svc.StopPending}
				agent.Stop()
				log.Println("Agent service stopping...")
				return
			default:
				log.Printf("Unexpected control request: %d", c.Cmd)
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
