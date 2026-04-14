package main

import (
	"bufio"
	"context"
	"flag"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"runtime"
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

const Version = "1.0.6"

func (a *Agent) Stop() {
	a.frpcMu.Lock()
	defer a.frpcMu.Unlock()
	if a.frpcProcess != nil && a.frpcProcess.Process != nil {
		log.Println("Stopping FRPC process...")
		if runtime.GOOS == "windows" {
			a.frpcProcess.Process.Kill()
		} else {
			a.frpcProcess.Process.Signal(syscall.SIGTERM)
		}
		a.frpcProcess.Wait()
	}
}

func main() {
	// Chuyển thư mục làm việc về thư mục chứa file thực thi
	execPath, err := os.Executable()
	if err == nil {
		os.Chdir(filepath.Dir(execPath))
	}

	// Thiết lập log ra file agent.log
	logFile, err := os.OpenFile("agent.log", os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
	if err == nil {
		log.SetOutput(io.MultiWriter(os.Stdout, logFile))
	}

	defer func() {
		if r := recover(); r != nil {
			log.Printf("Recovered from panic: %v", r)
			time.Sleep(5 * time.Second)
			main()
		}
	}()

	log.Printf("ProxyManager Agent v%s starting...", Version)

	serverAddrFlag := flag.String("server", "", "Server address (IP:Port)")
	tokenFlag := flag.String("token", "", "Agent authentication token")
	flag.Parse()

	serverAddr := *serverAddrFlag
	if serverAddr == "" {
		serverAddr = os.Getenv("SERVER_ADDR")
	}
	if serverAddr == "" {
		serverAddr = "160.191.50.208:50051"
	}

	token := *tokenFlag
	if token == "" {
		token = os.Getenv("AGENT_AUTH_TOKEN")
	}

	if isWindowsService() {
		runService(serverAddr, token)
		return
	}

	runAgent(serverAddr, token)
}

func runAgent(serverAddr, token string) {
	conn, err := grpc.NewClient(serverAddr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		log.Fatalf("did not connect: %v", err)
	}
	defer conn.Close()

	client := pb.NewAgentServiceClient(conn)
	agent := &Agent{
		ServerAddr: serverAddr,
		Token:      token,
		Client:     client,
	}

	if err := agent.Register(); err != nil {
		log.Fatalf("failed to register: %v", err)
	}

	go agent.StartHeartbeat()
	go agent.StartCommandStream()

	// Check for auth log file existence
	authLogPath := "/var/log/auth.log"
	if runtime.GOOS == "windows" {
		authLogPath = "" // No standard auth log file on Windows for now
	} else if _, err := os.Stat(authLogPath); os.IsNotExist(err) {
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
	agent.Stop()
}

func (a *Agent) getContext() context.Context {
	md := metadata.New(map[string]string{"authorization": a.Token})
	return metadata.NewOutgoingContext(context.Background(), md)
}

func (a *Agent) Register() error {
	hostname, _ := os.Hostname()
	hInfo, _ := host.Info()
	privateIP := getPrivateIP()

	// 1. Ưu tiên dùng gopsutil (nó đã tự đọc Registry trên Win và machine-id trên Linux)
	machineID := hInfo.HostID
	
	// 2. Fallback thủ công nếu gopsutil thất bại
	if machineID == "" {
		if runtime.GOOS == "linux" {
			if b, err := os.ReadFile("/etc/machine-id"); err == nil {
				machineID = strings.TrimSpace(string(b))
			}
		} else if runtime.GOOS == "windows" {
			// Trên Windows, nếu gopsutil fail thì thường là do quyền, 
			// nhưng ta vẫn có thể thử qua registry (giả định dùng thư viện chuẩn)
			log.Println("Warning: gopsutil failed to get MachineGuid on Windows")
		}
	}

	// Gửi kèm Machine ID vào trường Hostname bằng dấu #
	req := &pb.RegisterRequest{
		Hostname:  fmt.Sprintf("%s#%s", hostname, machineID),
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

	log.Printf("Registered with ID: %s (Machine ID: %s)", a.ID, machineID)
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
	for {
		ctx := a.getContext()
		stream, err := a.Client.CommandStream(ctx, &pb.AgentID{AgentId: a.ID})
		if err != nil {
			log.Printf("CommandStream failed, retrying in 5s: %v", err)
			time.Sleep(5 * time.Second)
			continue
		}

		log.Printf("CommandStream established with server")
		for {
			cmd, err := stream.Recv()
			if err != nil {
				log.Printf("CommandStream Recv failed, reconnecting: %v", err)
				break
			}

			log.Printf("Received command: %s", cmd.Action)
			go a.handleCommand(cmd)
		}
		time.Sleep(5 * time.Second)
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
	log.Printf("Executing remote script: %s", script)
	cmd := exec.Command("sh", "-c", script)
	
	stdout, _ := cmd.StdoutPipe()
	stderr, _ := cmd.StderrPipe()
	
	if err := cmd.Start(); err != nil {
		a.sendTerminalOutput(fmt.Sprintf("Error starting command: %v\n", err))
		return
	}

	// Helper to send line by line
	sendScanner := func(r io.Reader) {
		scanner := bufio.NewScanner(r)
		for scanner.Scan() {
			a.sendTerminalOutput(scanner.Text() + "\n")
		}
	}

	go sendScanner(stdout)
	go sendScanner(stderr)

	go func() {
		err := cmd.Wait()
		if err != nil {
			a.sendTerminalOutput(fmt.Sprintf("\nCommand exited with error: %v\n", err))
		} else {
			a.sendTerminalOutput("\n[Command finished]\n")
		}
	}()
}

func (a *Agent) sendTerminalOutput(message string) {
	entry := &pb.LogEntry{
		AgentId:   a.ID,
		Timestamp: time.Now().Format(time.RFC3339),
		LogLevel:  "INFO",
		Source:    "terminal",
		Message:   message,
	}
	ctx, cancel := context.WithTimeout(a.getContext(), 2*time.Second)
	defer cancel()
	_, err := a.Client.ForwardLog(ctx, entry)
	if err != nil {
		log.Printf("Failed to send terminal output to server: %v", err)
	}
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

		ctx, cancel := context.WithTimeout(a.getContext(), 2*time.Second)
		a.Client.ForwardLog(ctx, entry)
		cancel()
	}
}

func (a *Agent) getServiceStatus(serviceNames []string) []*pb.ServiceInfo {
	var services []*pb.ServiceInfo
	for _, name := range serviceNames {
		status := "stopped"
		if runtime.GOOS == "linux" {
			cmd := exec.Command("systemctl", "is-active", name)
			if err := cmd.Run(); err == nil {
				status = "running"
			}
		} else if runtime.GOOS == "windows" {
			// Basic check for Windows services
			cmd := exec.Command("powershell", "-Command", fmt.Sprintf("(Get-Service -Name %s).Status", name))
			output, err := cmd.Output()
			if err == nil && strings.TrimSpace(string(output)) == "Running" {
				status = "running"
			}
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
	if runtime.GOOS == "windows" {
		frpcPath = "./frpc.exe"
	}
	os.WriteFile("frpc.yaml", []byte(config), 0644)
	a.frpcProcess = exec.Command(frpcPath, "-c", "frpc.yaml")
	a.frpcProcess.Start()
}

func (a *Agent) getHardwareStats() *pb.HardwareStats {
	cUsage, _ := cpu.Percent(0, false)
	vMem, _ := mem.VirtualMemory()
	dUsage, _ := disk.Usage("/")
	if runtime.GOOS == "windows" {
		dUsage, _ = disk.Usage("C:")
	}
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
