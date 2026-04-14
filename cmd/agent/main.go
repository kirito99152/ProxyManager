package main

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/mem"
	psnet "github.com/shirou/gopsutil/v3/net"
	"github.com/shirou/gopsutil/v3/process"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"

	pb "github.com/kirito99152/ProxyManager/internal/api"
)

type Agent struct {
	ID                 string
	Token              string
	ServerAddr         string
	FRPServerAddr      string
	FRPServerPort      string
	FRPToken           string
	FRPCConfigTemplate string
	Client             pb.AgentServiceClient

	frpcProcess *exec.Cmd
	frpcMu      sync.Mutex

	lastNetIn  uint64
	lastNetOut uint64
}

func main() {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("Recovered from panic: %v", r)
			time.Sleep(5 * time.Second)
			main() // Auto-restart in same process (fallback)
		}
	}()
	serverAddr := os.Getenv("SERVER_ADDR")
	if serverAddr == "" {
		serverAddr = "10.0.3.98:50051"
	}

	conn, err := grpc.NewClient(serverAddr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		log.Fatalf("did not connect: %v", err)
	}
	defer conn.Close()

	client := pb.NewAgentServiceClient(conn)
	agent := &Agent{
		ServerAddr: serverAddr,
		Token:      os.Getenv("AGENT_AUTH_TOKEN"),
		Client:     client,
	}

	if err := agent.Register(); err != nil {
		log.Fatalf("failed to register: %v", err)
	}

	go agent.StartHeartbeat()
	go agent.StartCommandStream()

	// Check for auth log file existence
	authLogPath := "/var/log/auth.log"
	if _, err := os.Stat(authLogPath); os.IsNotExist(err) {
		authLogPath = "/var/log/secure" // Fallback for RHEL/CentOS
		if _, err := os.Stat(authLogPath); os.IsNotExist(err) {
			log.Println("No standard auth log file found. Skipping log forwarder.")
			authLogPath = ""
		}
	}

	if authLogPath != "" {
		go agent.StartLogForwarder(authLogPath, "auth.log")
	}

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
	log.Println("Agent stopping...")
}

func (a *Agent) getContext() context.Context {
	md := metadata.New(map[string]string{"authorization": a.Token})
	return metadata.NewOutgoingContext(context.Background(), md)
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

	ctx, cancel := context.WithTimeout(a.getContext(), 10*time.Second)
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

	if strings.TrimSpace(a.FRPCConfigTemplate) != "" {
		log.Printf("Restoring FRPC config from server for agent %s", a.ID)
		a.reloadFRPC(a.FRPCConfigTemplate)
	}

	log.Printf("Registered with ID: %s", a.ID)
	return nil
}

func (a *Agent) StartHeartbeat() {
	ticker := time.NewTicker(5 * time.Second)
	for range ticker.C {
		stats := a.getHardwareStats()
		ports := a.getOpenPorts()
		services := a.getServiceStatus([]string{"ssh", "docker", "frpc"})

		req := &pb.ReportRequest{
			AgentId:   a.ID,
			Hardware:  stats,
			OpenPorts: ports,
			Services:  services,
		}

		ctx, cancel := context.WithTimeout(a.getContext(), 3*time.Second)
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
	ctx := a.getContext()
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
			go a.StartCommandStream()
			return
		}

		log.Printf("Received command: %s", cmd.Action)
		a.handleCommand(cmd)
	}
}

func (a *Agent) handleCommand(cmd *pb.Command) {
	switch cmd.Action {
	case "RELOAD_FRPC":
		a.reloadFRPC(cmd.Payload)
	case "RESTART_AGENT":
		os.Exit(0)
	case "REMOTE_EXEC":
		a.remoteExec(cmd.Payload)
	case "UPGRADE_AGENT":
		a.autoUpdate(cmd.Payload)
	default:
		log.Printf("Unknown command: %s", cmd.Action)
	}
}

func (a *Agent) remoteExec(script string) {
	log.Printf("Executing remote script...")
	cmd := exec.Command("sh", "-c", script)
	output, err := cmd.CombinedOutput()
	if err != nil {
		log.Printf("Remote exec failed: %v, Output: %s", err, string(output))
		return
	}
	log.Printf("Remote exec output: %s", string(output))
}

func (a *Agent) autoUpdate(url string) {
	log.Printf("Starting auto-update from %s", url)
	resp, err := http.Get(url)
	if err != nil {
		log.Printf("Download failed: %v", err)
		return
	}
	defer resp.Body.Close()

	out, err := os.Create("agent_new")
	if err != nil {
		log.Printf("Create file failed: %v", err)
		return
	}
	defer out.Close()
	io.Copy(out, resp.Body)

	os.Chmod("agent_new", 0755)
	log.Println("Update downloaded. Restarting...")
	os.Rename("agent_new", os.Args[0])
	os.Exit(0)
}

func (a *Agent) StartLogForwarder(filePath string, source string) {
	file, err := os.Open(filePath)
	if err != nil {
		log.Printf("Failed to open log file %s: %v", filePath, err)
		return
	}
	defer file.Close()

	file.Seek(0, io.SeekEnd)
	reader := bufio.NewReader(file)

	for {
		line, err := reader.ReadString('\n')
		if err != nil {
			if err == io.EOF {
				time.Sleep(1 * time.Second)
				continue
			}
			break
		}

		entry := &pb.LogEntry{
			AgentId:   a.ID,
			Timestamp: time.Now().Format(time.RFC3339),
			LogLevel:  "INFO",
			Source:    source,
			Message:   strings.TrimSpace(line),
		}

		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		a.Client.ForwardLog(ctx, entry)
		cancel()
	}
}

func (a *Agent) getServiceStatus(serviceNames []string) []*pb.ServiceInfo {
	var services []*pb.ServiceInfo
	for _, name := range serviceNames {
		status := "stopped"
		cmd := exec.Command("systemctl", "is-active", name)
		if err := cmd.Run(); err == nil {
			status = "running"
		}
		services = append(services, &pb.ServiceInfo{
			Name:   name,
			Status: status,
		})
	}
	return services
}

func (a *Agent) reloadFRPC(config string) {
	a.frpcMu.Lock()
	defer a.frpcMu.Unlock()

	if a.frpcProcess != nil && a.frpcProcess.Process != nil {
		a.frpcProcess.Process.Signal(syscall.SIGTERM)
		a.frpcProcess.Wait()
	}

	frpcPath := "./frpc"
	os.WriteFile("frpc.yaml", []byte(config), 0644)
	a.frpcProcess = exec.Command(frpcPath, "-c", "frpc.yaml")
	a.frpcProcess.Start()
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
		CpuUsage: cpuPercent,
		RamTotal: vMem.Total,
		RamUsed:  vMem.Used,
		DiskFree: dUsage.Free,
		NetIn:    netIn,
		NetOut:   netOut,
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

			serviceName := "Unknown"
			if conn.Pid > 0 {
				proc, err := process.NewProcess(conn.Pid)
				if err == nil {
					name, _ := proc.Name()
					serviceName = fmt.Sprintf("%s (PID: %d)", name, conn.Pid)
				}
			}

			ports = append(ports, &pb.PortInfo{
				Port:        int32(conn.Laddr.Port),
				Protocol:    "tcp",
				ServiceName: serviceName,
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
