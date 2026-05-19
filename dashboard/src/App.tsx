import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Server, 
  Network, 
  Activity, 
  Shield, 
  LogOut, 
  User, 
  Users,
  Key,
  ChevronRight, 
  Loader2, 
  Trash2, 
  Plus, 
  Edit2,
  FileText, 
  Cpu, 
  Monitor,
  Settings,
  Copy,
  Check,
  Download,
  Globe,
  RotateCw,
  X
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
  name: string;
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

interface DomainStatus {
  domain: string;
  server_ip: string;
  resolved_ips: string[];
  pointed: boolean;
  nginx_ready: boolean;
  cert_ready: boolean;
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
      if (!res.ok) throw new Error('Thông tin đăng nhập không chính xác');
      const data = await res.json();
      onLogin(data.token, {
        username: data.user.username,
        role: data.user.role,
        email: `${data.user.username}@${import.meta.env.VITE_WILDCARD_DOMAIN || 'ovncr.vn'}`,
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
          <input type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white" placeholder="Tên đăng nhập" required />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white" placeholder="Mật khẩu" required />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button type="submit" disabled={loading} className="w-full bg-neon-blue text-black font-bold py-4 rounded-2xl flex items-center justify-center gap-2">
            {loading ? <Loader2 className="animate-spin" /> : <>Đăng nhập <ChevronRight /></>}
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
      <h1 className="text-3xl font-bold mb-8 text-white">Trạng thái Host & FRP</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="glass rounded-[32px] p-8 border border-white/10">
          <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-neon-blue"><Network size={20} /> FRP Proxies</h3>
          <div className="space-y-4">
            {(frpStatus?.proxies || []).map((p: any) => (
              <div key={p.name} className="p-4 rounded-2xl bg-white/5 border border-white/5">
                <div className="flex justify-between font-bold text-white"><span>{p.name}</span><span className="text-green-400 text-xs">ONLINE</span></div>
                <div className="mt-2 text-xs text-gray-500">{p.type} | Cổng: {p.port} | Client: {p.client_name}</div>
              </div>
            ))}
            {(!frpStatus?.proxies || frpStatus.proxies.length === 0) && <p className="text-gray-500 italic">Không có proxy nào</p>}
          </div>
        </div>
        <div className="glass rounded-[32px] p-8 border border-white/10">
          <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-neon-purple"><Monitor size={20} /> Cổng trên Host</h3>
          <table className="w-full text-left text-xs font-mono">
            <thead><tr className="text-gray-500 border-b border-white/5"><th className="pb-2">Cổng</th><th>Tiến trình</th><th>PID</th></tr></thead>
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
  const [domainStatuses, setDomainStatuses] = useState<Record<string, DomainStatus>>({});
  const [domainBusy, setDomainBusy] = useState<string | null>(null);

  const activeAgent = agents.find(a => a.id === selectedAgent);

  useEffect(() => {
    if (!selectedAgent && agents[0]?.id) {
      setSelectedAgent(agents[0].id);
    }
  }, [agents, selectedAgent]);
  
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

  useEffect(() => {
    if (!editingProxy && activeAgent) {
      setNewProxy(prev => ({ ...prev, name: `${activeAgent.hostname}_${nameSuffix}` }));
    }
  }, [activeAgent, nameSuffix, editingProxy]);

  const handleSuffixChange = (val: string) => {
    const sanitized = val.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9-]/g, '');
    setNameSuffix(sanitized);
  };

  const handleCreate = async () => {
    if (!nameSuffix && !editingProxy) {
      alert('Vui lòng nhập hậu tố tên Proxy');
      return;
    }

    let finalProxy = { ...newProxy, agent_id: selectedAgent };
    if (newProxy.proxy_type === 'http') {
      if (!subdomain) { alert('Vui lòng nhập Subdomain'); return; }
      finalProxy.custom_domain = `${subdomain}.${import.meta.env.VITE_WILDCARD_DOMAIN || 'v1.ovncr.vn'}`;
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
      alert(data.error || 'Không thể lưu proxy');
    }
  };


