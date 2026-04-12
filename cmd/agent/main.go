package main

import (
	"context"
	"fmt"
	"log"
	"net"
	"os"
	"os/exec"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/mem"
	psnet "github.com/shirou/gopsutil/v3/net"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	pb "github.com/kirito99152/ProxyManager/internal/api"
)

type Agent struct {
	ID                 string
	ServerAddr         string
	FRPServerAddr      string
	FRPServerPort      string
	FRPToken           string
	FRPCConfigTemplate string
	Client             pb.AgentServiceClient

	frpcProcess *exec.Cmd
	frpcMu      sync.Mutex

	// Milestone #2: Network stats tracking
	lastNetIn  uint64
	lastNetOut uint64
}

func main() {
	serverAddr := os.Getenv("SERVER_ADDR")
	if serverAddr == "" {
		serverAddr = "10.0.3.98:50051" // Updated with Agent #1's Server IP
	}

	conn, err := grpc.NewClient(serverAddr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		log.Fatalf("did not connect: %v", err)
	}
	defer conn.Close()

	client := pb.NewAgentServiceClient(conn)
	agent := &Agent{
		ServerAddr: serverAddr,
		Client:     client,
	}

	// 1. Register
	if err := agent.Register(); err != nil {
		log.Fatalf("failed to register: %v", err)
	}

	// 2. Start Heartbeat (High-frequency for Milestone #2)
	go agent.StartHeartbeat()

	// 3. Start Command Stream
	go agent.StartCommandStream()

	// Wait for interrupt
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
	log.Println("Agent stopping...")
}

func (a *Agent) Register() error {
	hostname, _ := os.Hostname()
	hInfo, _ := host.Info()
	privateIP := getPrivateIP()

	req := &pb.RegisterRequest{
		Hostname:  hostname,
		Os:        fmt.Sprintf("%s %s", hInfo.OS, hInfo.PlatformVersion),
		PrivateIp: privateIP,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	resp, err := a.Client.Register(ctx, req)
	if err != nil {
		return err
	}

	a.ID = resp.AgentId
	a.FRPCConfigTemplate = resp.FrpcConfigTemplate
	a.FRPServerAddr = resp.FrpServerAddr
	a.FRPServerPort = resp.FrpServerPort
	a.FRPToken = resp.FrpToken

	log.Printf("Registered with ID: %s", a.ID)
	return nil
}

func (a *Agent) StartHeartbeat() {
	// Milestone #2: High-frequency mode (5 seconds)
	ticker := time.NewTicker(5 * time.Second)
	for range ticker.C {
		stats := a.getHardwareStats()
		ports := a.getOpenPorts()

		req := &pb.ReportRequest{
			AgentId:   a.ID,
			Hardware:  stats,
			OpenPorts: ports,
		}

		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		resp, err := a.Client.Heartbeat(ctx, req)
		cancel()

		if err != nil {
			log.Printf("Heartbeat failed: %v", err)
			continue
		}

		if !resp.Success {
			log.Printf("Heartbeat rejected: %s", resp.Message)
		}
	}
}

func (a *Agent) StartCommandStream() {
	ctx := context.Background()
	stream, err := a.Client.CommandStream(ctx, &pb.AgentID{AgentId: a.ID})
	if err != nil {
		log.Printf("CommandStream failed: %v", err)
		return
	}

	for {
		cmd, err := stream.Recv()
		if err != nil {
			log.Printf("CommandStream Recv failed: %v", err)
			time.Sleep(5 * time.Second)
			go a.StartCommandStream() // Reconnect
			return
		}

		log.Printf("Received command: %s", cmd.Action)
		a.handleCommand(cmd)
	}
}

func (a *Agent) handleCommand(cmd *pb.Command) {
	switch cmd.Action {
	case "RELOAD_FRPC":
		log.Println("Reloading FRPC...")
		a.reloadFRPC(cmd.Payload)
	case "RESTART_AGENT":
		log.Println("Restarting Agent...")
		os.Exit(0)
	default:
		log.Printf("Unknown command: %s", cmd.Action)
	}
}

func (a *Agent) reloadFRPC(config string) {
	a.frpcMu.Lock()
	defer a.frpcMu.Unlock()

	if a.frpcProcess != nil && a.frpcProcess.Process != nil {
		a.frpcProcess.Process.Signal(syscall.SIGTERM)
		a.frpcProcess.Wait()
	}

	frpcPath := "./frpc"
	if _, err := os.Stat(frpcPath); os.IsNotExist(err) {
		a.downloadFRP()
	}

	os.WriteFile("frpc.yaml", []byte(config), 0644)
	a.frpcProcess = exec.Command(frpcPath, "-c", "frpc.yaml")
	a.frpcProcess.Start()
}

func (a *Agent) downloadFRP() {
	exec.Command("wget", "https://github.com/fatedier/frp/releases/download/v0.68.0/frp_0.68.0_linux_amd64.tar.gz", "-O", "frp.tar.gz").Run()
	exec.Command("tar", "-xvzf", "frp.tar.gz").Run()
	exec.Command("cp", "frp_0.68.0_linux_amd64/frpc", ".").Run()
}

func (a *Agent) getHardwareStats() *pb.HardwareStats {
	cUsage, _ := cpu.Percent(0, false)
	vMem, _ := mem.VirtualMemory()
	dUsage, _ := disk.Usage("/")
	io, _ := psnet.IOCounters(false)

	var cpuPercent float64
	if len(cUsage) > 0 {
		cpuPercent = cUsage[0]
	}

	var netIn, netOut uint64
	if len(io) > 0 {
		currentIn := io[0].BytesRecv
		currentOut := io[0].BytesSent
		
		if a.lastNetIn > 0 {
			netIn = currentIn - a.lastNetIn
		}
		if a.lastNetOut > 0 {
			netOut = currentOut - a.lastNetOut
		}
		
		a.lastNetIn = currentIn
		a.lastNetOut = currentOut
	}

	return &pb.HardwareStats{
		CpuUsage:  cpuPercent,
		RamTotal:  vMem.Total,
		RamUsed:   vMem.Used,
		DiskFree:  dUsage.Free,
		NetIn:     netIn,
		NetOut:    netOut,
	}
}

func (a *Agent) getOpenPorts() []*pb.PortInfo {
	var ports []*pb.PortInfo
	conns, _ := psnet.Connections("all")
	seen := make(map[uint32]bool)
	for _, conn := range conns {
		if conn.Status == "LISTEN" {
			if seen[conn.Laddr.Port] {
				continue
			}
			seen[conn.Laddr.Port] = true
			ports = append(ports, &pb.PortInfo{
				Port: int32(conn.Laddr.Port),
				Protocol: "tcp",
			})
		}
	}
	return ports
}

func getPrivateIP() string {
	ifaces, _ := net.Interfaces()
	for _, iface := range ifaces {
		addrs, _ := iface.Addrs()
		for _, addr := range addrs {
			if ipnet, ok := addr.(*net.IPNet); ok && !ipnet.IP.IsLoopback() {
				if ipnet.IP.To4() != nil {
					return ipnet.IP.String()
				}
			}
		}
	}
	return ""
}
