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

	lastNetIn             uint64
	lastNetOut            uint64
	reportedMissing       map[string]bool
}

const Version = "1.1.0"

// forwardLog sends a single log entry to the server
func (a *Agent) forwardLog(level, source, message string) {
	if a.ID == "" || a.Client == nil {
		return
	}
	entry := &pb.LogEntry{
		AgentId:   a.ID,
		Timestamp: time.Now().Format(time.RFC3339),
		LogLevel:  level,
		Source:    source,
		Message:   strings.TrimSpace(message),
	}
	ctx, cancel := context.WithTimeout(a.getContext(), 2*time.Second)
	defer cancel()
	a.Client.ForwardLog(ctx, entry)
}

func (a *Agent) Stop() {
	a.frpcMu.Lock()
	defer a.frpcMu.Unlock()
	if a.frpcProcess != nil && a.frpcProcess.Process != nil {
		a.forwardLog("INFO", "agent", "Stopping FRPC process...")
		if runtime.GOOS == "windows" {
			a.frpcProcess.Process.Kill()
		} else {
			a.frpcProcess.Process.Signal(syscall.SIGTERM)
		}
		a.frpcProcess.Wait()
	}
}

// LogRedirector capture internal logs and sends them to server
type LogRedirector struct {
	agent *Agent
}

func (r *LogRedirector) Write(p []byte) (n int, err error) {
	msg := string(p)
	fmt.Print(msg)
	if r.agent != nil && r.agent.ID != "" {
		go r.agent.forwardLog("INFO", "agent", msg)
	}
	return len(p), nil
}