  const handleDomainAction = async (domain: string, action: 'status' | 'nginx' | 'cert') => {
    if (!domain) return;
    setDomainBusy(`${action}:${domain}`);
    const url = action === 'status' ? `/api/v1/domains/status?domain=${encodeURIComponent(domain)}` : `/api/v1/domains/${action}`;
    const res = await fetch(url, {
      method: action === 'status' ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: action === 'status' ? undefined : JSON.stringify({ domain })
    });
    setDomainBusy(null);
    if (res.status === 401) { onUnauthorized(); return; }
    const data = await res.json();
    if (!res.ok) { alert(data.error || 'Thao tác tên miền thất bại'); return; }
    setDomainStatuses(prev => ({ ...prev, [domain]: data.status || data }));
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Xóa proxy này?')) {
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
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-8">
        <div><h1 className="text-3xl font-bold text-white">Proxies</h1><p className="text-gray-400">Quản lý tunnel & giám sát cổng agent</p></div>
        <div className="flex flex-col sm:flex-row gap-3">
          <select value={selectedAgent} onChange={e => setSelectedAgent(e.target.value)} className="bg-[#1a1a1c] border border-white/10 rounded-xl p-3 text-white">
            {(agents || []).map(a => <option key={a.id} value={a.id}>{a.name || a.hostname}</option>)}
          </select>
          <button onClick={() => { 
            setIsModalOpen(true); 
            setSubdomain(''); 
            setNameSuffix('');
            setEditingProxy(null); 
            setNewProxy({ name: '', proxy_type: 'tcp', local_ip: '127.0.0.1', local_port: 80, remote_port: 80, status: 'active' }); 
          }} className="bg-neon-blue text-black font-bold px-6 py-3 rounded-xl flex items-center justify-center gap-2"><Plus size={20} /> Thêm mới</button>
        </div>
      </div>

      <div className="space-y-4 mb-8">
        <div className="hidden md:block glass rounded-[32px] overflow-hidden border border-white/10">
          <table className="w-full text-left">
            <thead className="bg-white/5 text-gray-400 text-xs uppercase"><tr><th className="px-6 py-4">Tên</th><th>Ánh xạ</th><th className="px-6">Trạng thái</th><th className="text-right px-6">Thao tác</th></tr></thead>
            <tbody className="divide-y divide-white/5 text-gray-300">
              {(proxies || []).map(p => (
                <tr key={p.id}>
                  <td className="px-6 py-4 font-bold text-white">{p.name}</td>
                  <td><span className="text-gray-500 font-mono text-[10px] mr-1">{p.local_ip}:</span>{p.local_port} → {p.proxy_type==='http'?p.custom_domain:p.remote_port}</td>
                  <td className="px-6"><ProxyStatusBadge status={p.status}/>{p.custom_domain && <DomainHealth status={domainStatuses[p.custom_domain]} />}</td>
                  <td className="text-right px-6 space-x-2">
                    {p.custom_domain && <DomainActions domain={p.custom_domain} busy={domainBusy} onAction={handleDomainAction} />}
                    <button onClick={() => { setEditingProxy(p.id); setNewProxy(p); if (p.name.includes('_')) { setNameSuffix(p.name.split('_').slice(1).join('_')); } else { setNameSuffix(p.name); } if (p.proxy_type === 'http' && p.custom_domain) { setSubdomain(p.custom_domain.split('.')[0]); } setIsModalOpen(true); }} className="text-neon-blue hover:text-white p-2"><Edit2 size={16}/></button>
                    <button onClick={()=>handleDelete(p.id)} className="text-red-400 hover:text-red-300 p-2"><Trash2 size={16}/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="md:hidden space-y-4">
          {(proxies || []).map(p => (
            <div key={p.id} className="glass rounded-2xl p-5 border border-white/10 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-bold text-white text-lg">{p.name}</div>
                  <div className="text-xs text-gray-500 mt-1">Giao thức {p.proxy_type.toUpperCase()}</div>
                </div>
                <ProxyStatusBadge status={p.status}/>
              </div>
              {p.custom_domain && <DomainHealth status={domainStatuses[p.custom_domain]} />}
              <div className="p-3 bg-white/5 rounded-xl font-mono text-sm text-gray-300">
                <div className="flex justify-between mb-1"><span className="text-gray-500">Nội bộ:</span><span>{p.local_ip}:{p.local_port}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Công khai:</span><span className="text-neon-blue">{p.proxy_type==='http'?p.custom_domain:p.remote_port}</span></div>
              </div>
              <div className="flex gap-2 pt-2">
                {p.custom_domain && <button onClick={() => handleDomainAction(p.custom_domain!, 'status')} className="flex-1 bg-white/5 border border-white/10 text-white py-2 rounded-xl flex items-center justify-center gap-2"><Globe size={14}/> DNS</button>}
                <button onClick={() => { setEditingProxy(p.id); setNewProxy(p); if (p.name.includes('_')) { setNameSuffix(p.name.split('_').slice(1).join('_')); } else { setNameSuffix(p.name); } if (p.proxy_type === 'http' && p.custom_domain) { setSubdomain(p.custom_domain.split('.')[0]); } setIsModalOpen(true); }} className="flex-1 bg-white/5 border border-white/10 text-white py-2 rounded-xl flex items-center justify-center gap-2"><Edit2 size={14}/> Sửa</button>
                <button onClick={()=>handleDelete(p.id)} className="flex-1 bg-red-400/10 border border-red-400/20 text-red-400 py-2 rounded-xl flex items-center justify-center gap-2"><Trash2 size={14}/> Xóa</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <h2 className="text-xl font-bold mb-4 text-white">Cổng đang mở trên Agent</h2>
      <div className="glass rounded-2xl md:rounded-[32px] overflow-hidden border border-white/10">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-white/5 text-gray-400 uppercase"><tr><th className="px-6 py-4">Cổng</th><th>Tiến trình</th></tr></thead>
          <tbody className="text-gray-300">
            {(activeAgent?.ports || []).map((p, i) => (
              <tr key={i} className="border-b border-white/5"><td className="px-6 py-3 text-neon-blue">{p.port}</td><td>{p.service_name}</td></tr>
            ))}
            {(!activeAgent?.ports || activeAgent.ports.length === 0) && <tr><td colSpan={2} className="p-6 text-center text-gray-500">Không có dữ liệu</td></tr>}
          </tbody>
        </table>
      </div>
      
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
          <div className="glass max-w-md w-full p-6 sm:p-8 rounded-[32px] border border-white/10 my-auto">
            <h2 className="text-2xl font-bold mb-6 text-white">{editingProxy ? 'Sửa Proxy' : 'Thêm Proxy mới'}</h2>
            <div className="space-y-4 text-white">
              <div>
                <label className="text-xs text-gray-500 font-bold uppercase mb-1 block">Tên Proxy</label>
                <div className="flex items-center bg-white/5 border border-white/10 rounded-xl overflow-hidden focus-within:border-neon-blue/50">
                  <span className="pl-3 py-3 text-gray-500 bg-white/5 border-r border-white/10 text-xs sm:text-sm font-mono whitespace-nowrap shrink-0">
                    {activeAgent?.hostname}_
                  </span>
                  <input type="text" placeholder="suffix" value={nameSuffix} onChange={e => handleSuffixChange(e.target.value)} className="w-full bg-transparent p-3 text-white outline-none text-sm"/>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 font-bold uppercase mb-1 block">IP Nội bộ</label>
                <input type="text" placeholder="127.0.0.1" value={newProxy.local_ip} onChange={e=>setNewProxy({...newProxy, local_ip:e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-neon-blue/50"/>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500 font-bold uppercase mb-1 block">Loại</label>
                  <select value={newProxy.proxy_type} onChange={e=>setNewProxy({...newProxy, proxy_type:e.target.value as any})} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white outline-none">
                    <option value="tcp">TCP</option>
                    <option value="http">HTTP</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-bold uppercase mb-1 block">Cổng Nội bộ</label>
                  <input type="number" value={newProxy.local_port} onChange={e=>setNewProxy({...newProxy, local_port:parseInt(e.target.value)})} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-neon-blue/50"/>
                </div>
              </div>
              
              {newProxy.proxy_type === 'http' ? (
                <div>
                  <label className="text-xs text-gray-500 font-bold uppercase mb-1 block">Tên miền (Subdomain)</label>
                  <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl p-3">
                    <input type="text" placeholder="sub" value={subdomain} onChange={e=>setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} className="bg-transparent outline-none text-white w-full text-right text-sm"/>
                    <span className="text-gray-500 text-xs shrink-0">.{import.meta.env.VITE_WILDCARD_DOMAIN || 'v1.ovncr.vn'}</span>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-xs text-gray-500 font-bold uppercase mb-1 block">Cổng Công khai</label>
                  <input type="number" placeholder="8001" value={newProxy.remote_port} onChange={e=>setNewProxy({...newProxy, remote_port:parseInt(e.target.value)})} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-neon-blue/50"/>
                </div>
              )}

              <div className="pt-4 flex flex-col gap-2">
                <button onClick={handleCreate} className="w-full bg-neon-blue text-black font-bold py-4 rounded-2xl hover:shadow-[0_0_20px_rgba(0,243,255,0.4)] transition-all">
                  {editingProxy ? 'Cập nhật Tunnel' : 'Tạo Tunnel mới'}
                </button>
                <button onClick={()=>setIsModalOpen(false)} className="w-full text-gray-500 py-2 hover:text-white transition-colors">Hủy bỏ</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const DomainHealth: React.FC<{ status?: DomainStatus }> = ({ status }) => {
  if (!status) return <div className="text-[10px] text-gray-500 mt-1">Chưa kiểm tra DNS</div>;
  return (
    <div className="text-[10px] text-gray-400 mt-1 flex flex-wrap gap-2">
      <span className={status.pointed ? 'text-green-400' : 'text-orange-400'}>DNS {status.pointed ? 'OK' : 'chưa trỏ'}</span>
      <span className={status.nginx_ready ? 'text-green-400' : 'text-gray-500'}>Nginx {status.nginx_ready ? 'OK' : 'chưa thiết lập'}</span>
      <span className={status.cert_ready ? 'text-green-400' : 'text-gray-500'}>SSL {status.cert_ready ? 'OK' : 'không thấy'}</span>
    </div>
  );
};

const DomainActions: React.FC<{ domain: string, busy: string | null, onAction: (domain: string, action: 'status' | 'nginx' | 'cert') => void }> = ({ domain, busy, onAction }) => {
  const isBusy = (action: string) => busy === `${action}:${domain}`;
  return (
    <span className="inline-flex gap-1">
      <button title="Kiểm tra DNS" onClick={() => onAction(domain, 'status')} className="text-gray-400 hover:text-white p-2">{isBusy('status') ? <RotateCw size={16} className="animate-spin"/> : <Globe size={16}/>}</button>
      <button title="Thiết lập Nginx (Sẵn sàng WebSocket)" onClick={() => onAction(domain, 'nginx')} className="text-cyan-400 hover:text-white p-2">{isBusy('nginx') ? <RotateCw size={16} className="animate-spin"/> : <Settings size={16}/>}</button>
      <button title="Yêu cầu Chứng chỉ SSL" onClick={() => onAction(domain, 'cert')} className="text-green-400 hover:text-white p-2">{isBusy('cert') ? <RotateCw size={16} className="animate-spin"/> : <Shield size={16}/>}</button>
    </span>
  );
};

const ProxyStatusBadge: React.FC<{ status?: string }> = ({ status }) => {
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
      {status || 'Unknown'}
    </span>
  );
};

const AgentsPage: React.FC<{ agents: DashboardAgent[], token: string, onRefresh: () => void }> = ({ agents, token, onRefresh }) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);
  const origin = window.location.origin;
  const linuxCommand = `curl -fsSL ${origin}/api/v1/install/script?os=linux | sudo bash`;
  const windowsCommand = `powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; iex (Invoke-WebRequest -UseBasicParsing -Uri '${origin}/api/v1/install/script?os=windows').Content"`;

  const startEdit = (agent: DashboardAgent) => {
    setEditingId(agent.id);
    setEditName(agent.name || agent.hostname);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  const saveName = async (agentId: string) => {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/agents/${agentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: editName })
      });
      if (res.ok) {
        onRefresh();
        setEditingId(null);
      }
    } catch (err) {
      console.error('Failed to update agent name:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = async (key: string, value: string) => {
    try {
      await copyToClipboard(value);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((current) => current === key ? null : current), 2000);
    } catch {}
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
      <div className="glass rounded-[32px] p-6 sm:p-8 border border-white/10">
        <div className="flex flex-col sm:flex-row items-start justify-between gap-6 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Máy chủ (Agents)</h1>
            <p className="text-gray-400 mt-2">Cài đặt nhanh lên các máy chủ cần quản lý.</p>
          </div>
          <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/5">
            <div className="text-right">
              <div className="text-3xl font-bold text-neon-blue leading-none">{agents.length}</div>
              <div className="text-[10px] uppercase tracking-widest text-gray-500 mt-1">Tổng số Agent</div>
            </div>
            <Server className="text-neon-blue/40" size={32} />
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <InstallCommandCard
            title="Linux"
            description="Ubuntu, Debian, CentOS"
            command={linuxCommand}
            copied={copiedKey === 'linux'}
            onCopy={() => handleCopy('linux', linuxCommand)}
          />
          <div className="space-y-4">
            <InstallCommandCard
              title="Windows"
              description="Chạy trong Admin PowerShell"
              command={windowsCommand}
              copied={copiedKey === 'windows'}
              onCopy={() => handleCopy('windows', windowsCommand)}
            />
            <div className="px-4">
              <a 
                href={`${origin}/downloads/proxymanager-agent-windows.zip`}
                className="inline-flex items-center gap-2 text-xs text-neon-blue hover:underline bg-neon-blue/5 px-3 py-2 rounded-lg border border-neon-blue/20"
              >
                <Download size={14} /> Tải file ZIP (Dùng thủ công nếu bị Antivirus chặn)
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-bold text-white px-2">Danh sách Agents đã đăng ký</h2>
        
        <div className="hidden lg:block glass rounded-[32px] overflow-hidden border border-white/10">
          <table className="w-full text-left">
            <thead className="bg-white/5 text-gray-400 text-xs uppercase">
              <tr>
                <th className="px-6 py-4">Tên / Hostname</th>
                <th>Địa chỉ IP</th>
                <th>Hệ điều hành</th>
                <th>Trạng thái</th>
                <th>Kết nối cuối</th>
                <th className="px-6 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-gray-300">
              {agents.length > 0 ? agents.map((agent) => (
                <tr key={agent.id}>
                  <td className="px-6 py-4">
                    {editingId === agent.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:border-neon-blue"
                          autoFocus
                        />
                        <button onClick={() => saveName(agent.id)} disabled={saving} className="text-green-400 hover:text-green-300">
                          {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                        </button>
                        <button onClick={cancelEdit} className="text-red-400 hover:text-red-300">
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 group">
                        <div>
                          <div className="font-bold text-white">{agent.name || agent.hostname}</div>
                          {agent.name && <div className="text-[10px] text-gray-400">Host: {agent.hostname}</div>}
                          <div className="text-[10px] text-gray-500 font-mono">{agent.id}</div>
                        </div>
                        <button onClick={() => startEdit(agent)} className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-neon-blue transition-opacity">
                          <Edit2 size={14} />
                        </button>
                      </div>
                    )}
                  </td>
                  <td>{agent.private_ip || '-'}</td>
                  <td>{agent.os || '-'}</td>
                  <td>
                    <span className={agent.status === 'online' ? 'text-green-400 flex items-center gap-2' : 'text-gray-500 flex items-center gap-2'}>
                      <span className={`w-1.5 h-1.5 rounded-full ${agent.status==='online'?'bg-green-400 animate-pulse':'bg-gray-500'}`} />
                      {agent.status === 'online' ? 'Trực tuyến' : 'Ngoại tuyến'}
                    </span>
                  </td>
                  <td>{agent.last_heartbeat ? new Date(agent.last_heartbeat).toLocaleTimeString() : '-'}</td>
                  <td className="px-6 py-4 text-right"></td>
                </tr>
              )) : (
                <tr><td colSpan={6} className="px-6 py-10 text-center text-gray-500 italic">Chưa có agent nào đăng ký.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="lg:hidden space-y-4">
          {agents.length > 0 ? agents.map((agent) => (
            <div key={agent.id} className="glass rounded-2xl p-5 border border-white/10 space-y-4">
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  {editingId === agent.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:border-neon-blue w-full"
                        autoFocus
                      />
                      <button onClick={() => saveName(agent.id)} disabled={saving} className="text-green-400">
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                      </button>
                      <button onClick={cancelEdit} className="text-red-400">
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="truncate">
                        <div className="font-bold text-white text-lg truncate">{agent.name || agent.hostname}</div>
                        {agent.name && <div className="text-[10px] text-gray-400 truncate">Host: {agent.hostname}</div>}
                        <div className="text-[10px] text-gray-500 font-mono mt-1">{agent.id}</div>
                      </div>
                      <button onClick={() => startEdit(agent)} className="p-1 text-gray-500">
                        <Edit2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
                <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ml-2 ${agent.status==='online'?'bg-green-400/10 text-green-400 border border-green-400/20':'bg-white/5 text-gray-500'}`}>
                  {agent.status}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-white/5 p-3 rounded-xl">
                  <div className="text-gray-500 text-[10px] uppercase mb-1">Hệ điều hành</div>
                  <div className="text-gray-300 truncate">{agent.os || '-'}</div>
                </div>
                <div className="bg-white/5 p-3 rounded-xl">
                  <div className="text-gray-500 text-[10px] uppercase mb-1">IP nội bộ</div>
                  <div className="text-gray-300 truncate">{agent.private_ip || '-'}</div>
                </div>
              </div>
              <div className="text-center text-[10px] text-gray-500 border-t border-white/5 pt-3">
                Lần cuối liên lạc: {agent.last_heartbeat ? new Date(agent.last_heartbeat).toLocaleString() : '-'}
              </div>
            </div>
          )) : (
            <div className="p-10 text-center text-gray-500 glass rounded-2xl border border-white/10 italic">Không tìm thấy agent.</div>
          )}
        </div>
      </div>
    </div>
  );
};

const LogsPage: React.FC<{ logs: LogEntry[] }> = ({ logs }) => (
  <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
    <h1 className="text-3xl font-bold mb-8 text-white">Nhật ký hệ thống</h1>
    <div className="glass rounded-[32px] overflow-hidden border border-white/10">
      <table className="w-full text-left text-xs font-mono">
        <thead className="bg-white/5 text-gray-400"><tr><th className="px-6 py-4">Thời gian</th><th>Agent</th><th>Nội dung</th></tr></thead>
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
        setError('Bạn cần quyền Admin để quản lý cài đặt.');
        return;
      }
      if (!res.ok) {
        setError('Không thể tải cài đặt.');
        return;
      }
      const data = await res.json();
      setSettings(data.map((item: any) => ({ key: String(item.key ?? ''), value: String(item.value ?? '') })));
    } catch {
      setError('Lỗi khi tải cài đặt.');
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
        setError('Quyền hạn không đủ.');
        return;
      }
      if (!res.ok) {
        setError('Không thể lưu cài đặt.');
        return;
      }
      setNotice(`Đã lưu ${entry.key}`);
      setTimeout(() => setNotice(''), 2000);
      await fetchSettings();
    } catch {
      setError('Lỗi máy chủ.');
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
        <h1 className="text-3xl font-bold text-white">Cấu hình</h1>
        <p className="text-gray-400 mt-2">Quản lý các cài đặt Key-Value trên hệ thống.</p>
        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
        {notice && <p className="mt-4 text-sm text-green-400">{notice}</p>}
      </div>

      <div className="glass rounded-[32px] p-8 border border-white/10">
        <h2 className="text-xl font-bold text-white mb-4">Thêm mới cài đặt</h2>
        <div className="grid gap-4 md:grid-cols-[1fr,1fr,auto]">
          <input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="Key" className="bg-white/5 border border-white/10 rounded-xl p-3 text-white" />
          <input value={newValue} onChange={(e) => setNewValue(e.target.value)} placeholder="Value" className="bg-white/5 border border-white/10 rounded-xl p-3 text-white" />
          <button onClick={addSetting} className="bg-neon-blue text-black font-bold px-6 py-3 rounded-xl">Thêm</button>
        </div>
      </div>

      <div className="glass rounded-[32px] overflow-hidden border border-white/10">
        <div className="px-8 py-6 border-b border-white/5">
          <h2 className="text-xl font-bold text-white">Cài đặt hiện tại</h2>
        </div>
        {loading ? (
          <div className="p-8 text-gray-400">Đang tải...</div>
        ) : (
          <div className="divide-y divide-white/5">
            {settings.length > 0 ? settings.map((entry) => (
              <SettingRow key={entry.key} entry={entry} saving={savingKey === entry.key} onSave={saveSetting} />
            )) : (
              <div className="p-8 text-gray-500">Chưa có cài đặt nào được lưu.</div>
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
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8 pb-10">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Giám sát: {activeAgent?.name || activeAgent?.hostname || 'Agent'}</h1>
          <p className="text-gray-400 mt-2 italic text-sm">Phân tích hiệu suất theo thời gian thực của {activeAgent?.hostname}.</p>
        </div>
        <select value={selectedAgent} onChange={(e) => setSelectedAgent(e.target.value)} className="bg-[#1a1a1c] border border-white/10 rounded-xl p-4 text-white w-full lg:w-[300px] shadow-lg">
          {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name || agent.hostname}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
        <StatCard title="CPU" value={currentHardware ? `${Math.round(currentHardware.cpu_usage)}%` : '-'} change="Sử dụng" icon={<Cpu className="text-neon-blue" size={18}/>}/>
        <StatCard title="RAM" value={currentHardware ? `${Math.round((currentHardware.ram_used / (currentHardware.ram_total || 1)) * 100)}%` : '-'} change="Đã dùng" icon={<Monitor className="text-green-400" size={18}/>}/>
        <StatCard title="Luồng tải vào" value={currentHardware ? `${formatBytes(currentHardware.net_in)}/s` : '-'} change="RX" icon={<Activity className="text-yellow-400" size={18}/>}/>
        <StatCard title="Luồng tải ra" value={currentHardware ? `${formatBytes(currentHardware.net_out)}/s` : '-'} change="TX" icon={<Network className="text-neon-purple" size={18}/>}/>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 sm:gap-8">
        <div className="glass rounded-[32px] p-6 sm:p-8 border border-white/10 h-80">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-white flex items-center gap-2"><Cpu size={16} className="text-neon-blue"/> CPU & RAM (%)</h3>
            <div className="flex gap-3 text-[10px] uppercase font-bold">
              <span className="flex items-center gap-1.5 text-neon-blue"><span className="w-2 h-2 rounded-full bg-neon-blue"/> CPU</span>
              <span className="flex items-center gap-1.5 text-green-400"><span className="w-2 h-2 rounded-full bg-green-400"/> RAM</span>
            </div>
          </div>
          {loading && history.length === 0 ? <p className="text-gray-500 text-center pt-20">Đang tải...</p> : (
            <ResponsiveContainer width="100%" height="85%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="cpuFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#00f3ff" stopOpacity={0.2}/><stop offset="95%" stopColor="#00f3ff" stopOpacity={0}/></linearGradient>
                  <linearGradient id="ramFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#4ade80" stopOpacity={0.2}/><stop offset="95%" stopColor="#4ade80" stopOpacity={0}/></linearGradient>
                </defs>
                <CartesianGrid stroke="#ffffff05" vertical={false} />
                <XAxis dataKey="time" hide />
                <YAxis stroke="#ffffff20" fontSize={10} domain={[0, 100]} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{backgroundColor:'#1a1a1c', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'16px', color:'#fff'}} />
                <Area type="monotone" dataKey="cpu" stroke="#00f3ff" fill="url(#cpuFill)" strokeWidth={2} isAnimationActive={false} />
                <Area type="monotone" dataKey="ram" stroke="#4ade80" fill="url(#ramFill)" strokeWidth={2} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="glass rounded-[32px] p-6 sm:p-8 border border-white/10 h-80">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-white flex items-center gap-2"><Activity size={16} className="text-yellow-400"/> Băng thông (KB/s)</h3>
          </div>
          {loading && history.length === 0 ? <p className="text-gray-500 text-center pt-20">Đang tải...</p> : (
            <ResponsiveContainer width="100%" height="85%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="rxFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2}/><stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/></linearGradient>
                  <linearGradient id="txFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#a78bfa" stopOpacity={0.2}/><stop offset="95%" stopColor="#a78bfa" stopOpacity={0}/></linearGradient>
                </defs>
                <CartesianGrid stroke="#ffffff05" vertical={false} />
                <XAxis dataKey="time" hide />
                <YAxis stroke="#ffffff20" fontSize={10} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{backgroundColor:'#1a1a1c', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'16px', color:'#fff'}} />
                <Area type="monotone" dataKey="rx" stroke="#f59e0b" fill="url(#rxFill)" strokeWidth={2} isAnimationActive={false} />
                <Area type="monotone" dataKey="tx" stroke="#a78bfa" fill="url(#txFill)" strokeWidth={2} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="glass rounded-[32px] p-6 sm:p-8 border border-white/10">
        <h2 className="text-xl font-bold text-white mb-6">Thông tin hệ thống</h2>
        {activeAgent ? (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <InfoTile label="Tên máy chủ" value={activeAgent.hostname} />
            <InfoTile label="IP Nội bộ" value={activeAgent.private_ip || '-'} />
            <InfoTile label="Hệ điều hành" value={activeAgent.os || '-'} />
            <InfoTile label="Liên lạc lần cuối" value={activeAgent.last_heartbeat ? new Date(activeAgent.last_heartbeat).toLocaleTimeString() : '-'} />
          </div>
        ) : (
          <p className="text-gray-500 italic">Chọn một agent để xem chi tiết.</p>
        )}
      </div>
    </div>
  );
};

const InfoTile: React.FC<{ label: string, value: string }> = ({ label, value }) => (
  <div className="rounded-2xl bg-white/5 p-5 border border-white/5">
    <div className="text-gray-500 uppercase text-[10px] font-bold tracking-widest mb-2">{label}</div>
    <div className="text-white font-bold truncate">{value}</div>
  </div>
);

const UsersPage: React.FC<{ token: string, onUnauthorized: () => void }> = ({ token, onUnauthorized }) => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [error, setError] = useState('');

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/v1/users', { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.status === 401) return onUnauthorized();
      if (res.ok) setUsers(await res.json());
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const url = editingUser ? `/api/v1/users/${editingUser.id}` : '/api/v1/users';
    const method = editingUser ? 'PUT' : 'POST';
    const payload: any = { role };
    if (!editingUser) payload.username = username;
    if (password) payload.password = password;
    
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      if (res.status === 401) return onUnauthorized();
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Thao tác thất bại');
      }
      setIsModalOpen(false);
      fetchUsers();
    } catch (err: any) { setError(err.message); }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Xóa người dùng này?')) return;
    try {
      const res = await fetch(`/api/v1/users/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      if (res.status === 401) return onUnauthorized();
      if (res.ok) fetchUsers();
    } catch {}
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Người dùng</h1>
          <p className="text-gray-400 mt-2">Quản lý truy cập và quyền hạn.</p>
        </div>
        <button onClick={() => { setEditingUser(null); setUsername(''); setPassword(''); setRole('user'); setIsModalOpen(true); }} className="bg-neon-blue text-black font-bold px-6 py-3 rounded-xl flex items-center gap-2"><Plus size={20} /> Thêm người dùng</button>
      </div>

      <div className="glass rounded-[32px] overflow-hidden border border-white/10">
        {loading ? <div className="p-8 text-center text-gray-500">Đang tải...</div> : (
          <table className="w-full text-left">
            <thead className="bg-white/5 text-gray-400 text-xs uppercase"><tr><th className="px-6 py-4">Tên đăng nhập</th><th>Quyền</th><th>Ngày tạo</th><th className="text-right px-6">Thao tác</th></tr></thead>
            <tbody className="divide-y divide-white/5 text-gray-300">
              {users.map(u => (
                <tr key={u.id} className="border-b border-white/5">
                  <td className="px-6 py-4 font-bold text-white flex items-center gap-3">
                    <img src={`https://ui-avatars.com/api/?name=${u.username}&background=00f3ff`} className="w-8 h-8 rounded-full" alt="" />
                    {u.username}
                  </td>
                  <td><span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${u.role==='admin'?'bg-neon-purple/20 text-neon-purple':'bg-white/10 text-gray-400'}`}>{u.role}</span></td>
                  <td className="text-sm text-gray-400">{new Date(u.created_at).toLocaleString()}</td>
                  <td className="text-right px-6 space-x-2">
                    <button onClick={() => { setEditingUser(u); setUsername(u.username); setPassword(''); setRole(u.role); setIsModalOpen(true); }} className="text-neon-blue hover:text-white p-2"><Edit2 size={16}/></button>
                    <button onClick={() => handleDelete(u.id)} className="text-red-400 hover:text-red-300 p-2"><Trash2 size={16}/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="glass max-w-md w-full p-8 rounded-[32px] border border-white/10">
            <h2 className="text-2xl font-bold mb-6 text-white">{editingUser ? 'Sửa người dùng' : 'Thêm người dùng mới'}</h2>
            <form onSubmit={handleSave} className="space-y-4">
              {!editingUser && (
                <div><label className="text-xs text-gray-500 font-bold uppercase mb-1 block">Tên đăng nhập</label><input type="text" value={username} onChange={e=>setUsername(e.target.value)} required className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-neon-blue/50" /></div>
              )}
              <div><label className="text-xs text-gray-500 font-bold uppercase mb-1 block">{editingUser ? 'Mật khẩu mới (để trống nếu không đổi)' : 'Mật khẩu'}</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} required={!editingUser} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-neon-blue/50" /></div>
              <div>
                <label className="text-xs text-gray-500 font-bold uppercase mb-1 block">Vai trò</label>
                <select value={role} onChange={e=>setRole(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white outline-none">
                  <option value="user">Người dùng (Chỉ xem Proxy)</option>
                  <option value="admin">Quản trị viên (Toàn quyền)</option>
                </select>
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <div className="pt-4 flex gap-2">
                <button type="submit" className="flex-1 bg-neon-blue text-black font-bold py-3 rounded-xl hover:shadow-[0_0_20px_rgba(0,243,255,0.4)]">Lưu lại</button>
                <button type="button" onClick={()=>setIsModalOpen(false)} className="flex-1 bg-white/5 text-gray-400 hover:text-white py-3 rounded-xl transition-colors">Hủy bỏ</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const ProfilePage: React.FC<{ user: User }> = ({ user }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu mới không khớp');
      return;
    }
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch('/api/v1/users/me/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Không thể đổi mật khẩu');
      setMessage('Đã cập nhật mật khẩu thành công');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h1 className="text-3xl font-bold mb-8 text-white">Hồ sơ cá nhân</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="glass rounded-[32px] p-8 border border-white/10">
          <div className="flex items-center gap-6 mb-8">
            <img src={user.avatar} className="w-20 h-20 rounded-full border-2 border-neon-blue" alt="Avatar" />
            <div>
              <h2 className="text-2xl font-bold text-white">{user.username}</h2>
              <p className="text-neon-blue font-bold uppercase text-xs">{user.role === 'admin' ? 'Quản trị viên' : 'Người dùng'}</p>
            </div>
          </div>
          <div className="space-y-4 text-gray-400">
            <div><p className="text-xs uppercase font-bold text-gray-500">Địa chỉ Email</p><p className="text-white">{user.email}</p></div>
          </div>
        </div>

        <div className="glass rounded-[32px] p-8 border border-white/10">
          <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-white"><Key size={20} className="text-yellow-400" /> Đổi mật khẩu</h3>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <input type="password" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)} placeholder="Mật khẩu hiện tại" required className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:border-neon-blue/50 outline-none" />
            <input type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="Mật khẩu mới" required minLength={6} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:border-neon-blue/50 outline-none" />
            <input type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Xác nhận mật khẩu mới" required minLength={6} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:border-neon-blue/50 outline-none" />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            {message && <p className="text-green-400 text-sm">{message}</p>}
            <button type="submit" disabled={loading} className="w-full bg-neon-blue text-black font-bold py-3 rounded-xl disabled:opacity-50 transition-all hover:shadow-[0_0_20px_rgba(0,243,255,0.4)]">
              {loading ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const initialAuth = getInitialAuthState();
  const [activeTab, setActiveTab] = useState(localStorage.getItem('activeTab') || 'dashboard');
  const [user, setUser] = useState<User | null>(initialAuth.user);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
    setIsSidebarOpen(false);
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
      setLogs(data.map((item: any, index: number) => {
        const ag = agents.find((agent) => agent.id === String(item.agent_id ?? ''));
        return {
          id: String(item.id ?? `${index}`),
          agent_id: String(item.agent_id ?? ''),
          agent_name: ag ? (ag.name || ag.hostname) : String(item.agent_id ?? 'Agent'),
          severity: String(item.log_level ?? 'info'),
          message: String(item.message ?? ''),
          timestamp: String(item.timestamp ?? item.created_at ?? new Date().toISOString())
        };
      }));
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
            const { agent_id, message } = msg.payload;
            setLogs(p => [{ 
              id: Math.random().toString(), 
              agent_id, 
              agent_name: 'Agent',
              severity:'info', 
              message, 
              timestamp: new Date().toISOString() 
            }, ...p].slice(0, 100));
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
    <div className="flex h-screen w-full bg-[#0a0a0c] text-white font-sans overflow-hidden relative">
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[40] lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside className={`fixed lg:static inset-y-0 left-0 w-72 glass border-r border-white/10 flex flex-col shrink-0 z-[50] transition-transform duration-300 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-6 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-3">
            <Shield className="text-neon-blue w-8 h-8" />
            <span className="font-bold text-xl tracking-tight">ProxyManager</span>
          </div>
          <button className="lg:hidden text-gray-400" onClick={() => setIsSidebarOpen(false)}>
            <Edit2 className="rotate-45" size={24} />
          </button>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          <SidebarItem icon={<LayoutDashboard size={20}/>} label="Tổng quan" active={activeTab==='dashboard'} onClick={()=>setActiveTab('dashboard')}/>
          <SidebarItem icon={<Server size={20}/>} label="Máy chủ (Agents)" active={activeTab==='agents'} onClick={()=>setActiveTab('agents')}/>
          <SidebarItem icon={<Cpu size={20}/>} label="Giám sát" active={activeTab==='monitor'} onClick={()=>setActiveTab('monitor')}/>
          <SidebarItem icon={<Network size={20}/>} label="Tunnels (Proxies)" active={activeTab==='proxies'} onClick={()=>setActiveTab('proxies')}/>
          {user?.role === 'admin' && (
            <>
              <SidebarItem icon={<Activity size={20}/>} label="Trạng thái Host" active={activeTab==='host'} onClick={()=>setActiveTab('host')}/>
              <SidebarItem icon={<Users size={20}/>} label="Người dùng" active={activeTab==='users'} onClick={()=>setActiveTab('users')}/>
              <SidebarItem icon={<FileText size={20}/>} label="Nhật ký" active={activeTab==='logs'} onClick={()=>setActiveTab('logs')}/>
              <SidebarItem icon={<Settings size={20}/>} label="Cài đặt" active={activeTab==='settings'} onClick={()=>setActiveTab('settings')}/>
            </>
          )}
          <SidebarItem icon={<FileText size={20}/>} label="Tài liệu" active={activeTab==='docs'} onClick={()=>setActiveTab('docs')}/>
        </nav>
        <div className="p-6 border-t border-white/5">
          <button onClick={()=>{clearAuthData(); setIsAuthenticated(false);}} className="flex items-center gap-3 text-gray-400 hover:text-red-400 transition-colors">
            <LogOut size={18}/>
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-neon-blue/5 via-transparent to-transparent flex flex-col">
        <header className="h-20 px-4 lg:px-8 flex items-center justify-between border-b border-white/5 bg-[#0a0a0c]/80 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <button 
              className="lg:hidden p-2 rounded-xl bg-white/5 text-gray-400"
              onClick={() => setIsSidebarOpen(true)}
            >
              <LayoutDashboard size={20} />
            </button>
            <div className={`px-3 py-1.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${wsConnected?'border-green-400/20 text-green-400':'border-red-400/20 text-red-400'}`}>
              {wsConnected?'LIVE':'OFFLINE'}
            </div>
          </div>
          
          <div className="flex items-center gap-3 bg-white/5 p-1.5 rounded-full pr-4 cursor-pointer hover:bg-white/10" onClick={()=>setActiveTab('profile')}>
            <div className="h-8 w-8 rounded-full bg-neon-blue/20 flex items-center justify-center text-neon-blue font-bold">
              <User size={16}/>
            </div>
            <span className="text-sm font-medium hidden sm:inline">{user?.username}</span>
          </div>
        </header>
        
        <div className="p-4 lg:p-8 max-w-7xl mx-auto w-full">
          {activeTab === 'dashboard' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h1 className="text-3xl font-bold mb-8 text-white">Tổng quan hệ thống</h1>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <StatCard title="Agents" value={agents.length.toString()} change={`${agents.filter(a=>a.status==='online').length} Đang chạy`} icon={<Server className="text-neon-blue"/>}/>
                <StatCard title="Lưu lượng" value={formatBytes(trafficStats.total_rx+trafficStats.total_tx)} change="Tổng cộng" icon={<Activity className="text-green-400"/>}/>
                <StatCard title="Tải CPU" value={`${Math.round(agents.reduce((s,a)=>s+(a.hardware?.cpu_usage||0),0)/(agents.length||1))}%`} change="Trung bình" icon={<Cpu className="text-neon-purple"/>}/>
                <StatCard title="Uptime" value="99.9%" change="Ổn định" icon={<Shield className="text-yellow-400"/>}/>
              </div>
              <div className="glass rounded-[32px] p-8 border border-white/10 h-80">
                <h3 className="font-bold mb-6 flex items-center gap-2 text-neon-blue text-white"><Activity size={18}/> Tải hạ tầng thời gian thực</h3>
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
          {activeTab === 'agents' && <AgentsPage agents={agents} token={token!} onRefresh={fetchData} />}
          {activeTab === 'monitor' && <AgentMonitorPage agents={agents} token={token!} onUnauthorized={handleUnauthorized} />}
          {activeTab === 'host' && user?.role === 'admin' && <HostStatusPage token={token!} onUnauthorized={handleUnauthorized} />}
          {activeTab === 'proxies' && <ProxiesPage agents={agents} token={token!} onUnauthorized={handleUnauthorized} />}
          {activeTab === 'users' && user?.role === 'admin' && <UsersPage token={token!} onUnauthorized={handleUnauthorized} />}
          {activeTab === 'logs' && user?.role === 'admin' && <LogsPage logs={logs} />}
          {activeTab === 'docs' && <DocsPage />}
          {activeTab === 'settings' && user?.role === 'admin' && <SettingsPage token={token!} onUnauthorized={handleUnauthorized} />}
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
  <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6 min-w-0">
    <div className="flex items-start justify-between gap-4 mb-4">
      <div>
        <h3 className="text-lg font-bold text-white">{title}</h3>
        <p className="text-sm text-gray-400 mt-1">{description}</p>
      </div>
      <button onClick={onCopy} className="inline-flex items-center gap-2 rounded-xl bg-neon-blue px-4 py-2 text-sm font-bold text-black">
        {copied ? <Check size={16} /> : <Copy size={16} />}
        {copied ? 'Đã chép' : 'Sao chép'}
      </button>
    </div>
    <pre className="overflow-x-auto w-full rounded-2xl bg-black/40 p-4 text-xs text-neon-blue whitespace-nowrap">
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
        {saving ? 'Đang lưu...' : 'Lưu'}
      </button>
    </div>
  );
};


const DocsPage: React.FC = () => (
  <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8 pb-20">
    <div>
      <h1 className="text-3xl font-bold text-white">Tài liệu hướng dẫn</h1>
      <p className="text-gray-400 mt-2">Hướng dẫn vận hành ProxyManager v1.2.0 (Nội bộ)</p>
    </div>

    <div className="grid gap-8 lg:grid-cols-2">
      <div className="glass rounded-[32px] p-8 border border-white/10">
        <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-neon-blue"><Download size={20} /> 1. Cài đặt Agent</h3>
        <div className="space-y-4 text-sm text-gray-300 leading-relaxed">
          <p>Để quản lý một máy chủ từ xa, bạn cần cài đặt Agent lên máy đó:</p>
          <ol className="list-decimal list-inside space-y-2">
            <li>Vào mục <span className="text-white font-bold">Máy chủ (Agents)</span> trong sidebar.</li>
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
            <p>Sử dụng định dạng <code className="text-neon-blue">[subdomain].{import.meta.env.VITE_WILDCARD_DOMAIN || 'v1.ovncr.vn'}</code>. Hệ thống sẽ tự động cấp SSL/TLS ở lớp ngoài.</p>
          </div>
          <div>
            <p className="font-bold text-white mb-1">TCP/UDP Proxy:</p>
            <p>Cần nhập <span className="text-white font-bold">Cổng Công khai</span> (từ 10000 - 20000). Đây là cổng bạn sẽ dùng để truy cập dịch vụ từ xa.</p>
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
