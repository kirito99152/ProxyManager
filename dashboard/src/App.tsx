import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, 
  Server, 
  Network, 
  Activity, 
  Shield, 
  LogOut, 
  User, 
  ChevronRight, 
  Loader2, 
  Trash2, 
  Plus, 
  Edit2,
  Terminal, 
  FileText, 
  Cpu, 
  Monitor,
  Settings,
  Copy,
  Check,
  Download
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
interface User {
  username: string;
  role: string;
  email: string;
  avatar?: string;
}

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
  hardware_stats: string; 
  open_ports: string;     
  created_at: string;
}

interface DashboardAgent extends Omit<Agent, 'hardware_stats' | 'open_ports'> {
  hardware?: HardwareStats;
  ports?: PortInfo[];
}

interface LogEntry {
  id: string;
  agent_id: string;
  agent_name: string;
  severity: string;
  message: string;
  timestamp: string;
}

interface SettingEntry {
  key: string;
  value: string;
}

interface TrafficStats {
  total_rx: number;
  total_tx: number;
}

interface HardwareHistoryEntry {
  id: number;
  agent_id: string;
  cpu_usage: number;
  ram_used: number;
  ram_total: number;
  network_rx: number;
  network_tx: number;
  created_at: string;
}

interface WSMessage {
  topic: string;
  payload: any;
}

interface Proxy {
  id: number;
  agent_id: string;
  name: string;
  proxy_type: 'tcp' | 'udp' | 'http' | 'https';
  local_ip: string;
  local_port: number;
  remote_port?: number;
  custom_domain?: string;
  status: 'active' | 'inactive';
}

// --- Utils ---
const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// --- Auth Helpers ---
const setAuthData = (token: string, user: User) => {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
};
const clearAuthData = () => { localStorage.removeItem('token'); localStorage.removeItem('user'); };
const getAuthToken = () => localStorage.getItem('token');
const parseJWTPayload = (token: string) => {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(atob(normalized).split('').map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`).join(''));
    return JSON.parse(json);
  } catch {
    return null;
  }
};
const isStoredTokenValid = (token: string | null) => {
  if (!token) return false;
  const payload = parseJWTPayload(token);
  if (!payload?.exp) return true;
  return Date.now() < payload.exp * 1000;
};
const getAuthUser = (): User | null => {
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
};
const getInitialAuthState = () => {
  const token = getAuthToken();
  if (!isStoredTokenValid(token)) {
    clearAuthData();
    return { token: null, user: null, isAuthenticated: false };
  }
  return { token, user: getAuthUser(), isAuthenticated: !!token };
};

const copyToClipboard = async (value: string) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textArea = document.createElement('textarea');
  textArea.value = value;
  textArea.style.position = 'fixed';
  textArea.style.opacity = '0';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  document.execCommand('copy');
  document.body.removeChild(textArea);
};

// --- Components ---
const LoginPage: React.FC<{ onLogin: (token: string, user: User) => void }> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (!res.ok) throw new Error('Invalid credentials');
      const data = await res.json();
      onLogin(data.token, {
        username: data.user.username,
        role: data.user.role,
        email: `${data.user.username}@c500.net`,
        avatar: `https://ui-avatars.com/api/?name=${data.user.username}&background=00f3ff`
      });
    } catch (err: any) { setError(err.message); } finally { setLoading(false); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0c] font-sans">
      <div className="glass w-full max-w-md p-10 rounded-[32px] border border-white/10">
        <div className="flex flex-col items-center mb-10">
          <Shield className="text-neon-blue w-12 h-12 mb-4" />
          <h1 className="text-3xl font-bold text-white">ProxyManager</h1>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6 text-white">
          <input type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white" placeholder="Username" required />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white" placeholder="Password" required />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button type="submit" disabled={loading} className="w-full bg-neon-blue text-black font-bold py-4 rounded-2xl flex items-center justify-center gap-2">
            {loading ? <Loader2 className="animate-spin" /> : <>Sign In <ChevronRight /></>}
          </button>
        </form>
      </div>
    </div>
  );
};