func main() {
	execPath, err := os.Executable()
	if err == nil {
		os.Chdir(filepath.Dir(execPath))
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
	versionFlag := flag.Bool("version", false, "Print version and exit")
	flag.Parse()

	if *versionFlag {
		fmt.Printf("v%s\n", Version)
		return
	}

	serverAddr := *serverAddrFlag
	if serverAddr == "" {
		serverAddr = os.Getenv("SERVER_ADDR")
	}
	if serverAddr == "" {
		serverAddr = "localhost:50051"
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
		ServerAddr:      serverAddr,
		Token:           token,
		Client:          client,
		reportedMissing: make(map[string]bool),
	}

	if err := agent.Register(); err != nil {
		log.Fatalf("failed to register: %v", err)
	}

	redirector := &LogRedirector{agent: agent}
	log.SetOutput(io.MultiWriter(os.Stdout, redirector))

	log.Printf("Agent %s starting background routines...", agent.ID)

	go agent.StartHeartbeat()
	go agent.StartCommandStream()

	authLogPath := "/var/log/auth.log"
	if runtime.GOOS == "windows" {
		authLogPath = ""
	} else if _, err := os.Stat(authLogPath); os.IsNotExist(err) {
		authLogPath = "/var/log/secure"
		if _, err := os.Stat(authLogPath); os.IsNotExist(err) {
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
	machineID := hInfo.HostID
	
	if machineID == "" {
		if runtime.GOOS == "linux" {
			if b, err := os.ReadFile("/etc/machine-id"); err == nil {
				machineID = strings.TrimSpace(string(b))
			}
		}
	}

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

	log.Printf("Registered with ID: %s", a.ID)
	return nil
}

func (a *Agent) StartHeartbeat() {
	ticker := time.NewTicker(5 * time.Second)
	for range ticker.C {
		// --- Component Tracking ---
		essentialFiles := []string{"frpc"}
		if runtime.GOOS == "windows" {
			essentialFiles = []string{"frpc.exe"}
		}

		// Only check frpc.yaml if we have a config template (meaning a proxy is active)
		if strings.TrimSpace(a.FRPCConfigTemplate) != "" {
			essentialFiles = append(essentialFiles, "frpc.yaml")
		}

		// Check the agent binary itself
		agentBin := "./agent"
		if runtime.GOOS == "windows" {
			agentBin = "./agent.exe"
		}
		essentialFiles = append(essentialFiles, agentBin)

		for _, file := range essentialFiles {
			if _, err := os.Stat(file); os.IsNotExist(err) {
				if !a.reportedMissing[file] {
					msg := fmt.Sprintf("CRITICAL COMPONENT MISSING: %s is not found in the agent directory!", file)
					log.Println(msg)
					a.forwardLog("ERROR", "agent", msg)
					a.reportedMissing[file] = true
				}
			} else {
				if a.reportedMissing[file] {
					msg := fmt.Sprintf("RECOVERED: Component %s has been restored.", file)
					log.Println(msg)
					a.forwardLog("INFO", "agent", msg)
					a.reportedMissing[file] = false
				}
			}
		}
		// --- End Component Tracking ---

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
			continue
		}

		if !resp.Success {
			log.Printf("Heartbeat rejected: %s", resp.Message)
		} else {
			// Auto-upgrade check
			if resp.LatestVersion != "" && resp.LatestVersion != Version {
				log.Printf("New version detected: %s (current: %s). Starting auto-upgrade...", resp.LatestVersion, Version)
				
				// Construct download URL based on OS/Arch
				osName := runtime.GOOS
				arch := runtime.GOARCH
				filename := fmt.Sprintf("agent-%s-%s", osName, arch)
				if osName == "windows" {
					filename += ".exe"
				}
				
				upgradeURL := fmt.Sprintf("%s/%s", resp.UpgradeUrl, filename)
				log.Printf("Downloading upgrade from: %s", upgradeURL)
				go a.autoUpdate(upgradeURL)
			}
		}
	}
}

func (a *Agent) StartCommandStream() {
	for {
		ctx := a.getContext()
		stream, err := a.Client.CommandStream(ctx, &pb.AgentID{AgentId: a.ID})
		if err != nil {
			time.Sleep(5 * time.Second)
			continue
		}

		for {
			cmd, err := stream.Recv()
			if err != nil {
				break
			}
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
	}
}

func (a *Agent) remoteExec(script string) {
	cmd := exec.Command("sh", "-c", script)
	stdout, _ := cmd.StdoutPipe()
	stderr, _ := cmd.StderrPipe()
	
	if err := cmd.Start(); err != nil {
		a.sendTerminalOutput(fmt.Sprintf("Error starting command: %v\n", err))
		return
	}

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
	a.forwardLog("INFO", "terminal", message)
}

func (a *Agent) autoUpdate(url string) {
	resp, err := http.Get(url)
	if err != nil {
		return
	}
	defer resp.Body.Close()

	out, err := os.Create("agent_new")
	if err != nil {
		return
	}
	defer out.Close()
	io.Copy(out, resp.Body)

	os.Chmod("agent_new", 0755)
	os.Rename("agent_new", os.Args[0])
	os.Exit(0)
}

func (a *Agent) StartLogForwarder(filePath string, source string) {
	file, err := os.Open(filePath)
	if err != nil {
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
		a.forwardLog("INFO", source, line)
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
		log.Println("Stopping existing FRPC process...")
		if runtime.GOOS == "windows" {
			a.frpcProcess.Process.Kill()
		} else {
			a.frpcProcess.Process.Signal(syscall.SIGTERM)
		}
		a.frpcProcess.Wait()
	}

	frpcPath := "./frpc"
	if runtime.GOOS == "windows" {
		frpcPath = "./frpc.exe"
	}
	os.WriteFile("frpc.yaml", []byte(config), 0644)
	
	a.frpcProcess = exec.Command(frpcPath, "-c", "frpc.yaml")
	stdout, _ := a.frpcProcess.StdoutPipe()
	stderr, _ := a.frpcProcess.StderrPipe()
	
	if err := a.frpcProcess.Start(); err != nil {
		log.Printf("Failed to start FRPC: %v", err)
		return
	}

	sendFRPCLogs := func(r io.Reader) {
		scanner := bufio.NewScanner(r)
		for scanner.Scan() {
			a.forwardLog("INFO", "frpc", scanner.Text())
		}
	}

	go sendFRPCLogs(stdout)
	go sendFRPCLogs(stderr)

	go func() {
		err := a.frpcProcess.Wait()
		log.Printf("FRPC process exited: %v", err)
		a.forwardLog("ERROR", "frpc", fmt.Sprintf("FRPC process exited: %v", err))
	}()
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
