import React, { useState } from 'react';
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
  ArrowDownRight
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

// Placeholder data
const hardwareStats = [
  { time: '10:00', cpu: 32, ram: 45 },
  { time: '10:05', cpu: 45, ram: 48 },
  { time: '10:10', cpu: 38, ram: 52 },
  { time: '10:15', cpu: 51, ram: 55 },
  { time: '10:20', cpu: 42, ram: 53 },
  { time: '10:25', cpu: 35, ram: 50 },
  { time: '10:30', cpu: 48, ram: 58 },
];

const agents = [
  { id: 1, name: 'Main-Srv-01', ip: '192.168.1.10', status: 'Online', cpu: '12%', ram: '1.2GB', ports: 5, traffic: '12.4 GB' },
  { id: 2, name: 'Backup-Node', ip: '192.168.1.11', status: 'Online', cpu: '8%', ram: '800MB', ports: 2, traffic: '4.1 GB' },
  { id: 3, name: 'Edge-West-01', ip: '45.77.12.33', status: 'Offline', cpu: '0%', ram: '0MB', ports: 12, traffic: '156.8 GB' },
  { id: 4, name: 'Dev-Sandbox', ip: '10.0.0.5', status: 'Online', cpu: '25%', ram: '2.4GB', ports: 1, traffic: '512 MB' },
  { id: 5, name: 'Prod-Proxy-L1', ip: '172.16.0.4', status: 'Online', cpu: '42%', ram: '4.1GB', ports: 8, traffic: '89.2 GB' },
];

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');

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
              value="42" 
              change="+3" 
              isPositive={true} 
              icon={<Server className="text-neon-blue" />} 
            />
            <StatCard 
              title="Active Ports" 
              value="156" 
              change="+12" 
              isPositive={true} 
              icon={<Network className="text-neon-purple" />} 
            />
            <StatCard 
              title="Monthly Traffic" 
              value="2.4 TB" 
              change="-14%" 
              isPositive={false} 
              icon={<Activity className="text-green-400" />} 
            />
            <StatCard 
              title="System Uptime" 
              value="99.9%" 
              change="Stable" 
              isPositive={true} 
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
                  <AreaChart data={hardwareStats}>
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
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false} 
                    />
                    <YAxis 
                      stroke="#ffffff40" 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false} 
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
                    />
                    <Area 
                      type="monotone" 
                      dataKey="ram" 
                      stroke="#bc13fe" 
                      fillOpacity={1} 
                      fill="url(#colorRam)" 
                      strokeWidth={3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Quick Actions / Stats */}
            <div className="glass rounded-2xl p-6 border border-white/10 flex flex-col justify-between">
              <h3 className="text-xl font-bold mb-4">Resource Distribution</h3>
              <div className="space-y-6">
                <ResourceBar label="Europe-West" percentage={65} color="bg-neon-blue" />
                <ResourceBar label="US-East" percentage={42} color="bg-neon-purple" />
                <ResourceBar label="Asia-South" percentage={28} color="bg-green-400" />
                <ResourceBar label="South-America" percentage={15} color="bg-yellow-400" />
              </div>
              <div className="mt-8 p-4 rounded-xl bg-white/5 border border-white/5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400 font-medium">Total Bandwidth</span>
                  <span className="text-xs text-neon-blue">Auto-scaling active</span>
                </div>
                <div className="text-2xl font-mono font-bold">1.28 GB/s</div>
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
                    <th className="px-6 py-4 font-semibold">Traffic</th>
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
                          <span className="font-medium">{agent.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-400 font-mono text-sm">{agent.ip}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          agent.status === 'Online' 
                            ? 'bg-green-400/10 text-green-400' 
                            : 'bg-red-400/10 text-red-400'
                        }`}>
                          {agent.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1 w-24">
                          <div className="flex justify-between text-[10px] text-gray-500">
                            <span>{agent.cpu}</span>
                            <span>{agent.ram}</span>
                          </div>
                          <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-neon-blue" style={{ width: agent.cpu }}></div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium">{agent.ports}</td>
                      <td className="px-6 py-4 text-gray-400">{agent.traffic}</td>
                      <td className="px-6 py-4 text-right">
                        <button className="opacity-0 group-hover:opacity-100 p-2 hover:bg-white/10 rounded-lg transition-all">
                          <MoreVertical size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

// Subcomponents
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
      <span className="text-gray-400 font-medium">{label}</span>
      <span className="font-bold">{percentage}%</span>
    </div>
    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
      <div 
        className={`h-full ${color} rounded-full`} 
        style={{ width: `${percentage}%` }}
      ></div>
    </div>
  </div>
);

export default App;