const HostStatusPage: React.FC<{ token: string, onUnauthorized: () => void }> = ({ token, onUnauthorized }) => {
  const [frpStatus, setFrpStatus] = useState<any>(null);
  const [hostPorts, setHostPorts] = useState<any[]>([]);

  const fetchStatus = async () => {
    try {
      const frpRes = await fetch('/api/v1/frps/status', { headers: { 'Authorization': `Bearer ${token}` } });
      const portsRes = await fetch('/api/v1/host/ports', { headers: { 'Authorization': `Bearer ${token}` } });
      if (frpRes.status === 401 || portsRes.status === 401) {
        onUnauthorized();
        return;
      }
      if (frpRes.ok) setFrpStatus(await frpRes.json());
      if (portsRes.ok) setHostPorts(await portsRes.json());
    } catch (err) {}
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h1 className="text-3xl font-bold mb-8 text-white">Host & FRP Status</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="glass rounded-[32px] p-8 border border-white/10">
          <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-neon-blue"><Network size={20} /> FRP Proxies</h3>
          <div className="space-y-4">
            {(frpStatus?.proxies || []).map((p: any) => (
              <div key={p.name} className="p-4 rounded-2xl bg-white/5 border border-white/5">
                <div className="flex justify-between font-bold text-white"><span>{p.name}</span><span className="text-green-400 text-xs">ONLINE</span></div>
                <div className="mt-2 text-xs text-gray-500">{p.type} | Port: {p.port} | Client: {p.client_name}</div>
              </div>
            ))}
            {(!frpStatus?.proxies || frpStatus.proxies.length === 0) && <p className="text-gray-500 italic">No proxies</p>}
          </div>
        </div>
        <div className="glass rounded-[32px] p-8 border border-white/10">
          <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-neon-purple"><Monitor size={20} /> Host Ports</h3>
          <table className="w-full text-left text-xs font-mono">
            <thead><tr className="text-gray-500 border-b border-white/5"><th className="pb-2">Port</th><th>Process</th><th>PID</th></tr></thead>
            <tbody>
              {hostPorts.map(p => (
                <tr key={p.port} className="border-b border-white/5 text-gray-300"><td className="py-2 text-neon-blue">{p.port}</td><td>{p.process}</td><td>{p.pid}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const ProxiesPage: React.FC<{ agents: DashboardAgent[], token: string, onUnauthorized: () => void }> = ({ agents, token, onUnauthorized }) => {
  const [proxies, setProxies] = useState<Proxy[]>([]);
  const [selectedAgent, setSelectedAgent] = useState(agents[0]?.id || '');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProxy, setEditingProxy] = useState<number | null>(null);
  const [newProxy, setNewProxy] = useState<Partial<Proxy>>({ name: '', proxy_type: 'tcp', local_ip: '127.0.0.1', local_port: 80, remote_port: 80, status: 'active' });
  const [subdomain, setSubdomain] = useState('');
  const [nameSuffix, setNameSuffix] = useState('');

  const activeAgent = agents.find(a => a.id === selectedAgent);
  
  const fetchProxies = async () => {
    if (!selectedAgent) return;
    const res = await fetch(`/api/v1/agents/${selectedAgent}/proxies`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (res.status === 401) {
      onUnauthorized();
      return;
    }
    if (res.ok) setProxies(await res.json());
  };

  useEffect(() => { fetchProxies(); }, [selectedAgent]);

  // When opening modal for new proxy, or changing agent, update prefix
  useEffect(() => {
    if (!editingProxy && activeAgent) {
      setNewProxy(prev => ({ ...prev, name: `${activeAgent.hostname}_${nameSuffix}` }));
    }
  }, [activeAgent, nameSuffix, editingProxy]);

  const handleSuffixChange = (val: string) => {
    // Force lowercase, remove accents (simple regex for basic chars), remove spaces
    const sanitized = val.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove accents
      .replace(/[^a-z0-9-]/g, ''); // Only allow a-z, 0-9, and hyphens
    setNameSuffix(sanitized);
  };

  const handleCreate = async () => {
    if (!nameSuffix && !editingProxy) {
      alert('Proxy name suffix is required');
      return;
    }

    let finalProxy = { ...newProxy, agent_id: selectedAgent };
    if (newProxy.proxy_type === 'http') {
      if (!subdomain) { alert('Subdomain is required'); return; }
      finalProxy.custom_domain = `${subdomain}.v1.c500.net`;
      delete finalProxy.remote_port;
    }

    const url = editingProxy ? `/api/v1/proxies/${editingProxy}` : '/api/v1/proxies';
    const method = editingProxy ? 'PUT' : 'POST';

    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(finalProxy) });
    if (res.status === 401) {
      onUnauthorized();
      return;
    }
    if (res.ok) { setIsModalOpen(false); setEditingProxy(null); setNameSuffix(''); fetchProxies(); } else {
      const data = await res.json();
      alert(data.error || 'Failed to save proxy');
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Delete?')) {
      const res = await fetch(`/api/v1/proxies/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      if (res.status === 401) {
        onUnauthorized();
        return;
      }
      fetchProxies();
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-end mb-8">
        <div><h1 className="text-3xl font-bold text-white">Proxies</h1><p className="text-gray-400">Manage tunnels & monitor agent ports</p></div>
        <div className="flex gap-4">
          <select value={selectedAgent} onChange={e => setSelectedAgent(e.target.value)} className="bg-[#1a1a1c] border border-white/10 rounded-xl p-2 text-white">
            {(agents || []).map(a => <option key={a.id} value={a.id}>{a.hostname}</option>)}
          </select>
          <button onClick={() => { 
            setIsModalOpen(true); 
            setSubdomain(''); 
            setNameSuffix('');
            setEditingProxy(null); 
            setNewProxy({ name: '', proxy_type: 'tcp', local_ip: '127.0.0.1', local_port: 80, remote_port: 80, status: 'active' }); 
          }} className="bg-neon-blue text-black font-bold px-6 py-2 rounded-xl flex items-center gap-2"><Plus size={20} /> Add</button>
        </div>
      </div>
      <div className="glass rounded-[32px] overflow-hidden mb-8 border border-white/10">
        <table className="w-full text-left">
          <thead className="bg-white/5 text-gray-400 text-xs uppercase"><tr><th className="px-6 py-4">Name</th><th>Mapping</th><th className="px-6">Status</th><th className="text-right px-6">Action</th></tr></thead>
          <tbody className="divide-y divide-white/5 text-gray-300">
            {(proxies || []).map(p => (
              <tr key={p.id}>
                <td className="px-6 py-4 font-bold text-white">{p.name}</td>
                <td><span className="text-gray-500 font-mono text-[10px] mr-1">{p.local_ip}:</span>{p.local_port} → {p.proxy_type==='http'?p.custom_domain:p.remote_port}</td>
                <td className="px-6">
                  {(() => {
                    const status = (p.status as string);
                    let colorClass = 'bg-white/5 text-gray-500 border border-white/5';
                    let dotClass = 'bg-gray-500';
                    
                    if (status === 'online') {
                      colorClass = 'bg-green-400/10 text-green-400 border border-green-400/20';
                      dotClass = 'bg-green-400 animate-pulse';
                    } else if (status === 'offline') {
                      colorClass = 'bg-orange-400/10 text-orange-400 border border-orange-400/20';
                      dotClass = 'bg-orange-400';
                    } else if (status === 'active') {
                      colorClass = 'bg-neon-blue/10 text-neon-blue border border-neon-blue/20';
                      dotClass = 'bg-neon-blue';
                    } else if (status === 'inactive') {
                      colorClass = 'bg-red-400/10 text-red-400 border border-red-400/20';
                      dotClass = 'bg-red-400';
                    }

                    return (
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${colorClass}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
                        {status}
                      </span>
                    );
                  })()}
                </td>
                <td className="text-right px-6 space-x-2">
                  <button onClick={() => { 
                    setEditingProxy(p.id); 
                    setNewProxy(p); 
                    if (p.name.includes('_')) {
                      setNameSuffix(p.name.split('_').slice(1).join('_'));
                    } else {
                      setNameSuffix(p.name);
                    }
                    if (p.proxy_type === 'http' && p.custom_domain) {
                      setSubdomain(p.custom_domain.split('.')[0]);
                    }
                    setIsModalOpen(true); 
                  }} className="text-neon-blue hover:text-white transition-colors"><Edit2 size={16}/></button>
                  <button onClick={()=>handleDelete(p.id)} className="text-red-400 hover:text-red-300 transition-colors"><Trash2 size={16}/></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2 className="text-xl font-bold mb-4 text-white">Agent Scanned Ports</h2>
      <div className="glass rounded-[32px] overflow-hidden border border-white/10">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-white/5 text-gray-400 uppercase"><tr><th className="px-6 py-4">Port</th><th>Process</th></tr></thead>
          <tbody className="text-gray-300">
            {(activeAgent?.ports || []).map((p, i) => (
              <tr key={i} className="border-b border-white/5"><td className="px-6 py-3 text-neon-blue">{p.port}</td><td>{p.service_name}</td></tr>
            ))}
            {(!activeAgent?.ports || activeAgent.ports.length === 0) && <tr><td colSpan={2} className="p-6 text-center text-gray-500">No data</td></tr>}
          </tbody>
        </table>
      </div>
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass max-w-md p-8 rounded-[32px] w-full border border-white/10">
            <h2 className="text-2xl font-bold mb-6 text-white">{editingProxy ? 'Edit Proxy' : 'New Proxy'}</h2>
            <div className="space-y-4 text-white">
              <div>
                <label className="text-xs text-gray-500 font-bold uppercase mb-1 block">Proxy Name</label>
                <div className="flex items-center gap-0 bg-white/5 border border-white/10 rounded-xl overflow-hidden focus-within:border-neon-blue/50">
                  <span className="pl-3 py-3 text-gray-500 bg-white/5 border-r border-white/10 text-sm font-mono whitespace-nowrap">
                    {activeAgent?.hostname}_
                  </span>
                  <input 
                    type="text" 
                    placeholder="suffix (e.g. ssh)" 
                    value={nameSuffix} 
                    onChange={e => handleSuffixChange(e.target.value)} 
                    className="w-full bg-transparent p-3 text-white outline-none text-sm"
                  />
                </div>
                <p className="text-[10px] text-gray-500 mt-1 italic">Format: {activeAgent?.hostname}_[a-z0-9-]</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 font-bold uppercase mb-1 block">Local IP</label>
                <input type="text" placeholder="127.0.0.1" value={newProxy.local_ip} onChange={e=>setNewProxy({...newProxy, local_ip:e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-neon-blue/50"/>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500 font-bold uppercase mb-1 block">Type</label>
                  <select value={newProxy.proxy_type} onChange={e=>setNewProxy({...newProxy, proxy_type:e.target.value as any})} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white outline-none">
                    <option value="tcp">TCP</option>
                    <option value="http">HTTP</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-bold uppercase mb-1 block">Local Port</label>
                  <input type="number" placeholder="80" value={newProxy.local_port} onChange={e=>setNewProxy({...newProxy, local_port:parseInt(e.target.value)})} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-neon-blue/50"/>
                </div>
              </div>
              
              {newProxy.proxy_type === 'http' ? (
                <div>
                  <label className="text-xs text-gray-500 font-bold uppercase mb-1 block">Domain</label>
                  <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl p-3">
                    <input type="text" placeholder="subdomain" value={subdomain} onChange={e=>setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} className="bg-transparent outline-none text-white w-full text-right"/>
                    <span className="text-gray-500">.v1.c500.net</span>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-xs text-gray-500 font-bold uppercase mb-1 block">Remote Port</label>
                  <input type="number" placeholder="8001" value={newProxy.remote_port} onChange={e=>setNewProxy({...newProxy, remote_port:parseInt(e.target.value)})} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-neon-blue/50"/>
                </div>
              )}

              <div className="pt-4 flex flex-col gap-2">
                <button onClick={handleCreate} className="w-full bg-neon-blue text-black font-bold py-4 rounded-2xl hover:shadow-[0_0_20px_rgba(0,243,255,0.4)] transition-all">
                  {editingProxy ? 'Update Tunnel' : 'Create Tunnel'}
                </button>
                <button onClick={()=>setIsModalOpen(false)} className="w-full text-gray-500 py-2 hover:text-white transition-colors">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const AgentsPage: React.FC<{ agents: DashboardAgent[] }> = ({ agents }) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const origin = window.location.origin;
  const linuxCommand = `curl -fsSL ${origin}/api/v1/install/script?os=linux | sudo bash`;
  const windowsCommand = `curl.exe -fsSL "${origin}/api/v1/install/script?os=windows" | powershell -NoProfile -ExecutionPolicy Bypass -`;

  const handleCopy = async (key: string, value: string) => {
    try {
      await copyToClipboard(value);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((current) => current === key ? null : current), 2000);
    } catch {}
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
      <div className="glass rounded-[32px] p-8 border border-white/10">
        <div className="flex items-start justify-between gap-6 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white">Agents</h1>
            <p className="text-gray-400 mt-2">Copy a quick install command and run it on the target machine.</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-neon-blue">{agents.length}</div>
            <div className="text-xs uppercase tracking-[0.3em] text-gray-500">Registered</div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <InstallCommandCard
            title="Linux Quick Install"
            description="Ubuntu, Debian, CentOS, AlmaLinux"
            command={linuxCommand}
            copied={copiedKey === 'linux'}
            onCopy={() => handleCopy('linux', linuxCommand)}
          />
          <InstallCommandCard
            title="Windows Quick Install"
            description="Run inside PowerShell as Administrator"
            command={windowsCommand}
            copied={copiedKey === 'windows'}
            onCopy={() => handleCopy('windows', windowsCommand)}
          />
        </div>
      </div>

      <div className="glass rounded-[32px] overflow-hidden border border-white/10">
        <div className="px-8 py-6 border-b border-white/5">
          <h2 className="text-xl font-bold text-white">Registered Agents</h2>
        </div>
        <table className="w-full text-left">
          <thead className="bg-white/5 text-gray-400 text-xs uppercase">
            <tr>
              <th className="px-6 py-4">Hostname</th>
              <th>Private IP</th>
              <th>OS</th>
              <th>Status</th>
              <th>Last Heartbeat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-gray-300">
            {agents.length > 0 ? agents.map((agent) => (
              <tr key={agent.id}>
                <td className="px-6 py-4">
                  <div className="font-bold text-white">{agent.hostname}</div>
                  <div className="text-xs text-gray-500">{agent.id}</div>
                </td>
                <td>{agent.private_ip || '-'}</td>
                <td>{agent.os || '-'}</td>
                <td>
                  <span className={agent.status === 'online' ? 'text-green-400' : 'text-gray-500'}>
                    {agent.status}
                  </span>
                </td>
                <td>{agent.last_heartbeat ? new Date(agent.last_heartbeat).toLocaleString() : '-'}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-gray-500">No agents registered yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const LogsPage: React.FC<{ logs: LogEntry[] }> = ({ logs }) => (
  <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
    <h1 className="text-3xl font-bold mb-8 text-white">Logs</h1>
    <div className="glass rounded-[32px] overflow-hidden border border-white/10">
      <table className="w-full text-left text-xs font-mono">
        <thead className="bg-white/5 text-gray-400"><tr><th className="px-6 py-4">Time</th><th>Agent</th><th>Message</th></tr></thead>
        <tbody className="text-gray-300">
          {logs.map(l => (
            <tr key={l.id} className="border-b border-white/5"><td className="px-6 py-2">{new Date(l.timestamp).toLocaleTimeString()}</td><td className="text-neon-blue">{l.agent_name}</td><td>{l.message}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const SettingsPage: React.FC<{ token: string, onUnauthorized: () => void }> = ({ token, onUnauthorized }) => {
  const [settings, setSettings] = useState<SettingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  const fetchSettings = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/v1/settings', { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.status === 401) {
        onUnauthorized();
        return;
      }
      if (res.status === 403) {
        setError('Admin access required to manage settings.');
        return;
      }
      if (!res.ok) {
        setError('Failed to load settings.');
        return;
      }
      const data = await res.json();
      setSettings(data.map((item: any) => ({ key: String(item.key ?? ''), value: String(item.value ?? '') })));
    } catch {
      setError('Failed to load settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const saveSetting = async (entry: SettingEntry) => {
    setSavingKey(entry.key);
    setError('');
    setNotice('');
    try {
      const res = await fetch('/api/v1/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(entry)
      });
      if (res.status === 401) {
        onUnauthorized();
        return;
      }
      if (res.status === 403) {
        setError('Admin access required to manage settings.');
        return;
      }
      if (!res.ok) {
        setError('Failed to save setting.');
        return;
      }
      setNotice(`Saved ${entry.key}`);
      setTimeout(() => setNotice(''), 2000);
      await fetchSettings();
    } catch {
      setError('Failed to save setting.');
    } finally {
      setSavingKey(null);
    }
  };

  const addSetting = async () => {
    const key = newKey.trim();
    if (!key) return;
    await saveSetting({ key, value: newValue });
    setNewKey('');
    setNewValue('');
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
      <div className="glass rounded-[32px] p-8 border border-white/10">
        <h1 className="text-3xl font-bold text-white">Settings</h1>
        <p className="text-gray-400 mt-2">Manage key-value settings stored on the server.</p>
        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
        {notice && <p className="mt-4 text-sm text-green-400">{notice}</p>}
      </div>

      <div className="glass rounded-[32px] p-8 border border-white/10">
        <h2 className="text-xl font-bold text-white mb-4">Add Setting</h2>
        <div className="grid gap-4 md:grid-cols-[1fr,1fr,auto]">
          <input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="Key" className="bg-white/5 border border-white/10 rounded-xl p-3 text-white" />
          <input value={newValue} onChange={(e) => setNewValue(e.target.value)} placeholder="Value" className="bg-white/5 border border-white/10 rounded-xl p-3 text-white" />
          <button onClick={addSetting} className="bg-neon-blue text-black font-bold px-6 py-3 rounded-xl">Add</button>
        </div>
      </div>

      <div className="glass rounded-[32px] overflow-hidden border border-white/10">
        <div className="px-8 py-6 border-b border-white/5">
          <h2 className="text-xl font-bold text-white">Current Settings</h2>
        </div>
        {loading ? (
          <div className="p-8 text-gray-400">Loading settings...</div>
        ) : (
          <div className="divide-y divide-white/5">
            {settings.length > 0 ? settings.map((entry) => (
              <SettingRow key={entry.key} entry={entry} saving={savingKey === entry.key} onSave={saveSetting} />
            )) : (
              <div className="p-8 text-gray-500">No settings saved yet.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const AgentMonitorPage: React.FC<{ agents: DashboardAgent[], token: string, onUnauthorized: () => void }> = ({ agents, token, onUnauthorized }) => {
  const [selectedAgent, setSelectedAgent] = useState(agents[0]?.id || '');
  const [history, setHistory] = useState<HardwareHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedAgent && agents[0]?.id) setSelectedAgent(agents[0].id);
  }, [agents, selectedAgent]);

  useEffect(() => {
    if (!selectedAgent) return;
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/v1/stats/history/${selectedAgent}`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (res.status === 401) {
          onUnauthorized();
          return;
        }
        if (res.ok) {
          const data = await res.json();
          setHistory(Array.isArray(data) ? data.reverse() : []);
        }
      } catch {}
      finally {
        setLoading(false);
      }
    };

    fetchHistory();
    const interval = setInterval(fetchHistory, 15000);
    return () => clearInterval(interval);
  }, [selectedAgent, token]);

  const activeAgent = agents.find((agent) => agent.id === selectedAgent);
  const currentHardware = activeAgent?.hardware;
  const chartData = history.map((item) => ({
    time: new Date(item.created_at).toLocaleTimeString(),
    cpu: Math.round(item.cpu_usage),
    ram: item.ram_total ? Math.round((item.ram_used / item.ram_total) * 100) : 0,
    rx: Number((item.network_rx / 1024).toFixed(1)),
    tx: Number((item.network_tx / 1024).toFixed(1)),
  }));

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Agent Monitor</h1>
          <p className="text-gray-400 mt-2">Live hardware snapshot and recent history reported by each installed agent.</p>
        </div>
        <select value={selectedAgent} onChange={(e) => setSelectedAgent(e.target.value)} className="bg-[#1a1a1c] border border-white/10 rounded-xl p-3 text-white min-w-[260px]">
          {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.hostname}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard title="CPU" value={currentHardware ? `${Math.round(currentHardware.cpu_usage)}%` : '-'} change="Current" icon={<Cpu className="text-neon-blue"/>}/>
        <StatCard title="RAM" value={currentHardware ? `${Math.round((currentHardware.ram_used / (currentHardware.ram_total || 1)) * 100)}%` : '-'} change={currentHardware ? `${formatBytes(currentHardware.ram_used)} used` : 'Waiting'} icon={<Monitor className="text-green-400"/>}/>
        <StatCard title="Inbound" value={currentHardware ? `${formatBytes(currentHardware.net_in)}/s` : '-'} change="Current RX" icon={<Activity className="text-yellow-400"/>}/>
        <StatCard title="Outbound" value={currentHardware ? `${formatBytes(currentHardware.net_out)}/s` : '-'} change="Current TX" icon={<Network className="text-neon-purple"/>}/>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <div className="glass rounded-[32px] p-8 border border-white/10 h-80">
          <h3 className="font-bold mb-6 text-white">CPU & RAM History</h3>
          {loading ? <p className="text-gray-500">Loading history...</p> : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="cpuFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00f3ff" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#00f3ff" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="ramFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4ade80" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#4ade80" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#ffffff05" vertical={false} />
                <XAxis dataKey="time" stroke="#ffffff20" fontSize={10} />
                <YAxis stroke="#ffffff20" fontSize={10} domain={[0, 100]} />
                <Tooltip contentStyle={{backgroundColor:'#1a1a1c', border:'none', borderRadius:'12px', color:'#fff'}} />
                <Area type="monotone" dataKey="cpu" stroke="#00f3ff" fill="url(#cpuFill)" strokeWidth={2} isAnimationActive={false} />
                <Area type="monotone" dataKey="ram" stroke="#4ade80" fill="url(#ramFill)" strokeWidth={2} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="glass rounded-[32px] p-8 border border-white/10 h-80">
          <h3 className="font-bold mb-6 text-white">Network Throughput History</h3>
          {loading ? <p className="text-gray-500">Loading history...</p> : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="rxFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="txFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#a78bfa" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#ffffff05" vertical={false} />
                <XAxis dataKey="time" stroke="#ffffff20" fontSize={10} />
                <YAxis stroke="#ffffff20" fontSize={10} />
                <Tooltip contentStyle={{backgroundColor:'#1a1a1c', border:'none', borderRadius:'12px', color:'#fff'}} />
                <Area type="monotone" dataKey="rx" stroke="#f59e0b" fill="url(#rxFill)" strokeWidth={2} isAnimationActive={false} />
                <Area type="monotone" dataKey="tx" stroke="#a78bfa" fill="url(#txFill)" strokeWidth={2} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="glass rounded-[32px] p-8 border border-white/10">
        <h2 className="text-xl font-bold text-white mb-4">Host Snapshot</h2>
        {activeAgent ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 text-sm">
            <div className="rounded-2xl bg-white/5 p-4">
              <div className="text-gray-500 uppercase text-xs mb-2">Hostname</div>
              <div className="text-white font-bold">{activeAgent.hostname}</div>
            </div>
            <div className="rounded-2xl bg-white/5 p-4">
              <div className="text-gray-500 uppercase text-xs mb-2">Private IP</div>
              <div className="text-white font-bold">{activeAgent.private_ip || '-'}</div>
            </div>
            <div className="rounded-2xl bg-white/5 p-4">
              <div className="text-gray-500 uppercase text-xs mb-2">OS</div>
              <div className="text-white font-bold">{activeAgent.os || '-'}</div>
            </div>
            <div className="rounded-2xl bg-white/5 p-4">
              <div className="text-gray-500 uppercase text-xs mb-2">Last Heartbeat</div>
              <div className="text-white font-bold">{activeAgent.last_heartbeat ? new Date(activeAgent.last_heartbeat).toLocaleString() : '-'}</div>
            </div>
          </div>
        ) : (
          <p className="text-gray-500">No agent selected.</p>
        )}
      </div>
    </div>
  );
};

const TerminalPage: React.FC<{ agents: DashboardAgent[], token: string, onUnauthorized: () => void }> = ({ agents, token, onUnauthorized }) => {
  const [selectedAgent, setSelectedAgent] = useState(agents[0]?.id || '');
  const [history, setHistory] = useState<{type:'cmd'|'out', text:string}[]>([{type:'out', text:'Ready.'}]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if(scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [history]);

  useEffect(() => {
    const handleOutput = (e: any) => {
      const { agent_id, message } = e.detail;
      if (agent_id === selectedAgent) {
        setHistory(prev => [...prev, { type: 'out', text: message }]);
      }
    };
    window.addEventListener('terminal_output', handleOutput as EventListener);
    return () => window.removeEventListener('terminal_output', handleOutput as EventListener);
  }, [selectedAgent]);

  const handleCommand = async (e: React.FormEvent) => {
    e.preventDefault(); const cmd = input.trim(); if(!cmd) return;
    setHistory(p => [...p, {type:'cmd', text:cmd}]); setInput('');
    try {
      const res = await fetch(`/api/v1/agents/${selectedAgent}/execute`, { method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`}, body:JSON.stringify({command:cmd}) });
      if (res.status === 401) {
        onUnauthorized();
        return;
      }
      if (!res.ok) {
        const data = await res.json();
        setHistory(p => [...p, {type:'out', text:`Error: ${data.error || 'Execution failed'}`}]);
      }
    } catch(e) { setHistory(p => [...p, {type:'out', text:'Network error'}]); }
  };

  return (
    <div className="h-full flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between mb-8 text-white">
        <h1 className="text-3xl font-bold">Terminal</h1>
        <select value={selectedAgent} onChange={e=>setSelectedAgent(e.target.value)} className="bg-[#1a1a1c] border border-white/10 rounded-xl p-2 text-white">{(agents || []).map(a=><option key={a.id} value={a.id}>{a.hostname}</option>)}</select>
      </div>
      <div className="flex-1 glass rounded-[32px] overflow-hidden flex flex-col font-mono text-sm bg-black/40 min-h-[400px] border border-white/10">
        <div ref={scrollRef} className="flex-1 p-6 overflow-y-auto space-y-1">
          {(history || []).map((h, i) => <div key={i} className={`${h.type==='cmd'?'text-neon-blue':'text-gray-300'} whitespace-pre-wrap`}>{h.type==='cmd'&&'$ '}{h.text}</div>)}
        </div>
        <form onSubmit={handleCommand} className="p-4 bg-white/5 border-t border-white/5 flex gap-2"><span className="text-neon-blue">$</span><input type="text" autoFocus value={input} onChange={e=>setInput(e.target.value)} className="bg-transparent outline-none flex-1 text-white" placeholder="Type command..."/></form>
      </div>
    </div>
  );
};

const ProfilePage: React.FC<{ user: User }> = ({ user }) => (
  <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
    <h1 className="text-3xl font-bold mb-8 text-white">Profile</h1>
    <div className="glass rounded-[32px] p-8 border border-white/10 max-w-lg">
      <div className="flex items-center gap-6 mb-8">
        <img src={user.avatar} className="w-20 h-20 rounded-full border-2 border-neon-blue" alt="Avatar" />
        <div>
          <h2 className="text-2xl font-bold text-white">{user.username}</h2>
          <p className="text-neon-blue font-bold uppercase text-xs">{user.role}</p>
        </div>
      </div>
      <div className="space-y-4 text-gray-400">
        <div><p className="text-xs uppercase font-bold text-gray-500">Email Address</p><p className="text-white">{user.email}</p></div>
      </div>
    </div>
  </div>
);

const App: React.FC = () => {
  const initialAuth = getInitialAuthState();
  const [activeTab, setActiveTab] = useState(localStorage.getItem('activeTab') || 'dashboard');
  const [user, setUser] = useState<User | null>(initialAuth.user);

  // Sync activeTab to localStorage
  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);
  const [token, setToken] = useState<string | null>(initialAuth.token);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(initialAuth.isAuthenticated);
  const [agents, setAgents] = useState<DashboardAgent[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logsLoaded, setLogsLoaded] = useState(false);
  const [trafficStats, setTrafficStats] = useState<TrafficStats>({ total_rx: 0, total_tx: 0 });
  const [performanceHistory, setPerformanceHistory] = useState<{time:string, cpu:number, ram:number}[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const handleUnauthorized = () => {
    clearAuthData();
    setUser(null);
    setToken(null);
    setIsAuthenticated(false);
    setWsConnected(false);
  };

  const fetchData = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/v1/agents', { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.status === 401) { handleUnauthorized(); return; }
      const data: Agent[] = await res.json();
      setAgents(data.map(a => ({ 
        ...a, 
        hardware: a.hardware_stats ? JSON.parse(a.hardware_stats) : undefined, 
        ports: a.open_ports ? JSON.parse(a.open_ports) : [] 
      })));
      const tRes = await fetch('/api/v1/stats/traffic', { headers: { 'Authorization': `Bearer ${token}` } });
      if (tRes.status === 401) { handleUnauthorized(); return; }
      if (tRes.ok) setTrafficStats(await tRes.json());
    } catch (e) {}
  };

  const fetchLogs = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/v1/logs?limit=200', { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.status === 401) { handleUnauthorized(); return; }
      if (!res.ok) return;
      const data = await res.json();
      setLogsLoaded(true);
      setLogs(data.map((item: any, index: number) => ({
        id: String(item.id ?? `${index}`),
        agent_id: String(item.agent_id ?? ''),
        agent_name: agents.find((agent) => agent.id === String(item.agent_id ?? ''))?.hostname || String(item.agent_id ?? 'Agent'),
        severity: String(item.log_level ?? 'info'),
        message: String(item.message ?? ''),
        timestamp: String(item.timestamp ?? item.created_at ?? new Date().toISOString())
      })));
    } catch {}
  };

  useEffect(() => {
    if (isAuthenticated) { fetchData(); const i = setInterval(fetchData, 30000); return () => clearInterval(i); }
  }, [isAuthenticated, token]);

  useEffect(() => {
    if (activeTab === 'logs' && token && !logsLoaded) fetchLogs();
  }, [activeTab, token, logsLoaded, agents]);

  useEffect(() => {
    if (!isAuthenticated || !token) return;
    const connect = () => {
      const ws = new WebSocket(`${window.location.protocol==='https:'?'wss':'ws'}://${window.location.host}/api/v1/ws?token=${token}`);
      ws.onopen = () => setWsConnected(true);
      ws.onmessage = (e) => {
        try {
          const msg: WSMessage = JSON.parse(e.data);
          if (msg.topic === 'agent_heartbeat') {
            const { agent_id, hardware, ports } = msg.payload;
            setAgents(prev => prev.map(a => a.id === agent_id ? { ...a, status: 'online', hardware, ports, last_heartbeat: new Date().toISOString() } : a));
            const now = new Date(); const timeStr = now.toLocaleTimeString();
            setPerformanceHistory(p => [...p, { time: timeStr, cpu: Math.round(hardware.cpu_usage), ram: Math.round((hardware.ram_used/hardware.ram_total)*100) }].slice(-20));
          } else if (msg.topic === 'agent_log') {
            const { agent_id, message, source } = msg.payload;
            if (source === 'terminal') {
              window.dispatchEvent(new CustomEvent('terminal_output', { 
                detail: { agent_id, message: String(message) } 
              }));
            } else {
              setLogs(p => [{ 
                id: Math.random().toString(), 
                agent_id, 
                agent_name: 'Agent', // Đơn giản hóa để tránh stale closure
                severity:'info', 
                message, 
                timestamp: new Date().toISOString() 
              }, ...p].slice(0, 100));
            }
          }
        } catch(err) {}
      };
      ws.onclose = () => { setWsConnected(false); setTimeout(connect, 5000); };
      ws.onerror = () => setWsConnected(false);
    };
    connect();
  }, [isAuthenticated, token]);

  if (!isAuthenticated) return <LoginPage onLogin={(t, u) => { setAuthData(t, u); setToken(t); setUser(u); setIsAuthenticated(true); }} />;

  return (
    <div className="flex h-screen w-full bg-[#0a0a0c] text-white font-sans overflow-hidden">
      <aside className="w-72 glass border-r border-white/10 flex flex-col shrink-0">
        <div className="p-6 flex items-center gap-3 border-b border-white/5"><Shield className="text-neon-blue w-8 h-8" /><span className="font-bold text-xl tracking-tight">ProxyManager</span></div>
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          <SidebarItem icon={<LayoutDashboard size={20}/>} label="Overview" active={activeTab==='dashboard'} onClick={()=>setActiveTab('dashboard')}/>
          <SidebarItem icon={<Server size={20}/>} label="Agents" active={activeTab==='agents'} onClick={()=>setActiveTab('agents')}/>
          <SidebarItem icon={<Cpu size={20}/>} label="Monitor" active={activeTab==='monitor'} onClick={()=>setActiveTab('monitor')}/>
          <SidebarItem icon={<Activity size={20}/>} label="Host Status" active={activeTab==='host'} onClick={()=>setActiveTab('host')}/>
          <SidebarItem icon={<Network size={20}/>} label="Proxies" active={activeTab==='proxies'} onClick={()=>setActiveTab('proxies')}/>
          <SidebarItem icon={<FileText size={20}/>} label="Logs" active={activeTab==='logs'} onClick={()=>setActiveTab('logs')}/>
          <SidebarItem icon={<Terminal size={20}/>} label="Terminal" active={activeTab==='terminal'} onClick={()=>setActiveTab('terminal')}/>
          <SidebarItem icon={<FileText size={20}/>} label="Docs" active={activeTab==='docs'} onClick={()=>setActiveTab('docs')}/>
          <SidebarItem icon={<Settings size={20}/>} label="Settings" active={activeTab==='settings'} onClick={()=>setActiveTab('settings')}/>        </nav>
        <div className="p-6 border-t border-white/5"><button onClick={()=>{clearAuthData(); setIsAuthenticated(false);}} className="flex items-center gap-3 text-gray-400 hover:text-red-400 transition-colors"><LogOut size={18}/><span>Sign Out</span></button></div>
      </aside>
      <main className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-neon-blue/5 via-transparent to-transparent">
        <header className="h-20 px-8 flex items-center justify-between border-b border-white/5 bg-[#0a0a0c]/80 backdrop-blur-md sticky top-0 z-10">
          <div className={`px-3 py-1.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${wsConnected?'border-green-400/20 text-green-400':'border-red-400/20 text-red-400'}`}>{wsConnected?'System Live':'Connection Lost'}</div>
          <div className="flex items-center gap-3 bg-white/5 p-1.5 rounded-full pr-4 cursor-pointer hover:bg-white/10" onClick={()=>setActiveTab('profile')}>
            <div className="h-8 w-8 rounded-full bg-neon-blue/20 flex items-center justify-center text-neon-blue font-bold"><User size={16}/></div>
            <span className="text-sm font-medium">{user?.username}</span>
          </div>
        </header>
        <div className="p-8 max-w-7xl mx-auto">
          {activeTab === 'dashboard' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h1 className="text-3xl font-bold mb-8 text-white">Network Overview</h1>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <StatCard title="Agents" value={agents.length.toString()} change={`${agents.filter(a=>a.status==='online').length} Live`} icon={<Server className="text-neon-blue"/>}/>
                <StatCard title="Traffic" value={formatBytes(trafficStats.total_rx+trafficStats.total_tx)} change="Total" icon={<Activity className="text-green-400"/>}/>
                <StatCard title="Load" value={`${Math.round(agents.reduce((s,a)=>s+(a.hardware?.cpu_usage||0),0)/(agents.length||1))}%`} change="Avg CPU" icon={<Cpu className="text-neon-purple"/>}/>
                <StatCard title="Uptime" value="99.9%" change="Stable" icon={<Shield className="text-yellow-400"/>}/>
              </div>
              <div className="glass rounded-[32px] p-8 border border-white/10 h-80">
                <h3 className="font-bold mb-6 flex items-center gap-2 text-neon-blue text-white"><Activity size={18}/> Real-time Infrastructure Load</h3>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={performanceHistory}>
                    <defs><linearGradient id="c" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#00f3ff" stopOpacity={0.3}/><stop offset="95%" stopColor="#00f3ff" stopOpacity={0}/></linearGradient></defs>
                    <CartesianGrid stroke="#ffffff05" vertical={false} /><XAxis dataKey="time" hide /><YAxis stroke="#ffffff20" fontSize={10} domain={[0, 100]} />
                    <Tooltip contentStyle={{backgroundColor:'#1a1a1c', border:'none', borderRadius:'12px', color:'#fff'}} /><Area type="monotone" dataKey="cpu" stroke="#00f3ff" fill="url(#c)" strokeWidth={3} isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
          {activeTab === 'agents' && <AgentsPage agents={agents} />}
          {activeTab === 'monitor' && <AgentMonitorPage agents={agents} token={token!} onUnauthorized={handleUnauthorized} />}
          {activeTab === 'host' && <HostStatusPage token={token!} onUnauthorized={handleUnauthorized} />}
          {activeTab === 'proxies' && <ProxiesPage agents={agents} token={token!} onUnauthorized={handleUnauthorized} />}
          {activeTab === 'logs' && <LogsPage logs={logs} />}
          {activeTab === 'terminal' && <TerminalPage agents={agents} token={token!} onUnauthorized={handleUnauthorized} />}
          {activeTab === 'docs' && <DocsPage />}
          {activeTab === 'settings' && <SettingsPage token={token!} onUnauthorized={handleUnauthorized} />}
          {activeTab === 'profile' && <ProfilePage user={user!} />}
        </div>
      </main>
    </div>
  );
};

const SidebarItem: React.FC<{ icon: any, label: string, active: boolean, onClick: () => void }> = ({ icon, label, active, onClick }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${active ? 'bg-neon-blue text-black font-bold shadow-[0_0_20px_rgba(0,243,255,0.3)]' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
    {icon}<span className="text-sm">{label}</span>
  </button>
);

const StatCard: React.FC<{ title: string, value: string, change: string, icon: any }> = ({ title, value, change, icon }) => (
  <div className="glass rounded-2xl p-6 border border-white/10 hover:border-white/20 transition-all">
    <div className="flex justify-between mb-4"><div className="p-3 bg-white/5 rounded-xl">{icon}</div><span className="text-[10px] font-bold text-green-400 uppercase tracking-wider">{change}</span></div>
    <h4 className="text-gray-500 text-xs uppercase font-bold tracking-widest">{title}</h4><div className="text-2xl font-bold mt-1 text-white">{value}</div>
  </div>
);

const InstallCommandCard: React.FC<{ title: string, description: string, command: string, copied: boolean, onCopy: () => void }> = ({ title, description, command, copied, onCopy }) => (
  <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6">
    <div className="flex items-start justify-between gap-4 mb-4">
      <div>
        <h3 className="text-lg font-bold text-white">{title}</h3>
        <p className="text-sm text-gray-400 mt-1">{description}</p>
      </div>
      <button onClick={onCopy} className="inline-flex items-center gap-2 rounded-xl bg-neon-blue px-4 py-2 text-sm font-bold text-black">
        {copied ? <Check size={16} /> : <Copy size={16} />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
    <pre className="overflow-x-auto rounded-2xl bg-black/40 p-4 text-xs text-neon-blue">
      <code>{command}</code>
    </pre>
  </div>
);

const SettingRow: React.FC<{ entry: SettingEntry, saving: boolean, onSave: (entry: SettingEntry) => Promise<void> }> = ({ entry, saving, onSave }) => {
  const [value, setValue] = useState(entry.value);

  useEffect(() => {
    setValue(entry.value);
  }, [entry.value]);

  return (
    <div className="grid gap-4 px-8 py-5 md:grid-cols-[220px,1fr,auto] md:items-center">
      <div className="font-mono text-sm text-neon-blue">{entry.key}</div>
      <input value={value} onChange={(e) => setValue(e.target.value)} className="bg-white/5 border border-white/10 rounded-xl p-3 text-white" />
      <button onClick={() => onSave({ key: entry.key, value })} disabled={saving} className="bg-neon-blue text-black font-bold px-5 py-3 rounded-xl disabled:opacity-60">
        {saving ? 'Saving...' : 'Save'}
      </button>
    </div>
  );
};


const DocsPage: React.FC = () => (
  <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8 pb-20">
    <div>
      <h1 className="text-3xl font-bold text-white">Documentation</h1>
      <p className="text-gray-400 mt-2">Hướng dẫn vận hành hệ thống ProxyManager v1.2.0</p>
    </div>

    <div className="grid gap-8 lg:grid-cols-2">
      <div className="glass rounded-[32px] p-8 border border-white/10">
        <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-neon-blue"><Download size={20} /> 1. Cài đặt Agent</h3>
        <div className="space-y-4 text-sm text-gray-300 leading-relaxed">
          <p>Để quản lý một máy chủ từ xa, bạn cần cài đặt Agent lên máy đó:</p>
          <ol className="list-decimal list-inside space-y-2">
            <li>Vào mục <span className="text-white font-bold">Agents</span> trong sidebar.</li>
            <li>Copy lệnh <span className="text-neon-blue font-bold">Quick Install</span> tương ứng với OS (Linux/Windows).</li>
            <li>Dán vào Terminal của máy đích và chạy với quyền <span className="text-white font-bold">root/Admin</span>.</li>
            <li>Agent sẽ tự động kết nối và xuất hiện trong danh sách sau 5-10 giây.</li>
          </ol>
        </div>
      </div>

      <div className="glass rounded-[32px] p-8 border border-white/10">
        <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-neon-purple"><Network size={20} /> 2. Tạo Proxy (Tunnel)</h3>
        <div className="space-y-4 text-sm text-gray-300">
          <div>
            <p className="font-bold text-white mb-1">HTTP Proxy (Wildcard Domain):</p>
            <p>Sử dụng định dạng <code className="text-neon-blue">[subdomain].v1.c500.net</code>. Hệ thống sẽ tự động cấp SSL/TLS ở lớp ngoài.</p>
          </div>
          <div>
            <p className="font-bold text-white mb-1">TCP/UDP Proxy:</p>
            <p>Cần nhập <span className="text-white font-bold">Remote Port</span> (từ 10000 - 20000). Đây là port bạn sẽ dùng để truy cập dịch vụ từ xa.</p>
          </div>
        </div>
      </div>

      <div className="glass rounded-[32px] p-8 border border-white/10">
        <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-green-400"><Activity size={20} /> 3. Trạng thái Tunnel</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-green-400 animate-pulse" />
            <span className="text-sm font-bold text-white w-20">ONLINE:</span>
            <span className="text-sm text-gray-400">Tunnel đang hoạt động, truy cập được ngay.</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-orange-400" />
            <span className="text-sm font-bold text-white w-20">OFFLINE:</span>
            <span className="text-sm text-gray-400">Đã cấu hình nhưng Agent hoặc dịch vụ nội bộ đang tắt.</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-neon-blue" />
            <span className="text-sm font-bold text-white w-20">ACTIVE:</span>
            <span className="text-sm text-gray-400">Vừa khởi tạo, đang chờ đồng bộ với Agent.</span>
          </div>
        </div>
      </div>

      <div className="glass rounded-[32px] p-8 border border-white/10">
        <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-yellow-400"><Shield size={20} /> 4. Xử lý sự cố</h3>
        <div className="space-y-2 text-xs font-mono text-gray-400">
          <p className="text-white font-bold mb-2">// Nếu không thấy file frpc.yaml:</p>
          <p>- Kiểm tra log Agent: journalctl -u proxymanager-agent</p>
          <p>- Đảm bảo thư mục /opt/proxymanager có quyền ghi.</p>
          <p className="text-white font-bold mt-4 mb-2">// Nếu Domain không truy cập được:</p>
          <p>- Đợi 1-2 phút để Nginx & FRPS reload cấu hình.</p>
          <p>- Kiểm tra Local Port đã chính xác chưa.</p>
        </div>
      </div>
    </div>
  </div>
);

export default App;
