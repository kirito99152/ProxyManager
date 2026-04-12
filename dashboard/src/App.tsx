import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, 
  Server, 
  Network, 
  Activity, 
  Settings, 
  Shield, 
  LogOut, 
  Search, 
  Bell,
  MoreVertical,
  ArrowUpRight,
  ArrowDownRight,
  Wifi,
  WifiOff
} from 'lucide-react';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';

// --- Types ---
interface HardwareStats {
  cpu_usage: number;
  ram_total: number;
  ram_used: number;
  disk_free: number;
  net_in: number;
  net_out: number;
}

interface PortInfo {
  port: number;
  protocol: string;
  service_name: string;
}

interface Agent {
  id: string;
  hostname: string;
  os: string;
  private_ip: string;
  status: string;
  last_heartbeat: string;
  hardware_stats: string; // JSON
  open_ports: string;     // JSON
  created_at: string;
}

interface DashboardAgent extends Omit<Agent, 'hardware_stats' | 'open_ports'> {
  hardware?: HardwareStats;
  ports?: PortInfo[];
}

interface TrafficStats {
  total_rx: number;
  total_tx: number;
}

interface WSMessage {
  topic: string;
  payload: {
    agent_id: string;
    hardware: HardwareStats;
  };
}

// --- Utils ---
const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [agents, setAgents] = useState<DashboardAgent[]>([]);
  const [trafficStats, setTrafficStats] = useState<TrafficStats>({ total_rx: 0, total_tx: 0 });
  const [performanceHistory, setPerformanceHistory] = useState<{ time: string; cpu: number; ram: number }[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [totalBandwidth, setTotalBandwidth] = useState("0 B/s");
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch initial data
  const fetchData = async () => {
    try {
      const agentsRes = await fetch('/api/v1/agents');
      if (!agentsRes.ok) throw new Error('Failed to fetch agents');
      const agentsData: Agent[] = await agentsRes.json();
      
      const parsedAgents: DashboardAgent[] = agentsData.map(a => ({
        ...a,
        hardware: a.hardware_stats ? JSON.parse(a.hardware_stats) : undefined,
        ports: a.open_ports ? JSON.parse(a.open_ports) : []
      }));
      setAgents(parsedAgents);

      const trafficRes = await fetch('/api/v1/stats/traffic');
      if (trafficRes.ok) {
        const trafficData: TrafficStats = await trafficRes.json();
        setTrafficStats(trafficData);
      }
    } catch (err) {
      console.error('Data fetch error:', err);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  // WebSocket Connection
  useEffect(() => {
    const connectWS = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      // In development, you might need to hardcode the backend host if not proxied
      // But assuming same host for deployment
      const wsUrl = `${protocol}//${window.location.host}/api/v1/ws`;
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
        console.log('WebSocket Connected');
      };

      ws.onmessage = (event) => {
        try {
          const msg: WSMessage = JSON.parse(event.data);
          if (msg.topic === 'agent_heartbeat') {
            const { agent_id, hardware } = msg.payload;
            
            setAgents(prev => {
              const agentExists = prev.some(a => a.id === agent_id);
              if (!agentExists) {
                // If it's a new agent we don't know about, fetch full list
                fetchData();
                return prev;
              }
              return prev.map(a => 
                a.id === agent_id 
                  ? { ...a, status: 'online', hardware, last_heartbeat: new Date().toISOString() } 
                  : a
              );
            });

            // Update chart history
            const now = new Date();
            const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            
            setPerformanceHistory(prev => {
              const newEntry = {
                time: timeStr,
                cpu: Math.round(hardware.cpu_usage),
                ram: Math.round((hardware.ram_used / (hardware.ram_total || 1)) * 100)
              };
              const updated = [...prev, newEntry];
              return updated.slice(-20); // Keep last 20 points
            });

            // Update current bandwidth
            setTotalBandwidth(`${formatBytes(hardware.net_in + hardware.net_out)}/s`);
          }
        } catch (e) {
          console.error('WS Parse Error:', e);
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        console.log('WebSocket Disconnected. Reconnecting...');
        reconnectTimeoutRef.current = setTimeout(connectWS, 5000);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connectWS();

    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, []);

  // Calculations for stats cards
  const activeAgents = agents.filter(a => a.status === 'online').length;
  const totalPorts = agents.reduce((sum, a) => sum + (a.ports?.length || 0), 0);
  const totalTrafficFormatted = formatBytes(trafficStats.total_rx + trafficStats.total_tx);

  return (
    <div className="flex h-screen w-full bg-[#0a0a0c] text-white overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-64 glass border-r border-white/10 flex flex-col">
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-neon-blue to-neon-purple flex items-center justify-center shadow-lg shadow-neon-blue/20">
            <Shield className="text-white w-6 h-6" />
          </div>
          <span className="font-bold text-xl tracking-tight">ProxyManager</span>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2">
          <SidebarItem 
            icon={<LayoutDashboard size={20} />} 
            label="Dashboard" 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')} 
          />
          <SidebarItem 
            icon={<Server size={20} />} 
            label="Agents" 
            active={activeTab === 'agents'} 
            onClick={() => setActiveTab('agents')} 
          />
          <SidebarItem 
            icon={<Network size={20} />} 
            label="Proxies" 
            active={activeTab === 'proxies'} 
            onClick={() => setActiveTab('proxies')} 
          />
          <SidebarItem 
            icon={<Activity size={20} />} 
            label="Logs" 
            active={activeTab === 'logs'} 
            onClick={() => setActiveTab('logs')} 
          />
          <SidebarItem 
            icon={<Settings size={20} />} 
            label="Settings" 
            active={activeTab === 'settings'} 
            onClick={() => setActiveTab('settings')} 
          />
        </nav>

        <div className="p-6 border-t border-white/5">
          <button className="flex items-center gap-3 text-gray-400 hover:text-white transition-colors w-full">
            <LogOut size={20} />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-neon-blue/5 via-transparent to-transparent">
        {/* Header */}
        <header className="h-20 px-8 flex items-center justify-between border-b border-white/5 sticky top-0 bg-[#0a0a0c]/80 backdrop-blur-md z-10">
          <div className="relative w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Search agents, ports, IPs..." 
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 focus:outline-none focus:border-neon-blue/50 transition-colors"
            />
          </div>
          
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border ${
              wsConnected ? 'border-green-400/20 bg-green-400/10 text-green-400' : 'border-red-400/20 bg-red-400/10 text-red-400'
            }`}>
              {wsConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
              {wsConnected ? 'Real-time Connected' : 'Disconnected'}
            </div>
            <button className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors relative">
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-neon-blue rounded-full"></span>
            </button>
            <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-gray-700 to-gray-600 border border-white/20"></div>
          </div>
        </header>

        <div className="p-8">
          <div className="flex justify-between items-end mb-8">
            <div>
              <h1 className="text-3xl font-bold">Network Overview</h1>
              <p className="text-gray-400 mt-1">Real-time status of your proxy infrastructure</p>
            </div>
            <button className="bg-neon-blue text-black font-bold px-6 py-2.5 rounded-xl flex items-center gap-2 hover:bg-opacity-90 transition-all shadow-[0_0_20px_rgba(0,243,255,0.3)]">
              Add Agent
            </button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard 
              title="Total Agents" 
              value={agents.length.toString()} 
              change={activeAgents === agents.length ? "All Online" : `${activeAgents} Online`} 
              isPositive={activeAgents === agents.length} 
              icon={<Server className="text-neon-blue" />} 
            />
            <StatCard 
              title="Active Ports" 
              value={totalPorts.toString()} 
              change="+0" 
              isPositive={true} 
              icon={<Network className="text-neon-purple" />} 
            />
            <StatCard 
              title="Total Traffic" 
              value={totalTrafficFormatted} 
              change="Total RX/TX" 
              isPositive={true} 
              icon={<Activity className="text-green-400" />} 
            />
            <StatCard 
              title="System Uptime" 
              value={wsConnected ? "99.9%" : "OFFLINE"} 
              change={wsConnected ? "Stable" : "Check Conn"} 
              isPositive={wsConnected} 
              icon={<Shield className="text-yellow-400" />} 
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
            {/* Chart Area */}
            <div className="lg:col-span-2 glass rounded-2xl p-6 border border-white/10">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Activity className="text-neon-blue" size={20} />
                  Performance Metrics
                </h3>
                <div className="flex gap-2">
                  <span className="flex items-center gap-1.5 text-xs text-gray-400">
                    <span className="w-2 h-2 rounded-full bg-neon-blue"></span> CPU
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-gray-400">
                    <span className="w-2 h-2 rounded-full bg-neon-purple"></span> RAM
                  </span>
                </div>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={performanceHistory.length > 0 ? performanceHistory : [{time: 'Waiting...', cpu: 0, ram: 0}]}>
                    <defs>
                      <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00f3ff" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#00f3ff" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorRam" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#bc13fe" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#bc13fe" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                    <XAxis 
                      dataKey="time" 
                      stroke="#ffffff40" 
                      fontSize={10} 
                      tickLine={false} 
                      axisLine={false} 
                    />
                    <YAxis 
                      stroke="#ffffff40" 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false} 
                      domain={[0, 100]}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1a1a1c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                      itemStyle={{ color: '#fff' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="cpu" 
                      stroke="#00f3ff" 
                      fillOpacity={1} 
                      fill="url(#colorCpu)" 
                      strokeWidth={3}
                      isAnimationActive={false}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="ram" 
                      stroke="#bc13fe" 
                      fillOpacity={1} 
                      fill="url(#colorRam)" 
                      strokeWidth={3}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Quick Actions / Stats */}
            <div className="glass rounded-2xl p-6 border border-white/10 flex flex-col justify-between">
              <h3 className="text-xl font-bold mb-4">Resource Distribution</h3>
              <div className="space-y-6">
                {agents.slice(0, 4).map((a, idx) => (
                  <ResourceBar 
                    key={a.id} 
                    label={a.hostname} 
                    percentage={a.hardware ? Math.round(a.hardware.cpu_usage) : 0} 
                    color={idx === 0 ? "bg-neon-blue" : idx === 1 ? "bg-neon-purple" : idx === 2 ? "bg-green-400" : "bg-yellow-400"} 
                  />
                ))}
                {agents.length === 0 && <p className="text-gray-500 text-sm">No agents connected</p>}
              </div>
              <div className="mt-8 p-4 rounded-xl bg-white/5 border border-white/5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400 font-medium">Network I/O</span>
                  <span className={`text-[10px] ${wsConnected ? 'text-neon-blue' : 'text-red-400'}`}>
                    {wsConnected ? 'Real-time updates' : 'Paused'}
                  </span>
                </div>
                <div className="text-2xl font-mono font-bold">{totalBandwidth}</div>
              </div>
            </div>
          </div>

          {/* Agents Table */}
          <div className="glass rounded-2xl border border-white/10 overflow-hidden">
            <div className="p-6 border-b border-white/5 flex justify-between items-center">
              <h3 className="text-xl font-bold">Connected Agents</h3>
              <button className="text-sm text-neon-blue hover:underline">View All</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-white/5 text-gray-400 text-sm uppercase tracking-wider">
                    <th className="px-6 py-4 font-semibold">Agent Name</th>
                    <th className="px-6 py-4 font-semibold">IP Address</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                    <th className="px-6 py-4 font-semibold">Load (CPU/RAM)</th>
                    <th className="px-6 py-4 font-semibold">Ports</th>
                    <th className="px-6 py-4 font-semibold">Network Speed</th>
                    <th className="px-6 py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {agents.map((agent) => (
                    <tr key={agent.id} className="hover:bg-white/5 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                            <Server size={14} className="text-gray-400" />
                          </div>
                          <div>
                            <div className="font-medium">{agent.hostname}</div>
                            <div className="text-[10px] text-gray-500 uppercase">{agent.os}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-400 font-mono text-sm">{agent.private_ip}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          agent.status === 'online' 
                            ? 'bg-green-400/10 text-green-400' 
                            : 'bg-red-400/10 text-red-400'
                        }`}>
                          {agent.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1 w-24">
                          <div className="flex justify-between text-[10px] text-gray-500">
                            <span>CPU: {agent.hardware ? Math.round(agent.hardware.cpu_usage) : 0}%</span>
                            <span>RAM: {agent.hardware ? Math.round((agent.hardware.ram_used/agent.hardware.ram_total)*100) : 0}%</span>
                          </div>
                          <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-neon-blue transition-all duration-500" 
                              style={{ width: `${agent.hardware ? agent.hardware.cpu_usage : 0}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium">{agent.ports?.length || 0}</td>
                      <td className="px-6 py-4 text-gray-400 text-sm">
                        <div className="flex flex-col">
                          <span className="flex items-center gap-1"><ArrowUpRight size={10} className="text-green-400"/> {formatBytes(agent.hardware?.net_out || 0)}/s</span>
                          <span className="flex items-center gap-1"><ArrowDownRight size={10} className="text-neon-blue"/> {formatBytes(agent.hardware?.net_in || 0)}/s</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="opacity-0 group-hover:opacity-100 p-2 hover:bg-white/10 rounded-lg transition-all">
                          <MoreVertical size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {agents.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                        No agents connected to the system.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

// --- Subcomponents ---
const SidebarItem: React.FC<{ 
  icon: React.ReactNode; 
  label: string; 
  active?: boolean; 
  onClick?: () => void 
}> = ({ icon, label, active, onClick }) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
      active 
        ? 'bg-neon-blue text-black font-bold shadow-[0_0_15px_rgba(0,243,255,0.4)]' 
        : 'text-gray-400 hover:text-white hover:bg-white/5'
    }`}
  >
    {icon}
    <span>{label}</span>
  </button>
);

const StatCard: React.FC<{ 
  title: string; 
  value: string; 
  change: string; 
  isPositive: boolean; 
  icon: React.ReactNode 
}> = ({ title, value, change, isPositive, icon }) => (
  <div className="glass rounded-2xl p-6 border border-white/10 group hover:border-neon-blue/30 transition-all duration-300">
    <div className="flex justify-between items-start mb-4">
      <div className="p-3 rounded-xl bg-white/5 group-hover:scale-110 transition-transform duration-300">
        {icon}
      </div>
      <span className={`flex items-center gap-1 text-xs font-bold ${
        isPositive ? 'text-green-400' : 'text-red-400'
      }`}>
        {isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
        {change}
      </span>
    </div>
    <h4 className="text-gray-400 text-sm font-medium">{title}</h4>
    <div className="text-2xl font-bold mt-1 tracking-tight">{value}</div>
  </div>
);

const ResourceBar: React.FC<{ label: string; percentage: number; color: string }> = ({ label, percentage, color }) => (
  <div className="space-y-2">
    <div className="flex justify-between text-sm">
      <span className="text-gray-400 font-medium truncate max-w-[120px]">{label}</span>
      <span className="font-bold">{percentage}%</span>
    </div>
    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
      <div 
        className={`h-full ${color} rounded-full transition-all duration-500`} 
        style={{ width: `${percentage}%` }}
      ></div>
    </div>
  </div>
);

export default App;
