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
  X,
  Mail,
  CheckCircle2,
  AlertTriangle,
  Send,
  UserCheck,
  ShieldAlert,
  Terminal,
  Lock,
  Save,
  Bell,
  Clock
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
interface ManagerInfo {
  user_id: number;
  username: string;
  email?: string;
  is_verified: boolean;
}

interface User {
  id?: number;
  username: string;
  role: string;
  email: string;
  is_verified?: boolean;
  avatar?: string;
  created_at?: string;
}

interface HardwareStats {
  cpu_usage: number;
  ram_total: number;
  ram_used: number;
  disk_free: number;
  net_in: number;
  net_out: number;
  cpu_temp?: number;
  disk_total?: number;
  disk_used?: number;
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
  managers?: ManagerInfo[];
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
const formatBytes = (bytes: number | undefined | null) => {
  if (bytes === undefined || bytes === null || isNaN(bytes) || bytes <= 0) return '0 B';
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
  const [selectedAgent, setSelectedAgent] = useState(() => localStorage.getItem('selectedAgent_proxies') || '');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProxy, setEditingProxy] = useState<number | null>(null);
  const [newProxy, setNewProxy] = useState<Partial<Proxy>>({ name: '', proxy_type: 'tcp', local_ip: '127.0.0.1', local_port: 80, remote_port: 80, status: 'active' });
  const [subdomain, setSubdomain] = useState('');
  const [nameSuffix, setNameSuffix] = useState('');
  const [domainStatuses, setDomainStatuses] = useState<Record<string, DomainStatus>>({});
  const [domainBusy, setDomainBusy] = useState<string | null>(null);
  const [domainMode, setDomainMode] = useState<'subdomain' | 'custom'>('subdomain');
  const [customDomainInput, setCustomDomainInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeAgent = agents.find(a => a.id === selectedAgent);

  useEffect(() => {
    const saved = localStorage.getItem('selectedAgent_proxies');
    const onlineAgents = (agents || []).filter(a => a.status === 'online');
    const isValidSaved = saved && onlineAgents.some(a => a.id === saved);

    if (isValidSaved) {
      setSelectedAgent(saved!);
    } else if (onlineAgents.length > 0) {
      setSelectedAgent(onlineAgents[0].id);
      localStorage.setItem('selectedAgent_proxies', onlineAgents[0].id);
    }
  }, [agents]);

  useEffect(() => {
    if (selectedAgent) {
      localStorage.setItem('selectedAgent_proxies', selectedAgent);
    }
  }, [selectedAgent]);
  
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

  const startCreateProxy = () => {
    setEditingProxy(null);
    setNewProxy({ name: '', proxy_type: 'tcp', local_ip: '127.0.0.1', local_port: 80, remote_port: 80, status: 'active' });
    setSubdomain('');
    setCustomDomainInput('');
    setDomainMode('subdomain');
    setNameSuffix('');
    setIsModalOpen(true);
  };

  const startEditProxy = (p: Proxy) => {
    setEditingProxy(p.id);
    setNewProxy(p);
    if (p.name.includes('_')) {
      setNameSuffix(p.name.split('_').slice(1).join('_'));
    } else {
      setNameSuffix(p.name);
    }
    
    if (p.proxy_type === 'http' && p.custom_domain) {
      const suffix = import.meta.env.VITE_WILDCARD_DOMAIN || 'v1.ovncr.vn';
      if (p.custom_domain.endsWith('.' + suffix)) {
        setDomainMode('subdomain');
        setSubdomain(p.custom_domain.slice(0, p.custom_domain.length - suffix.length - 1));
        setCustomDomainInput('');
      } else {
        setDomainMode('custom');
        setSubdomain('');
        setCustomDomainInput(p.custom_domain);
      }
    } else {
      setDomainMode('subdomain');
      setSubdomain('');
      setCustomDomainInput('');
    }
    setIsModalOpen(true);
  };

  const handleCreate = async () => {
    if (isSubmitting) return;
    if (!nameSuffix && !editingProxy) {
      alert('Vui lòng nhập hậu tố tên Proxy');
      return;
    }

    let finalProxy = { ...newProxy, agent_id: selectedAgent };
    if (newProxy.proxy_type === 'http') {
      if (domainMode === 'subdomain') {
        if (!subdomain) {
          alert('Vui lòng nhập Subdomain');
          return;
        }
        finalProxy.custom_domain = `${subdomain}.${import.meta.env.VITE_WILDCARD_DOMAIN || 'v1.ovncr.vn'}`;
      } else {
        if (!customDomainInput) {
          alert('Vui lòng nhập Tên miền riêng (Custom Domain)');
          return;
        }
        const domainRegex = /^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/;
        if (!domainRegex.test(customDomainInput)) {
          alert('Tên miền riêng không hợp lệ (Ví dụ: yourdomain.com hoặc app.yourdomain.com)');
          return;
        }
        finalProxy.custom_domain = customDomainInput;
      }
      delete finalProxy.remote_port;
    }

    const url = editingProxy ? `/api/v1/proxies/${editingProxy}` : '/api/v1/proxies';
    const method = editingProxy ? 'PUT' : 'POST';

    setIsSubmitting(true);
    try {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(finalProxy) });
      if (res.status === 401) {
        onUnauthorized();
        return;
      }
      if (res.ok) { 
        setIsModalOpen(false); 
        setEditingProxy(null); 
        setNameSuffix(''); 
        fetchProxies(); 
      } else {
        const data = await res.json();
        alert(data.error || 'Không thể lưu proxy');
      }
    } catch (e: any) {
      alert('Lỗi kết nối khi lưu proxy: ' + (e.message || e));
    } finally {
      setIsSubmitting(false);
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
            {(agents || []).filter(a => a.status === 'online').map(a => <option key={a.id} value={a.id}>{a.name || a.hostname}</option>)}
            {(agents || []).filter(a => a.status === 'online').length === 0 && <option value="">Không có agent trực tuyến</option>}
          </select>
          <button onClick={startCreateProxy} className="bg-neon-blue text-black font-bold px-6 py-3 rounded-xl flex items-center justify-center gap-2"><Plus size={20} /> Thêm mới</button>
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
                    <button onClick={() => startEditProxy(p)} className="text-neon-blue hover:text-white p-2"><Edit2 size={16}/></button>
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
                <button onClick={() => startEditProxy(p)} className="flex-1 bg-white/5 border border-white/10 text-white py-2 rounded-xl flex items-center justify-center gap-2"><Edit2 size={14}/> Sửa</button>
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
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-gray-500 font-bold uppercase mb-1.5 block">Loại Tên Miền</label>
                    <div className="grid grid-cols-2 p-1 bg-white/5 border border-white/10 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setDomainMode('subdomain')}
                        className={`py-2 text-xs font-bold rounded-lg transition-all duration-300 ${
                          domainMode === 'subdomain'
                            ? 'bg-neon-blue text-black shadow-[0_0_15px_rgba(0,243,255,0.3)]'
                            : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        Subdomain Hệ Thống
                      </button>
                      <button
                        type="button"
                        onClick={() => setDomainMode('custom')}
                        className={`py-2 text-xs font-bold rounded-lg transition-all duration-300 ${
                          domainMode === 'custom'
                            ? 'bg-neon-blue text-black shadow-[0_0_15px_rgba(0,243,255,0.3)]'
                            : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        Tên Miền Riêng
                      </button>
                    </div>
                  </div>

                  {domainMode === 'subdomain' ? (
                    <div>
                      <label className="text-xs text-gray-500 font-bold uppercase mb-1.5 block font-mono">Tên miền (Subdomain)</label>
                      <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl p-3 focus-within:border-neon-blue/50 transition-all duration-200">
                        <input
                          type="text"
                          placeholder="sub"
                          value={subdomain}
                          onChange={e => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                          className="bg-transparent outline-none text-white w-full text-right text-sm font-mono"
                        />
                        <span className="text-gray-500 text-xs shrink-0 font-mono">
                          .{import.meta.env.VITE_WILDCARD_DOMAIN || 'v1.ovncr.vn'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="text-xs text-gray-500 font-bold uppercase mb-1.5 block font-mono">Tên Miền Riêng</label>
                      <div className="flex items-center bg-white/5 border border-white/10 rounded-xl p-3 focus-within:border-neon-blue/50 transition-all duration-200">
                        <input
                          type="text"
                          placeholder="domain.com hoặc sub.domain.com"
                          value={customDomainInput}
                          onChange={e => setCustomDomainInput(e.target.value.toLowerCase().replace(/[^a-z0-9.-]/g, ''))}
                          className="bg-transparent outline-none text-white w-full text-sm font-mono"
                        />
                      </div>
                      <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">
                        Lưu ý: Vui lòng cấu hình bản ghi <code className="text-neon-blue">A</code> trỏ về IP máy chủ của bạn trước khi thực hiện các thao tác thiết lập Nginx và kích hoạt SSL.
                      </p>
                    </div>
                  )}

                  {/* Premium Notice about default optimization */}
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2.5">
                    <div className="flex items-center gap-2 text-neon-blue text-xs font-bold uppercase font-mono tracking-wider">
                      <svg className="w-4 h-4 text-neon-blue animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Cấu hình Nginx mặc định tối ưu:
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px]">
                      <div className="bg-[#1a1a1c]/60 border border-white/5 rounded-lg p-2 flex flex-col justify-between">
                        <span className="text-gray-400 block font-bold mb-1 font-mono uppercase tracking-wider text-[9px]">WebSockets</span>
                        <span className="text-neon-blue font-semibold">Tự động hỗ trợ</span>
                      </div>
                      <div className="bg-[#1a1a1c]/60 border border-white/5 rounded-lg p-2 flex flex-col justify-between">
                        <span className="text-gray-400 block font-bold mb-1 font-mono uppercase tracking-wider text-[9px]">Tải file nặng</span>
                        <span className="text-emerald-400 font-semibold">Tối đa 1024MB</span>
                      </div>
                      <div className="bg-[#1a1a1c]/60 border border-white/5 rounded-lg p-2 flex flex-col justify-between">
                        <span className="text-gray-400 block font-bold mb-1 font-mono uppercase tracking-wider text-[9px]">Timeout kết nối</span>
                        <span className="text-amber-400 font-semibold">300 giây</span>
                      </div>
                    </div>
                    <p className="text-[10px] text-gray-400 leading-relaxed font-sans">
                      Dịch vụ tự động tạo tệp cấu hình Nginx trong thư mục riêng biệt <code className="text-neon-blue font-mono">/etc/nginx/proxymanager.d/</code> và tự động xin cấp chứng chỉ SSL miễn phí qua Certbot.
                    </p>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-xs text-gray-500 font-bold uppercase mb-1 block">Cổng Công khai</label>
                  <input type="number" placeholder="8001" value={newProxy.remote_port} onChange={e=>setNewProxy({...newProxy, remote_port:parseInt(e.target.value)})} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-neon-blue/50"/>
                  <p className="text-[10px] text-gray-400 mt-1">Không giới hạn dải cổng (có thể nhập bất kỳ cổng nào từ 1 - 65535 chưa bị trùng).</p>
                </div>
              )}

              <div className="pt-4 flex flex-col gap-2">
                <button 
                  disabled={isSubmitting}
                  onClick={handleCreate} 
                  className={`w-full bg-neon-blue text-black font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-[0_0_20px_rgba(0,243,255,0.4)]'}`}
                >
                  {isSubmitting && <Loader2 className="animate-spin" size={18} />}
                  {editingProxy ? (isSubmitting ? 'Đang cập nhật...' : 'Cập nhật Tunnel') : (isSubmitting ? 'Đang tạo...' : 'Tạo Tunnel mới')}
                </button>
                <button disabled={isSubmitting} onClick={()=>setIsModalOpen(false)} className="w-full text-gray-500 py-2 hover:text-white transition-colors">Hủy bỏ</button>
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

const EmergencyModal: React.FC<{
  agent: DashboardAgent;
  token: string;
  onClose: () => void;
}> = ({ agent, token, onClose }) => {
  const isLinux = Boolean(
    agent.os?.toLowerCase().includes('linux') ||
    agent.os?.toLowerCase().includes('ubuntu') ||
    agent.os?.toLowerCase().includes('debian') ||
    agent.os?.toLowerCase().includes('centos') ||
    agent.os?.toLowerCase().includes('arch') ||
    agent.os?.toLowerCase().includes('fedora') ||
    agent.os?.toLowerCase().includes('alpine')
  );

  const [activeTab, setActiveTab] = useState<'ssh' | 'password' | 'script' | 'rotate'>(isLinux ? 'ssh' : 'password');
  const [secretKey, setSecretKey] = useState('');
  
  // Tab SSH Key (Linux)
  const [sshAccount, setSshAccount] = useState('root');
  const [sshPublicKey, setSshPublicKey] = useState('');

  // Tab Reset Password
  const [accountName, setAccountName] = useState(isLinux ? 'root' : 'Administrator');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Tab Custom Shell/PowerShell
  const [customScript, setCustomScript] = useState(
    isLinux
      ? `whoami\nuname -a\nid\n`
      : `Write-Host "ComputerName: $env:COMPUTERNAME"\nGet-LocalUser\n`
  );
  const [outputLogs, setOutputLogs] = useState<string[]>([]);
  
  // Tab Rotate Secret Key
  const [oldKey, setOldKey] = useState('');
  const [newKey, setNewKey] = useState('');
  const [confirmNewKey, setConfirmNewKey] = useState('');

  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const fetchRecentLogs = async () => {
    try {
      const res = await fetch(`/api/v1/logs?agent_id=${agent.id}&limit=25`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const lines = data.map((l: any) => `[${new Date(l.timestamp).toLocaleTimeString()}] [${l.log_level}] ${l.message}`);
        setOutputLogs(lines);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleInjectSSH = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!secretKey) {
      setStatusMessage({ type: 'error', text: 'Vui lòng nhập Emergency Secret Key của máy chủ này' });
      return;
    }
    if (!sshPublicKey.trim()) {
      setStatusMessage({ type: 'error', text: 'Vui lòng nhập SSH Public Key' });
      return;
    }
    setLoading(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/v1/agents/${agent.id}/emergency/inject-ssh-key`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          secret_key: secretKey,
          account_name: sshAccount.trim() || 'root',
          ssh_public_key: sshPublicKey.trim()
        })
      });
      const data = await res.json();
      if (res.ok) {
        setStatusMessage({ type: 'success', text: data.message || 'Lệnh chèn SSH Key đã được gửi.' });
        setTimeout(fetchRecentLogs, 2000);
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Lỗi gửi lệnh' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Lỗi kết nối' });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!secretKey) {
      setStatusMessage({ type: 'error', text: 'Vui lòng nhập Emergency Secret Key của máy chủ này' });
      return;
    }
    if (!newPassword || newPassword !== confirmPassword) {
      setStatusMessage({ type: 'error', text: 'Mật khẩu mới không khớp hoặc bị để trống' });
      return;
    }
    setLoading(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/v1/agents/${agent.id}/emergency/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          secret_key: secretKey,
          account_name: accountName.trim() || (isLinux ? 'root' : 'Administrator'),
          new_password: newPassword
        })
      });
      const data = await res.json();
      if (res.ok) {
        setStatusMessage({ type: 'success', text: data.message || 'Lệnh đặt lại mật khẩu đã được gửi.' });
        setTimeout(fetchRecentLogs, 2000);
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Lỗi gửi lệnh' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Lỗi kết nối' });
    } finally {
      setLoading(false);
    }
  };

  const handleExecScript = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!secretKey || !customScript) {
      setStatusMessage({ type: 'error', text: 'Vui lòng nhập Secret Key và lệnh thực thi' });
      return;
    }
    setLoading(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/v1/agents/${agent.id}/emergency/exec`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          secret_key: secretKey,
          script: customScript
        })
      });
      const data = await res.json();
      if (res.ok) {
        setStatusMessage({ type: 'success', text: data.message || 'Lệnh khẩn cấp đã được gửi tới máy chủ.' });
        setTimeout(fetchRecentLogs, 1500);
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Lỗi gửi lệnh' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Lỗi kết nối' });
    } finally {
      setLoading(false);
    }
  };

  const handleRotateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldKey || !newKey) {
      setStatusMessage({ type: 'error', text: 'Vui lòng nhập đầy đủ Secret Key cũ và mới' });
      return;
    }
    if (newKey !== confirmNewKey) {
      setStatusMessage({ type: 'error', text: 'Xác nhận Secret Key mới không khớp' });
      return;
    }
    setLoading(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/v1/agents/${agent.id}/emergency/rotate-key`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          old_secret_key: oldKey,
          new_secret_key: newKey
        })
      });
      const data = await res.json();
      if (res.ok) {
        setStatusMessage({ type: 'success', text: data.message || 'Đổi Secret Key thành công.' });
        setSecretKey(newKey);
        setOldKey('');
        setNewKey('');
        setConfirmNewKey('');
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Lỗi đổi Secret Key' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Lỗi kết nối' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="glass max-w-2xl w-full p-6 sm:p-8 rounded-[32px] border border-amber-500/30 max-h-[90vh] overflow-y-auto space-y-6 shadow-[0_0_50px_rgba(245,158,11,0.15)]">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <ShieldAlert className="text-amber-400" size={28} /> Cứu Hộ Khẩn Cấp (Emergency Fallback)
            </h2>
            <p className="text-gray-400 text-sm mt-1">
              Máy chủ: <strong className="text-white">{agent.name || agent.hostname}</strong> ({agent.hostname}) · OS: <span className="text-neon-blue font-bold uppercase">{agent.os || (isLinux ? 'Linux' : 'Windows')}</span> · Quyền <span className="text-amber-400 font-mono font-bold">{isLinux ? 'root (UID 0)' : 'NT AUTHORITY\\SYSTEM'}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white p-2">
            <X size={20} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/10 gap-2 overflow-x-auto">
          {isLinux && (
            <button
              onClick={() => { setActiveTab('ssh'); setStatusMessage(null); }}
              className={`px-4 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'ssh'
                  ? 'border-amber-400 text-amber-400 bg-amber-400/5'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              <Key size={16} /> Chèn SSH Public Key
            </button>
          )}
          <button
            onClick={() => { setActiveTab('password'); setStatusMessage(null); }}
            className={`px-4 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'password'
                ? 'border-amber-400 text-amber-400 bg-amber-400/5'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <Lock size={16} /> {isLinux ? 'Đổi Mật Khẩu (root/user)' : 'Đổi Mật Khẩu Admin'}
          </button>
          <button
            onClick={() => { setActiveTab('script'); setStatusMessage(null); }}
            className={`px-4 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'script'
                ? 'border-amber-400 text-amber-400 bg-amber-400/5'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <Terminal size={16} /> {isLinux ? 'Bash Shell Khẩn Cấp' : 'PowerShell Khẩn Cấp'}
          </button>
          <button
            onClick={() => { setActiveTab('rotate'); setStatusMessage(null); }}
            className={`px-4 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'rotate'
                ? 'border-amber-400 text-amber-400 bg-amber-400/5'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <RotateCw size={16} /> Đổi Secret Key
          </button>
        </div>

        {statusMessage && (
          <div className={`p-4 rounded-2xl text-sm flex items-center gap-2 ${
            statusMessage.type === 'success' 
              ? 'bg-green-500/10 border border-green-500/30 text-green-400' 
              : 'bg-red-500/10 border border-red-500/30 text-red-400'
          }`}>
            {statusMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Tab SSH: Inject SSH Public Key (Linux) */}
        {activeTab === 'ssh' && isLinux && (
          <form onSubmit={handleInjectSSH} className="space-y-4">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-xs text-gray-400 space-y-1">
              <div className="font-bold text-amber-400 flex items-center gap-1.5">
                <Key size={14} /> Khôi phục quyền truy cập SSH máy Linux:
              </div>
              <p>
                Agent chạy dưới quyền <strong>root</strong> sẽ tự động lưu SSH Public Key vào file <code>authorized_keys</code> của tài khoản đã chọn (mặc định là <code>/root/.ssh/authorized_keys</code>), phân quyền <code>600</code> an toàn và đảm bảo dịch vụ <code>sshd</code> đang hoạt động để bạn đăng nhập SSH ngay lập tức.
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-amber-300 uppercase">
                  Emergency Secret Key (Bắt buộc)
                </label>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText();
                      if (text) setSecretKey(text.trim());
                    } catch {}
                  }}
                  className="text-[11px] text-neon-blue hover:underline flex items-center gap-1"
                >
                  <Copy size={12} /> Dán từ clipboard
                </button>
              </div>
              <input
                type="password"
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                placeholder="pm_sec_..."
                className="w-full bg-black/40 border border-amber-500/30 rounded-2xl px-4 py-3 text-white font-mono focus:outline-none focus:border-amber-400"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Tài khoản Linux mục tiêu</label>
              <input
                type="text"
                value={sshAccount}
                onChange={(e) => setSshAccount(e.target.value)}
                placeholder="root"
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-neon-blue font-mono text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-2">
                Nội dung SSH Public Key (id_ed25519.pub / id_rsa.pub)
              </label>
              <textarea
                value={sshPublicKey}
                onChange={(e) => setSshPublicKey(e.target.value)}
                rows={4}
                className="w-full bg-black/60 border border-white/10 rounded-2xl p-4 text-xs font-mono text-green-400 focus:outline-none focus:border-neon-blue resize-y"
                placeholder="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI... user@laptop"
                required
              />
            </div>

            <div className="pt-2 flex gap-3">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-amber-500 hover:bg-amber-400 text-black font-bold py-3.5 rounded-2xl shadow-[0_0_20px_rgba(245,158,11,0.3)] transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : <><Key size={18} /> Chèn SSH Key & Kích Hoạt SSH</>}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-white/5 text-gray-400 hover:text-white py-3.5 rounded-2xl transition-colors"
              >
                Đóng
              </button>
            </div>
          </form>
        )}

        {/* Tab 1: Reset Password Form */}
        {activeTab === 'password' && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-xs text-gray-400 space-y-1">
              <div className="font-bold text-amber-400 flex items-center gap-1.5">
                <Lock size={14} /> Cơ chế Fallback khi máy bị hack / mất quyền:
              </div>
              <p>
                Agent sẽ sử dụng quyền <strong>{isLinux ? 'root' : 'SYSTEM'}</strong> để đặt lại mật khẩu và kích hoạt lại tài khoản đã chọn, bất kể tài khoản bị vô hiệu hóa hay đổi mật khẩu bởi bên thứ ba.
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-amber-300 uppercase">
                  Emergency Secret Key (Bắt buộc)
                </label>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText();
                      if (text) setSecretKey(text.trim());
                    } catch {}
                  }}
                  className="text-[11px] text-neon-blue hover:underline flex items-center gap-1"
                >
                  <Copy size={12} /> Dán từ clipboard
                </button>
              </div>
              <input
                type="password"
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                placeholder="pm_sec_..."
                className="w-full bg-black/40 border border-amber-500/30 rounded-2xl px-4 py-3 text-white font-mono focus:outline-none focus:border-amber-400"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">{isLinux ? 'Tên tài khoản Linux' : 'Tên tài khoản Windows'}</label>
                <input
                  type="text"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder={isLinux ? 'root' : 'Administrator'}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-neon-blue"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Mật khẩu mới</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-neon-blue"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Xác nhận mật khẩu mới</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-neon-blue"
                required
              />
            </div>

            <div className="pt-2 flex gap-3">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-amber-500 hover:bg-amber-400 text-black font-bold py-3.5 rounded-2xl shadow-[0_0_20px_rgba(245,158,11,0.3)] transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : <><Lock size={18} /> Thực Hiện Đổi Mật Khẩu Khẩn Cấp</>}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-white/5 text-gray-400 hover:text-white py-3.5 rounded-2xl transition-colors"
              >
                Đóng
              </button>
            </div>
          </form>
        )}

        {/* Tab Script: Custom Bash / PowerShell Form */}
        {activeTab === 'script' && (
          <form onSubmit={handleExecScript} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-amber-300 uppercase">
                  Emergency Secret Key (Bắt buộc)
                </label>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText();
                      if (text) setSecretKey(text.trim());
                    } catch {}
                  }}
                  className="text-[11px] text-neon-blue hover:underline flex items-center gap-1"
                >
                  <Copy size={12} /> Dán từ clipboard
                </button>
              </div>
              <input
                type="password"
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                placeholder="pm_sec_..."
                className="w-full bg-black/40 border border-amber-500/30 rounded-2xl px-4 py-3 text-white font-mono focus:outline-none focus:border-amber-400"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-2">
                {isLinux ? 'Bash Script (Chạy dưới quyền root)' : 'PowerShell Script (Chạy dưới quyền SYSTEM)'}
              </label>
              <textarea
                value={customScript}
                onChange={(e) => setCustomScript(e.target.value)}
                rows={6}
                className="w-full bg-black/60 border border-white/10 rounded-2xl p-4 text-xs font-mono text-green-400 focus:outline-none focus:border-neon-blue resize-y"
                placeholder={isLinux ? "# Nhập lệnh bash shell..." : "# Nhập lệnh PowerShell..."}
                required
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-amber-500 hover:bg-amber-400 text-black font-bold py-3 rounded-2xl transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : <><Terminal size={18} /> Chạy Lệnh Khẩn Cấp</>}
              </button>
              <button
                type="button"
                onClick={fetchRecentLogs}
                className="px-4 bg-white/5 text-neon-blue border border-neon-blue/20 hover:bg-neon-blue/10 rounded-2xl text-xs font-bold flex items-center gap-1.5"
              >
                <RotateCw size={14} /> Làm mới log
              </button>
            </div>

            {outputLogs.length > 0 && (
              <div className="space-y-1">
                <div className="text-[10px] text-gray-400 uppercase font-bold">Kết quả thực thi thời gian thực:</div>
                <pre className="bg-black/80 border border-white/10 rounded-2xl p-4 text-[11px] font-mono text-gray-300 max-h-48 overflow-y-auto whitespace-pre-wrap">
                  {outputLogs.join('\n')}
                </pre>
              </div>
            )}
          </form>
        )}

        {/* Tab 3: Rotate Secret Key Form */}
        {activeTab === 'rotate' && (
          <form onSubmit={handleRotateKey} className="space-y-4">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-xs text-gray-400">
              Chỉ có thể thay đổi Secret Key khi nhập đúng <strong>Secret Key hiện tại</strong>. Sau khi đổi, Secret Key cũ sẽ bị vô hiệu hóa hoàn toàn.
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Secret Key Hiện Tại</label>
              <input
                type="password"
                value={oldKey}
                onChange={(e) => setOldKey(e.target.value)}
                placeholder="pm_sec_..."
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white font-mono focus:outline-none focus:border-neon-blue"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-amber-300 uppercase mb-2">Secret Key Mới</label>
              <input
                type="password"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="Nhập secret key mới (ít nhất 8 ký tự)..."
                className="w-full bg-black/40 border border-amber-500/30 rounded-2xl px-4 py-3 text-white font-mono focus:outline-none focus:border-amber-400"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Xác nhận Secret Key Mới</label>
              <input
                type="password"
                value={confirmNewKey}
                onChange={(e) => setConfirmNewKey(e.target.value)}
                placeholder="Nhập lại secret key mới..."
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white font-mono focus:outline-none focus:border-neon-blue"
                required
              />
            </div>

            <div className="pt-2 flex gap-3">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-amber-500 hover:bg-amber-400 text-black font-bold py-3.5 rounded-2xl transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : <><RotateCw size={18} /> Cập Nhật Secret Key Mới</>}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-white/5 text-gray-400 hover:text-white py-3.5 rounded-2xl transition-colors"
              >
                Đóng
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

const AgentsPage: React.FC<{ agents: DashboardAgent[], token: string, onRefresh: () => void }> = ({ agents, token, onRefresh }) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);
  const [installCommands, setInstallCommands] = useState<Record<string, string>>({
    linux: 'Bấm "Tạo & sao chép" để sinh link cài đặt dùng 1 lần.',
    windows: 'Bấm "Tạo & sao chép" để sinh link cài đặt dùng 1 lần.'
  });
  const [emergencyKeys, setEmergencyKeys] = useState<Record<string, string>>({});
  const [generatingInstall, setGeneratingInstall] = useState<string | null>(null);

  // Emergency Modal State
  const [emergencyAgent, setEmergencyAgent] = useState<DashboardAgent | null>(null);

  // Assign Manager State
  const [assigningAgent, setAssigningAgent] = useState<DashboardAgent | null>(null);
  const [verifiedMembers, setVerifiedMembers] = useState<User[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [savingManagers, setSavingManagers] = useState(false);

  const openAssignModal = async (agent: DashboardAgent) => {
    setAssigningAgent(agent);
    setSelectedUserIds((agent.managers || []).map(m => m.user_id));
    setLoadingMembers(true);
    try {
      const res = await fetch('/api/v1/members/verified', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setVerifiedMembers(Array.isArray(data) ? data : []);
      } else {
        setVerifiedMembers([]);
      }
    } catch (err) {
      console.error('Failed to fetch verified members:', err);
      setVerifiedMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  };

  const toggleUserId = (userId: number) => {
    setSelectedUserIds(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleSaveManagers = async () => {
    if (!assigningAgent) return;
    setSavingManagers(true);
    try {
      const res = await fetch(`/api/v1/agents/${assigningAgent.id}/managers`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ user_ids: selectedUserIds })
      });
      if (res.ok) {
        onRefresh();
        setAssigningAgent(null);
      } else {
        const data = await res.json();
        alert(data.error || 'Không thể lưu danh sách người quản lý');
      }
    } catch (err) {
      console.error('Failed to save managers:', err);
    } finally {
      setSavingManagers(false);
    }
  };

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

  const generateInstallCommand = async (os: 'linux' | 'windows') => {
    const res = await fetch('/api/v1/install/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ os })
    });
    if (!res.ok) {
      throw new Error(`Failed to create ${os} install token`);
    }
    const data = await res.json();
    if (data.emergency_secret_key) {
      setEmergencyKeys(prev => ({ ...prev, [os]: data.emergency_secret_key }));
    }
    return data.command as string;
  };

  const handleCopy = async (key: 'linux' | 'windows') => {
    setGeneratingInstall(key);
    try {
      const command = await generateInstallCommand(key);
      setInstallCommands((current) => ({ ...current, [key]: command }));
      await copyToClipboard(command);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((current) => current === key ? null : current), 2000);
    } catch (err) {
      console.error('Failed to create install command:', err);
    } finally {
      setGeneratingInstall(null);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
      <div className="glass rounded-[32px] p-6 sm:p-8 border border-white/10">
        <div className="flex flex-col sm:flex-row items-start justify-between gap-6 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Máy chủ (Agents)</h1>
            <p className="text-gray-400 mt-2">Cài đặt nhanh lên các máy chủ cần quản lý & phân quyền thông báo.</p>
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
            command={installCommands.linux}
            emergencyKey={emergencyKeys.linux}
            copied={copiedKey === 'linux'}
            loading={generatingInstall === 'linux'}
            onCopy={() => handleCopy('linux')}
          />
          <div className="space-y-4">
            <InstallCommandCard
              title="Windows"
              description="Chạy trong Admin PowerShell"
              command={installCommands.windows}
              emergencyKey={emergencyKeys.windows}
              copied={copiedKey === 'windows'}
              loading={generatingInstall === 'windows'}
              onCopy={() => handleCopy('windows')}
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
                <th>Người quản lý (Nhận mail)</th>
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
                    <div className="flex flex-wrap items-center gap-1.5 py-1">
                      {(agent.managers && agent.managers.length > 0) ? (
                        agent.managers.map((m) => (
                          <span key={m.user_id} className="inline-flex items-center gap-1 bg-neon-blue/10 border border-neon-blue/20 text-neon-blue px-2.5 py-1 rounded-lg text-xs font-mono" title={m.email || m.username}>
                            <Mail size={12} />
                            <span className="max-w-[130px] truncate">{m.email || m.username}</span>
                          </span>
                        ))
                      ) : (
                        <span className="text-gray-500 text-xs italic">Chưa gán quản lý</span>
                      )}
                      <button
                        onClick={() => openAssignModal(agent)}
                        className="p-1.5 text-gray-400 hover:text-neon-blue bg-white/5 hover:bg-white/10 rounded-lg transition-colors flex items-center gap-1 text-xs"
                        title="Gán người quản lý máy"
                      >
                        <UserCheck size={14} />
                        <span className="hidden sm:inline">Gán</span>
                      </button>
                    </div>
                  </td>
                  <td>
                    <span className={agent.status === 'online' ? 'text-green-400 flex items-center gap-2' : 'text-gray-500 flex items-center gap-2'}>
                      <span className={`w-1.5 h-1.5 rounded-full ${agent.status==='online'?'bg-green-400 animate-pulse':'bg-gray-500'}`} />
                      {agent.status === 'online' ? 'Trực tuyến' : 'Ngoại tuyến'}
                    </span>
                  </td>
                  <td>{agent.last_heartbeat ? new Date(agent.last_heartbeat).toLocaleTimeString() : '-'}</td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button
                      onClick={() => setEmergencyAgent(agent)}
                      className="text-xs bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 px-3 py-1.5 rounded-xl transition-all inline-flex items-center gap-1.5 font-bold"
                      title="Cứu hộ khẩn cấp & Đổi mật khẩu Administrator"
                    >
                      <ShieldAlert size={14} /> Cứu hộ
                    </button>
                    <button
                      onClick={() => openAssignModal(agent)}
                      className="text-xs bg-white/5 hover:bg-neon-blue/20 text-neon-blue border border-white/10 hover:border-neon-blue/30 px-3 py-1.5 rounded-xl transition-all inline-flex items-center gap-1"
                    >
                      <UserCheck size={14} /> Phân quyền
                    </button>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={7} className="px-6 py-10 text-center text-gray-500 italic">Chưa có agent nào đăng ký.</td></tr>
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
                <div className="bg-white/5 p-3 rounded-xl col-span-2">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-gray-500 text-[10px] uppercase font-bold">Người quản lý máy (Nhận mail cảnh báo)</span>
                    <button onClick={() => openAssignModal(agent)} className="text-xs text-neon-blue hover:underline flex items-center gap-1">
                      <UserCheck size={12} /> Cài đặt
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(agent.managers && agent.managers.length > 0) ? (
                      agent.managers.map((m) => (
                        <span key={m.user_id} className="inline-flex items-center gap-1 bg-neon-blue/10 border border-neon-blue/20 text-neon-blue px-2 py-0.5 rounded-lg text-xs font-mono">
                          <Mail size={12} /> {m.email || m.username}
                        </span>
                      ))
                    ) : (
                      <span className="text-gray-500 text-xs italic">Chưa có người quản lý</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 pt-2 border-t border-white/5">
                <button
                  onClick={() => setEmergencyAgent(agent)}
                  className="flex-1 text-xs bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 font-bold"
                >
                  <ShieldAlert size={14} /> Cứu hộ khẩn cấp
                </button>
                <button
                  onClick={() => openAssignModal(agent)}
                  className="flex-1 text-xs bg-white/5 hover:bg-neon-blue/20 text-neon-blue border border-white/10 py-2 rounded-xl transition-all flex items-center justify-center gap-1"
                >
                  <UserCheck size={14} /> Phân quyền
                </button>
              </div>
              <div className="text-center text-[10px] text-gray-500 border-t border-white/5 pt-2">
                Lần cuối liên lạc: {agent.last_heartbeat ? new Date(agent.last_heartbeat).toLocaleString() : '-'}
              </div>
            </div>
          )) : (
            <div className="p-10 text-center text-gray-500 glass rounded-2xl border border-white/10 italic">Không tìm thấy agent.</div>
          )}
        </div>
      </div>

      {/* Modal Gán Người Quản Lý Máy */}
      {assigningAgent && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="glass max-w-lg w-full p-6 sm:p-8 rounded-[32px] border border-white/10 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <UserCheck className="text-neon-blue" size={24} /> Gán Người Quản Lý Máy
                </h2>
                <p className="text-gray-400 text-sm mt-1">
                  Máy chủ: <strong className="text-white">{assigningAgent.name || assigningAgent.hostname}</strong> ({assigningAgent.hostname})
                </p>
              </div>
              <button onClick={() => setAssigningAgent(null)} className="text-gray-500 hover:text-white p-2">
                <X size={20} />
              </button>
            </div>

            <div className="p-3 bg-neon-blue/5 border border-neon-blue/20 rounded-2xl mb-6 text-xs text-gray-300 space-y-1">
              <div className="font-bold text-neon-blue flex items-center gap-1">
                <CheckCircle2 size={14} /> Quy định gửi thông báo qua Mail Server admin@c500.net:
              </div>
              <p className="text-gray-400 leading-relaxed">
                Chỉ các thành viên đã xác thực địa chỉ email mới hiển thị trong danh sách này. Người quản lý được gán sẽ tự động nhận email khi:
              </p>
              <ul className="list-disc pl-5 text-gray-400 space-y-0.5 mt-1">
                <li>🔴 Máy bị mất kết nối (Offline) - Báo 1 lần khi tắt</li>
                <li>🟢 Máy kết nối lại thành công (Online) - Báo 1 lần khi mở</li>
                <li>⚠️ Tải CPU &gt; 95% hoặc RAM &gt; 95% hoặc Disk &gt; 95% - Giới hạn tối đa 30 phút gửi 1 lần</li>
              </ul>
            </div>

            {loadingMembers ? (
              <div className="py-12 text-center text-gray-400 flex flex-col items-center gap-3">
                <Loader2 className="animate-spin text-neon-blue" size={28} />
                <span>Đang tải danh sách thành viên đã xác thực...</span>
              </div>
            ) : (!verifiedMembers || verifiedMembers.length === 0) ? (
              <div className="p-8 text-center glass rounded-2xl border border-white/5 space-y-3">
                <AlertTriangle className="mx-auto text-amber-400" size={32} />
                <p className="text-white font-bold">Chưa có thành viên nào xác thực email</p>
                <p className="text-xs text-gray-400">
                  Vui lòng chuyển qua tab <strong>Người dùng</strong> hoặc <strong>Hồ sơ cá nhân</strong> để thêm email và thực hiện xác thực mã OTP trước khi gán vào máy chủ.
                </p>
              </div>
            ) : (
              <div className="space-y-3 mb-6">
                <div className="flex justify-between items-center text-xs text-gray-400 px-1">
                  <span>Chọn thành viên ({selectedUserIds.length}/{(verifiedMembers || []).length} đã chọn)</span>
                  <div className="space-x-2">
                    <button 
                      onClick={() => setSelectedUserIds((verifiedMembers || []).map(m => m.id!))}
                      className="text-neon-blue hover:underline"
                    >
                      Chọn tất cả
                    </button>
                    <span>|</span>
                    <button 
                      onClick={() => setSelectedUserIds([])}
                      className="text-gray-400 hover:text-white"
                    >
                      Bỏ chọn hết
                    </button>
                  </div>
                </div>

                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                  {(verifiedMembers || []).map((member) => {
                    const isSelected = selectedUserIds.includes(member.id!);
                    return (
                      <div
                        key={member.id}
                        onClick={() => toggleUserId(member.id!)}
                        className={`p-3 rounded-2xl border cursor-pointer flex items-center justify-between transition-all duration-200 ${
                          isSelected
                            ? 'bg-neon-blue/10 border-neon-blue/40 text-white shadow-[0_0_15px_rgba(0,243,255,0.1)]'
                            : 'bg-white/5 border-white/5 text-gray-300 hover:bg-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-colors ${
                            isSelected ? 'bg-neon-blue border-neon-blue text-black' : 'border-white/20 bg-transparent'
                          }`}>
                            {isSelected && <Check size={14} strokeWidth={3} />}
                          </div>
                          <div>
                            <div className="font-bold text-sm flex items-center gap-2">
                              {member.username}
                              <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-white/10 text-gray-400 uppercase">
                                {member.role}
                              </span>
                            </div>
                            <div className="text-xs text-neon-blue font-mono">{member.email}</div>
                          </div>
                        </div>
                        <span className="text-[10px] text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full border border-green-400/20 font-bold uppercase">
                          Đã xác thực
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="pt-4 flex gap-3">
              <button
                type="button"
                onClick={handleSaveManagers}
                disabled={savingManagers}
                className="flex-1 bg-neon-blue text-black font-bold py-3.5 rounded-2xl hover:shadow-[0_0_20px_rgba(0,243,255,0.4)] transition-all flex items-center justify-center gap-2"
              >
                {savingManagers ? <Loader2 className="animate-spin" size={18} /> : <>Lưu danh sách quản lý</>}
              </button>
              <button
                type="button"
                onClick={() => setAssigningAgent(null)}
                className="flex-1 bg-white/5 text-gray-400 hover:text-white py-3.5 rounded-2xl transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cứu Hộ Khẩn Cấp & Đổi Mật Khẩu Administrator */}
      {emergencyAgent && (
        <EmergencyModal
          agent={emergencyAgent}
          token={token}
          onClose={() => setEmergencyAgent(null)}
        />
      )}
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

const AlertSettingsCard: React.FC<{
  settings: SettingEntry[];
  onSaveMultiple: (entries: SettingEntry[]) => Promise<void>;
}> = ({ settings, onSaveMultiple }) => {
  const getVal = (key: string, defaultVal: string) => {
    const found = settings.find(s => s.key === key);
    return found ? found.value : defaultVal;
  };

  const [cpuInterval, setCpuInterval] = useState('30');
  const [cpuThreshold, setCpuThreshold] = useState('95');
  const [ramInterval, setRamInterval] = useState('30');
  const [ramThreshold, setRamThreshold] = useState('95');
  const [diskInterval, setDiskInterval] = useState('30');
  const [diskThreshold, setDiskThreshold] = useState('95');
  const [offlineTimeout, setOfflineTimeout] = useState('30');
  const [stateCooldown, setStateCooldown] = useState('5');

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setCpuInterval(getVal('alert_interval_cpu_minutes', '30'));
    setCpuThreshold(getVal('alert_threshold_cpu', '95'));
    setRamInterval(getVal('alert_interval_ram_minutes', '30'));
    setRamThreshold(getVal('alert_threshold_ram', '95'));
    setDiskInterval(getVal('alert_interval_disk_minutes', '30'));
    setDiskThreshold(getVal('alert_threshold_disk', '95'));
    setOfflineTimeout(getVal('alert_offline_timeout_seconds', '30'));
    setStateCooldown(getVal('alert_state_cooldown_minutes', '5'));
  }, [settings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      await onSaveMultiple([
        { key: 'alert_interval_cpu_minutes', value: cpuInterval },
        { key: 'alert_threshold_cpu', value: cpuThreshold },
        { key: 'alert_interval_ram_minutes', value: ramInterval },
        { key: 'alert_threshold_ram', value: ramThreshold },
        { key: 'alert_interval_disk_minutes', value: diskInterval },
        { key: 'alert_threshold_disk', value: diskThreshold },
        { key: 'alert_offline_timeout_seconds', value: offlineTimeout },
        { key: 'alert_state_cooldown_minutes', value: stateCooldown },
      ]);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="glass rounded-[32px] p-8 border border-white/10 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-400">
              <Bell size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Giới hạn Cảnh báo & Thông báo Email</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Cấu hình thời gian gửi thư độc lập cho từng loại lỗi. Máy mở và tắt chỉ gửi đúng 1 lần duy nhất.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 px-3 py-1.5 rounded-xl flex items-center gap-1">
              <Check size={14} /> Đã lưu thành công
            </span>
          )}
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="bg-neon-blue hover:bg-neon-blue/80 text-black font-bold px-6 py-2.5 rounded-xl transition-all flex items-center gap-2 text-sm disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? 'Đang lưu...' : 'Lưu cấu hình'}
          </button>
        </div>
      </div>

      {/* Thông tin quy tắc bất biến */}
      <div className="p-4 bg-neon-blue/5 border border-neon-blue/20 rounded-2xl flex items-start gap-3 text-xs text-gray-300">
        <CheckCircle2 size={18} className="text-neon-blue shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-white">Quy tắc thông báo trạng thái Mở / Tắt máy (Online / Offline):</p>
          <p className="text-gray-400 leading-relaxed">
            Hệ thống đảm bảo <strong>chỉ gửi đúng 1 email khi máy bị tắt (Offline)</strong> và <strong>1 email khi máy kết nối lại thành công (Online)</strong>. Toàn bộ các lần kiểm tra lặp lại sau đó sẽ bị chặn để tuyệt đối không gây spam hòm thư.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* CPU Alert Settings */}
        <div className="p-5 glass rounded-2xl border border-white/5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <Cpu size={16} className="text-neon-blue" />
            <span>Cảnh báo CPU</span>
          </div>
          <div className="space-y-3 text-xs">
            <div>
              <label className="text-gray-400 block mb-1">Ngưỡng kích hoạt cảnh báo (%)</label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={cpuThreshold}
                  onChange={(e) => setCpuThreshold(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
                />
                <span className="absolute right-3 top-2 text-gray-500">%</span>
              </div>
            </div>
            <div>
              <label className="text-gray-400 block mb-1">Giới hạn gửi lại (Mỗi X phút gửi 1 lần)</label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="1440"
                  value={cpuInterval}
                  onChange={(e) => setCpuInterval(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
                />
                <span className="absolute right-3 top-2 text-gray-500">phút</span>
              </div>
              <p className="text-[10px] text-gray-500 mt-1">Mặc định: 30 phút / lần</p>
            </div>
          </div>
        </div>

        {/* RAM Alert Settings */}
        <div className="p-5 glass rounded-2xl border border-white/5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <Activity size={16} className="text-amber-400" />
            <span>Cảnh báo RAM</span>
          </div>
          <div className="space-y-3 text-xs">
            <div>
              <label className="text-gray-400 block mb-1">Ngưỡng kích hoạt cảnh báo (%)</label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={ramThreshold}
                  onChange={(e) => setRamThreshold(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
                />
                <span className="absolute right-3 top-2 text-gray-500">%</span>
              </div>
            </div>
            <div>
              <label className="text-gray-400 block mb-1">Giới hạn gửi lại (Mỗi X phút gửi 1 lần)</label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="1440"
                  value={ramInterval}
                  onChange={(e) => setRamInterval(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
                />
                <span className="absolute right-3 top-2 text-gray-500">phút</span>
              </div>
              <p className="text-[10px] text-gray-500 mt-1">Mặc định: 30 phút / lần</p>
            </div>
          </div>
        </div>

        {/* Disk Alert Settings */}
        <div className="p-5 glass rounded-2xl border border-white/5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <Server size={16} className="text-rose-400" />
            <span>Cảnh báo Ổ đĩa (Disk)</span>
          </div>
          <div className="space-y-3 text-xs">
            <div>
              <label className="text-gray-400 block mb-1">Ngưỡng kích hoạt cảnh báo (%)</label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={diskThreshold}
                  onChange={(e) => setDiskThreshold(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
                />
                <span className="absolute right-3 top-2 text-gray-500">%</span>
              </div>
            </div>
            <div>
              <label className="text-gray-400 block mb-1">Giới hạn gửi lại (Mỗi X phút gửi 1 lần)</label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="1440"
                  value={diskInterval}
                  onChange={(e) => setDiskInterval(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
                />
                <span className="absolute right-3 top-2 text-gray-500">phút</span>
              </div>
              <p className="text-[10px] text-gray-500 mt-1">Mặc định: 30 phút / lần</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
        {/* Offline Heartbeat Timeout */}
        <div className="p-5 glass rounded-2xl border border-white/5 space-y-3 text-xs">
          <div className="flex items-center gap-2 font-bold text-white">
            <Clock size={16} className="text-neon-blue" />
            <span>Thời gian nhận diện Mất kết nối (Offline Timeout)</span>
          </div>
          <div className="relative">
            <input
              type="number"
              min="10"
              max="600"
              value={offlineTimeout}
              onChange={(e) => setOfflineTimeout(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
            />
            <span className="absolute right-3 top-2 text-gray-500">giây</span>
          </div>
          <p className="text-[10px] text-gray-500">
            Nếu máy không gửi tín hiệu quá thời gian này, hệ thống sẽ xác nhận Offline và gửi email báo tắt máy (1 lần duy nhất).
          </p>
        </div>

        {/* State Anti-flapping */}
        <div className="p-5 glass rounded-2xl border border-white/5 space-y-3 text-xs">
          <div className="flex items-center gap-2 font-bold text-white">
            <Shield size={16} className="text-green-400" />
            <span>Khoảng cách chống chập chờn mạng (Anti-flapping)</span>
          </div>
          <div className="relative">
            <input
              type="number"
              min="1"
              max="60"
              value={stateCooldown}
              onChange={(e) => setStateCooldown(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
            />
            <span className="absolute right-3 top-2 text-gray-500">phút</span>
          </div>
          <p className="text-[10px] text-gray-500">
            Khoảng cách tối thiểu giữa 2 lần gửi mail đổi trạng thái nếu mạng chập chờn rớt liên tục. Mặc định: 5 phút.
          </p>
        </div>
      </div>
    </div>
  );
};

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

  const saveMultipleSettings = async (entries: SettingEntry[]) => {
    setError('');
    setNotice('');
    try {
      for (const entry of entries) {
        await fetch('/api/v1/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(entry)
        });
      }
      setNotice('Đã cập nhật toàn bộ cấu hình cảnh báo thành công.');
      setTimeout(() => setNotice(''), 3000);
      await fetchSettings();
    } catch {
      setError('Lỗi khi lưu cài đặt cảnh báo.');
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
        <h1 className="text-3xl font-bold text-white">Cấu hình hệ thống</h1>
        <p className="text-gray-400 mt-2">Quản lý các giới hạn cảnh báo, quy định gửi email và các tham số vận hành.</p>
        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
        {notice && <p className="mt-4 text-sm text-green-400">{notice}</p>}
      </div>

      {/* Cấu hình Giới hạn cảnh báo & Thông báo Email */}
      <AlertSettingsCard settings={settings} onSaveMultiple={saveMultipleSettings} />

      {/* Cấu hình nâng cao Key-Value */}
      <div className="glass rounded-[32px] p-8 border border-white/10">
        <h2 className="text-xl font-bold text-white mb-4">Thêm mới cài đặt tuỳ chỉnh</h2>
        <div className="grid gap-4 md:grid-cols-[1fr,1fr,auto]">
          <input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="Key" className="bg-white/5 border border-white/10 rounded-xl p-3 text-white" />
          <input value={newValue} onChange={(e) => setNewValue(e.target.value)} placeholder="Value" className="bg-white/5 border border-white/10 rounded-xl p-3 text-white" />
          <button onClick={addSetting} className="bg-neon-blue text-black font-bold px-6 py-3 rounded-xl">Thêm</button>
        </div>
      </div>

      <div className="glass rounded-[32px] overflow-hidden border border-white/10">
        <div className="px-8 py-6 border-b border-white/5">
          <h2 className="text-xl font-bold text-white">Tất cả tham số Key-Value</h2>
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
  const [selectedAgent, setSelectedAgent] = useState(() => localStorage.getItem('selectedAgent_monitor') || '');
  const [history, setHistory] = useState<HardwareHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('selectedAgent_monitor');
    const isValidSaved = saved && agents.some(a => a.id === saved);

    if (isValidSaved) {
      setSelectedAgent(saved!);
    } else if (agents.length > 0) {
      setSelectedAgent(agents[0].id);
      localStorage.setItem('selectedAgent_monitor', agents[0].id);
    }
  }, [agents]);

  useEffect(() => {
    if (selectedAgent) {
      localStorage.setItem('selectedAgent_monitor', selectedAgent);
    }
  }, [selectedAgent]);

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
        <h2 className="text-xl font-bold text-white mb-6">Thông tin hệ thống & Tài nguyên</h2>
        {activeAgent ? (
          <div className="space-y-6">
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              <InfoTile label="Tên máy chủ" value={activeAgent.hostname} />
              <InfoTile label="IP Nội bộ" value={activeAgent.private_ip || '-'} />
              <InfoTile label="Hệ điều hành" value={activeAgent.os || '-'} />
              <InfoTile label="Liên lạc lần cuối" value={activeAgent.last_heartbeat ? new Date(activeAgent.last_heartbeat).toLocaleTimeString() : '-'} />
            </div>

            {currentHardware && ((currentHardware.disk_total && currentHardware.disk_total > 0) || (currentHardware.cpu_temp && currentHardware.cpu_temp > 0)) ? (
              <div className="grid gap-6 grid-cols-1 md:grid-cols-2 pt-4 border-t border-white/5">
                {currentHardware.disk_total && currentHardware.disk_total > 0 ? (
                  <div className="rounded-2xl bg-white/5 p-5 border border-white/5 space-y-3">
                    <div className="text-gray-500 uppercase text-[10px] font-bold tracking-widest">Ổ cứng chính (/)</div>
                    <div className="flex justify-between items-end">
                      <span className="text-white font-bold">
                        {Math.round((currentHardware.disk_used! / currentHardware.disk_total) * 100)}% đã dùng
                      </span>
                      <span className="text-gray-400 text-xs">
                        {formatBytes(currentHardware.disk_used!)} / {formatBytes(currentHardware.disk_total)}
                      </span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-neon-blue h-full rounded-full transition-all duration-500" 
                        style={{ width: `${Math.min(100, Math.round((currentHardware.disk_used! / currentHardware.disk_total) * 100))}%` }}
                      />
                    </div>
                  </div>
                ) : null}

                {currentHardware.cpu_temp && currentHardware.cpu_temp > 0 ? (
                  <div className="rounded-2xl bg-white/5 p-5 border border-white/5 flex flex-col justify-center">
                    <div className="text-gray-500 uppercase text-[10px] font-bold tracking-widest mb-2">Nhiệt độ CPU</div>
                    <div className="flex items-center gap-3">
                      <span className={`text-2xl font-bold ${currentHardware.cpu_temp > 75 ? 'text-red-500' : currentHardware.cpu_temp > 60 ? 'text-yellow-500' : 'text-green-400'}`}>
                        {currentHardware.cpu_temp.toFixed(1)}°C
                      </span>
                      <span className="text-xs text-gray-400 italic">
                        {currentHardware.cpu_temp > 75 ? 'Rất nóng' : currentHardware.cpu_temp > 60 ? 'Ấm' : 'Bình thường'}
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // OTP Verification Modal State
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [verifyingUser, setVerifyingUser] = useState<any>(null);
  const [otpCode, setOtpCode] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [otpSuccess, setOtpSuccess] = useState('');
  const [resending, setResending] = useState(false);

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
    if (isSubmitting) return;
    setError('');
    const url = editingUser ? `/api/v1/users/${editingUser.id}` : '/api/v1/users';
    const method = editingUser ? 'PUT' : 'POST';
    const payload: any = { role, email: email.trim() };
    if (!editingUser) payload.username = username;
    if (password) payload.password = password;
    
    setIsSubmitting(true);
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
    } catch (err: any) { 
      setError(err.message); 
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Xóa người dùng này?')) return;
    try {
      const res = await fetch(`/api/v1/users/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      if (res.status === 401) return onUnauthorized();
      if (res.ok) fetchUsers();
    } catch {}
  };

  const openVerifyModal = (u: any) => {
    setVerifyingUser(u);
    setOtpCode('');
    setOtpError('');
    setOtpSuccess('');
    setIsVerifyModalOpen(true);
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyingUser) return;
    setOtpLoading(true);
    setOtpError('');
    setOtpSuccess('');
    try {
      const res = await fetch('/api/v1/auth/verify-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ user_id: verifyingUser.id, code: otpCode.trim() })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Xác thực không thành công');
      }
      setOtpSuccess(data.message || 'Xác thực thành công!');
      fetchUsers();
      setTimeout(() => {
        setIsVerifyModalOpen(false);
      }, 1500);
    } catch (err: any) {
      setOtpError(err.message);
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendCode = async (userId: number) => {
    setResending(true);
    setOtpError('');
    setOtpSuccess('');
    try {
      const res = await fetch('/api/v1/auth/resend-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ user_id: userId })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Không thể gửi lại mã OTP');
      }
      setOtpSuccess(data.message || 'Đã gửi mã OTP mới');
    } catch (err: any) {
      setOtpError(err.message);
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Người dùng & Member</h1>
          <p className="text-gray-400 mt-2">Quản lý tài khoản, xác thực email thành viên để gán quản lý máy chủ.</p>
        </div>
        <button 
          onClick={() => { setEditingUser(null); setUsername(''); setEmail(''); setPassword(''); setRole('user'); setIsModalOpen(true); }} 
          className="bg-neon-blue text-black font-bold px-6 py-3 rounded-xl flex items-center gap-2"
        >
          <Plus size={20} /> Thêm người dùng
        </button>
      </div>

      <div className="glass rounded-[32px] overflow-hidden border border-white/10">
        {loading ? <div className="p-8 text-center text-gray-500">Đang tải...</div> : (
          <table className="w-full text-left">
            <thead className="bg-white/5 text-gray-400 text-xs uppercase">
              <tr>
                <th className="px-6 py-4">Tên đăng nhập</th>
                <th>Email nhận cảnh báo</th>
                <th>Trạng thái xác thực</th>
                <th>Quyền</th>
                <th>Ngày tạo</th>
                <th className="text-right px-6">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-gray-300">
              {users.map(u => (
                <tr key={u.id} className="border-b border-white/5">
                  <td className="px-6 py-4 font-bold text-white flex items-center gap-3">
                    <img src={`https://ui-avatars.com/api/?name=${u.username}&background=00f3ff`} className="w-8 h-8 rounded-full" alt="" />
                    {u.username}
                  </td>
                  <td className="font-mono text-xs">
                    {u.email ? (
                      <span className="text-neon-blue flex items-center gap-1.5">
                        <Mail size={13} /> {u.email}
                      </span>
                    ) : (
                      <span className="text-gray-500 italic">Chưa thiết lập</span>
                    )}
                  </td>
                  <td>
                    {u.is_verified ? (
                      <span className="inline-flex items-center gap-1.5 text-green-400 bg-green-400/10 border border-green-400/20 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                        <CheckCircle2 size={12} /> Đã xác thực
                      </span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
                          <AlertTriangle size={12} /> Chưa xác thực
                        </span>
                        {u.email && (
                          <button 
                            onClick={() => openVerifyModal(u)} 
                            className="text-[10px] font-bold text-neon-blue hover:text-white bg-neon-blue/10 hover:bg-neon-blue/20 border border-neon-blue/30 px-2 py-0.5 rounded-lg transition-colors"
                          >
                            Nhập OTP
                          </button>
                        )}
                        {u.email && (
                          <button 
                            onClick={() => handleResendCode(u.id)} 
                            disabled={resending}
                            title="Gửi lại mã xác thực OTP" 
                            className="p-1 text-gray-400 hover:text-neon-blue bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                          >
                            <Send size={12} />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                  <td><span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${u.role==='admin'?'bg-neon-purple/20 text-neon-purple':'bg-white/10 text-gray-400'}`}>{u.role}</span></td>
                  <td className="text-sm text-gray-400">{new Date(u.created_at).toLocaleString()}</td>
                  <td className="text-right px-6 space-x-2">
                    <button 
                      onClick={() => { setEditingUser(u); setUsername(u.username); setEmail(u.email || ''); setPassword(''); setRole(u.role); setIsModalOpen(true); }} 
                      className="text-neon-blue hover:text-white p-2"
                      title="Chỉnh sửa người dùng"
                    >
                      <Edit2 size={16}/>
                    </button>
                    <button 
                      onClick={() => handleDelete(u.id)} 
                      className="text-red-400 hover:text-red-300 p-2"
                      title="Xóa người dùng"
                    >
                      <Trash2 size={16}/>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal Thêm / Sửa Người Dùng */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="glass max-w-md w-full p-8 rounded-[32px] border border-white/10">
            <h2 className="text-2xl font-bold mb-6 text-white">{editingUser ? 'Sửa người dùng' : 'Thêm người dùng mới'}</h2>
            <form onSubmit={handleSave} className="space-y-4">
              {!editingUser && (
                <div>
                  <label className="text-xs text-gray-500 font-bold uppercase mb-1 block">Tên đăng nhập</label>
                  <input type="text" value={username} onChange={e=>setUsername(e.target.value)} required className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-neon-blue/50" />
                </div>
              )}
              <div>
                <label className="text-xs text-gray-500 font-bold uppercase mb-1 block">Email nhận thông báo máy chủ</label>
                <input 
                  type="email" 
                  placeholder="admin@c500.net hoặc user@domain.com" 
                  value={email} 
                  onChange={e=>setEmail(e.target.value)} 
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-neon-blue/50 font-mono text-sm" 
                />
                <p className="text-[10px] text-gray-400 mt-1">Hệ thống sẽ gửi mã OTP 6 số từ <strong>admin@c500.net</strong> để xác thực.</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 font-bold uppercase mb-1 block">{editingUser ? 'Mật khẩu mới (để trống nếu không đổi)' : 'Mật khẩu'}</label>
                <input type="password" value={password} onChange={e=>setPassword(e.target.value)} required={!editingUser} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-neon-blue/50" />
              </div>
              <div>
                <label className="text-xs text-gray-500 font-bold uppercase mb-1 block">Vai trò</label>
                <select value={role} onChange={e=>setRole(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white outline-none">
                  <option value="user">Người dùng / Member (Quản lý máy & nhận mail)</option>
                  <option value="admin">Quản trị viên (Toàn quyền)</option>
                </select>
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <div className="pt-4 flex gap-2">
                <button 
                  type="submit" 
                  disabled={isSubmitting} 
                  className={`flex-1 bg-neon-blue text-black font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-[0_0_20px_rgba(0,243,255,0.4)]'}`}
                >
                  {isSubmitting && <Loader2 className="animate-spin" size={16} />}
                  {isSubmitting ? 'Đang lưu...' : 'Lưu lại'}
                </button>
                <button type="button" disabled={isSubmitting} onClick={()=>setIsModalOpen(false)} className="flex-1 bg-white/5 text-gray-400 hover:text-white py-3 rounded-xl transition-colors">Hủy bỏ</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Xác Thực Email OTP */}
      {isVerifyModalOpen && verifyingUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="glass max-w-md w-full p-8 rounded-[32px] border border-white/10">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Mail className="text-neon-blue" size={24} /> Xác Thực Email Member
                </h2>
                <p className="text-gray-400 text-sm mt-1">
                  Người dùng: <strong className="text-white">{verifyingUser.username}</strong>
                </p>
              </div>
              <button onClick={() => setIsVerifyModalOpen(false)} className="text-gray-500 hover:text-white p-1">
                <X size={20} />
              </button>
            </div>

            <div className="p-4 bg-white/5 border border-white/10 rounded-2xl mb-6 text-xs text-gray-300">
              Mã xác thực gồm 6 chữ số đã được gửi đến hòm thư:
              <div className="text-neon-blue font-bold font-mono text-sm mt-1">{verifyingUser.email}</div>
            </div>

            <form onSubmit={handleVerifyOTP} className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 font-bold uppercase mb-2 block text-center">
                  Nhập mã OTP (6 chữ số)
                </label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="123456"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-black/40 border border-neon-blue/30 rounded-2xl p-4 text-white text-center text-3xl font-mono tracking-[12px] outline-none focus:border-neon-blue focus:shadow-[0_0_20px_rgba(0,243,255,0.3)] transition-all"
                  autoFocus
                  required
                />
              </div>

              {otpError && <p className="text-red-400 text-xs text-center">{otpError}</p>}
              {otpSuccess && <p className="text-green-400 text-xs text-center">{otpSuccess}</p>}

              <div className="pt-4 space-y-2">
                <button
                  type="submit"
                  disabled={otpLoading || otpCode.length !== 6}
                  className="w-full bg-neon-blue text-black font-bold py-3.5 rounded-xl hover:shadow-[0_0_20px_rgba(0,243,255,0.4)] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {otpLoading ? <Loader2 className="animate-spin" size={18} /> : <>Xác nhận OTP</>}
                </button>
                <div className="flex justify-between items-center pt-2 text-xs">
                  <button
                    type="button"
                    onClick={() => handleResendCode(verifyingUser.id)}
                    disabled={resending}
                    className="text-neon-blue hover:underline flex items-center gap-1"
                  >
                    <Send size={12} /> {resending ? 'Đang gửi...' : 'Gửi lại mã OTP'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsVerifyModalOpen(false)}
                    className="text-gray-400 hover:text-white"
                  >
                    Hủy bỏ
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const ProfilePage: React.FC<{ user: User, onUpdateUser?: (updated: User) => void }> = ({ user, onUpdateUser }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdMessage, setPwdMessage] = useState('');
  const [pwdError, setPwdError] = useState('');

  // Email state
  const [email, setEmail] = useState(user.email || '');
  const [isVerified, setIsVerified] = useState(user.is_verified || false);
  const [userId, setUserId] = useState<number | undefined>(user.id);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailMessage, setEmailMessage] = useState('');
  const [emailError, setEmailError] = useState('');

  // OTP state
  const [otpCode, setOtpCode] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [showOtpInput, setShowOtpInput] = useState(!user.is_verified && Boolean(user.email));

  const refreshProfile = async () => {
    try {
      const res = await fetch('/api/v1/users/me', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setEmail(data.email || '');
        setIsVerified(data.is_verified || false);
        setUserId(data.id);
        setShowOtpInput(!data.is_verified && Boolean(data.email));
        if (onUpdateUser) {
          onUpdateUser({ ...user, email: data.email, is_verified: data.is_verified, id: data.id });
        }
      }
    } catch (err) {
      console.error('Failed to refresh profile:', err);
    }
  };

  useEffect(() => {
    refreshProfile();
  }, []);

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setEmailError('Vui lòng nhập địa chỉ email');
      return;
    }
    setEmailLoading(true);
    setEmailError('');
    setEmailMessage('');
    try {
      const res = await fetch('/api/v1/users/me/email', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ email: email.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Không thể lưu email');
      setEmailMessage(data.message || 'Đã lưu email và gửi mã OTP.');
      setIsVerified(false);
      setUserId(data.user_id);
      setShowOtpInput(true);
    } catch (err: any) {
      setEmailError(err.message);
    } finally {
      setEmailLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode.trim() || !userId) {
      setEmailError('Vui lòng nhập mã OTP');
      return;
    }
    setOtpLoading(true);
    setEmailError('');
    setEmailMessage('');
    try {
      const res = await fetch('/api/v1/auth/verify-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ user_id: userId, code: otpCode.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Mã OTP không hợp lệ');
      setEmailMessage(data.message || 'Xác thực email thành công!');
      setIsVerified(true);
      setShowOtpInput(false);
      setOtpCode('');
      refreshProfile();
    } catch (err: any) {
      setEmailError(err.message);
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (!userId) return;
    setEmailLoading(true);
    setEmailError('');
    setEmailMessage('');
    try {
      const res = await fetch('/api/v1/auth/resend-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ user_id: userId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Không thể gửi lại mã OTP');
      setEmailMessage(data.message || 'Đã gửi lại mã OTP');
    } catch (err: any) {
      setEmailError(err.message);
    } finally {
      setEmailLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPwdError('Mật khẩu mới không khớp');
      return;
    }
    setPwdLoading(true);
    setPwdError('');
    setPwdMessage('');
    try {
      const res = await fetch('/api/v1/users/me/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Không thể đổi mật khẩu');
      setPwdMessage('Đã cập nhật mật khẩu thành công');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPwdError(err.message);
    } finally {
      setPwdLoading(false);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Hồ sơ cá nhân & Email nhận thông báo</h1>
        <p className="text-gray-400 mt-2">Thiết lập email của bạn để nhận cảnh báo khi máy chủ bị mất kết nối hoặc quá tải tài nguyên.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Card 1: Email & Member Verification */}
        <div className="glass rounded-[32px] p-8 border border-white/10 space-y-6">
          <div className="flex items-center gap-6">
            <img src={user.avatar || `https://ui-avatars.com/api/?name=${user.username}&background=00f3ff`} className="w-20 h-20 rounded-full border-2 border-neon-blue" alt="Avatar" />
            <div>
              <h2 className="text-2xl font-bold text-white">{user.username}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-neon-blue font-bold uppercase text-xs px-2.5 py-0.5 rounded-full bg-neon-blue/10 border border-neon-blue/20">
                  {user.role === 'admin' ? 'Quản trị viên' : 'Member / Người dùng'}
                </span>
                {isVerified ? (
                  <span className="inline-flex items-center gap-1 text-green-400 bg-green-400/10 border border-green-400/20 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase">
                    <CheckCircle2 size={12} /> Đã xác thực
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase">
                    <AlertTriangle size={12} /> Chưa xác thực
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-white/5 pt-4 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Mail className="text-neon-blue" size={20} /> Email Nhận Thông Báo Máy Chủ
            </h3>
            
            <form onSubmit={handleUpdateEmail} className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 font-bold uppercase mb-1 block">Địa chỉ Email của bạn</label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vidu@gmail.com"
                    required
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-sm focus:border-neon-blue outline-none"
                  />
                  <button
                    type="submit"
                    disabled={emailLoading}
                    className="bg-neon-blue text-black font-bold px-5 py-3 rounded-xl hover:shadow-[0_0_20px_rgba(0,243,255,0.4)] transition-all flex items-center gap-1.5 disabled:opacity-50 text-sm"
                  >
                    {emailLoading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    <span>Lưu & Gửi OTP</span>
                  </button>
                </div>
                <p className="text-[11px] text-gray-400 mt-1.5">
                  Mail server <strong>admin@c500.net</strong> sẽ gửi mã OTP 6 số đến địa chỉ này để kích hoạt.
                </p>
              </div>
            </form>

            {/* Form nhập mã OTP */}
            {showOtpInput && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5 space-y-3 animate-in fade-in duration-300">
                <div className="flex items-center justify-between">
                  <div className="text-amber-400 font-bold text-xs flex items-center gap-1.5">
                    <CheckCircle2 size={16} /> Nhập mã OTP 6 số để hoàn tất xác thực:
                  </div>
                  <button
                    type="button"
                    onClick={handleResendOTP}
                    disabled={emailLoading}
                    className="text-xs text-amber-300 hover:text-white hover:underline flex items-center gap-1"
                  >
                    <Send size={12} /> Gửi lại mã
                  </button>
                </div>

                <form onSubmit={handleVerifyOTP} className="flex gap-2">
                  <input
                    type="text"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="Nhập 6 số..."
                    required
                    className="w-40 bg-black/60 border border-amber-500/30 rounded-xl px-4 py-2.5 text-center text-white font-mono text-lg tracking-widest focus:border-amber-400 outline-none"
                  />
                  <button
                    type="submit"
                    disabled={otpLoading}
                    className="bg-amber-400 hover:bg-amber-300 text-black font-bold px-5 py-2.5 rounded-xl transition-all flex items-center gap-1.5 text-sm disabled:opacity-50"
                  >
                    {otpLoading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                    <span>Xác nhận</span>
                  </button>
                </form>
              </div>
            )}

            {emailError && <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 p-3 rounded-xl">{emailError}</p>}
            {emailMessage && <p className="text-green-400 text-xs bg-green-500/10 border border-green-500/20 p-3 rounded-xl">{emailMessage}</p>}
          </div>
        </div>

        {/* Card 2: Change Password */}
        <div className="glass rounded-[32px] p-8 border border-white/10 space-y-6">
          <h3 className="text-xl font-bold flex items-center gap-2 text-white">
            <Key size={20} className="text-yellow-400" /> Đổi Mật Khẩu
          </h3>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="text-xs text-gray-500 font-bold uppercase mb-1 block">Mật khẩu hiện tại</label>
              <input type="password" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)} placeholder="••••••••" required className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:border-neon-blue/50 outline-none" />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-bold uppercase mb-1 block">Mật khẩu mới</label>
              <input type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="••••••••" required minLength={6} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:border-neon-blue/50 outline-none" />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-bold uppercase mb-1 block">Xác nhận mật khẩu mới</label>
              <input type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="••••••••" required minLength={6} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:border-neon-blue/50 outline-none" />
            </div>
            {pwdError && <p className="text-red-400 text-sm">{pwdError}</p>}
            {pwdMessage && <p className="text-green-400 text-sm">{pwdMessage}</p>}
            <button type="submit" disabled={pwdLoading} className="w-full bg-neon-blue text-black font-bold py-3.5 rounded-xl disabled:opacity-50 transition-all hover:shadow-[0_0_20px_rgba(0,243,255,0.4)]">
              {pwdLoading ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
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
          <SidebarItem icon={<Key size={20}/>} label="API Keys" active={activeTab==='apikeys'} onClick={()=>setActiveTab('apikeys')}/>
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
          {activeTab === 'apikeys' && <ApiKeysPage token={token!} onUnauthorized={handleUnauthorized} />}
          {activeTab === 'docs' && <DocsPage />}
          {activeTab === 'settings' && user?.role === 'admin' && <SettingsPage token={token!} onUnauthorized={handleUnauthorized} />}
          {activeTab === 'profile' && <ProfilePage user={user!} onUpdateUser={(updated) => setUser(updated)} />}
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

const InstallCommandCard: React.FC<{ 
  title: string, 
  description: string, 
  command: string, 
  emergencyKey?: string,
  copied: boolean, 
  loading: boolean, 
  onCopy: () => void 
}> = ({ title, description, command, emergencyKey, copied, loading, onCopy }) => {
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);

  const handleCopyKey = () => {
    if (emergencyKey) {
      copyToClipboard(emergencyKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const handleCopyAll = () => {
    if (command && emergencyKey) {
      const allText = `LỆNH CÀI ĐẶT (${title}):\n${command}\n\nEMERGENCY SECRET KEY (CỨU HỘ):\n${emergencyKey}`;
      copyToClipboard(allText);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    }
  };

  return (
    <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6 min-w-0 space-y-4 hover:border-white/20 transition-all">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            {title}
            {emergencyKey && (
              <span className="text-[10px] bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full font-bold uppercase">
                Key đã tạo
              </span>
            )}
          </h3>
          <p className="text-sm text-gray-400 mt-1">{description} · token hết hạn sau 5 phút</p>
        </div>
        <button 
          onClick={onCopy} 
          disabled={loading} 
          className="inline-flex items-center gap-2 rounded-xl bg-neon-blue hover:shadow-[0_0_20px_rgba(0,243,255,0.4)] px-4 py-2 text-sm font-bold text-black disabled:opacity-60 transition-all"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : copied ? <Check size={16} /> : <RotateCw size={16} />}
          {loading ? 'Đang tạo...' : emergencyKey ? 'Tạo lại Lệnh & Key' : 'Tạo & sao chép'}
        </button>
      </div>

      {/* Box 1: Lệnh Cài Đặt */}
      <div>
        <label className="text-[11px] font-bold text-gray-400 uppercase mb-1.5 flex items-center justify-between">
          <span>Lệnh cài đặt (1 lần):</span>
          {command.startsWith('powershell') || command.startsWith('curl') ? (
            <button
              onClick={() => { copyToClipboard(command); }}
              className="text-neon-blue hover:underline flex items-center gap-1 text-[10px]"
            >
              <Copy size={12} /> Chép lệnh
            </button>
          ) : null}
        </label>
        <pre className="overflow-x-auto w-full rounded-2xl bg-black/50 border border-white/10 p-3.5 text-xs text-neon-blue whitespace-nowrap font-mono">
          <code>{command}</code>
        </pre>
      </div>

      {/* Box 2: Emergency Secret Key (Luôn hiển thị ô để gán key) */}
      <div className={`rounded-2xl p-4 space-y-2.5 transition-all duration-300 border ${
        emergencyKey 
          ? 'bg-amber-500/10 border-amber-500/30' 
          : 'bg-white/5 border-dashed border-white/10'
      }`}>
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold flex items-center gap-1.5 text-amber-400">
            <ShieldAlert size={16} /> Emergency Secret Key (Dùng cứu hộ khi máy bị hack)
          </span>
          {emergencyKey ? (
            <span className="text-[10px] bg-amber-500/20 px-2 py-0.5 rounded text-amber-300 uppercase tracking-wider font-bold">
              Chỉ hiển thị 1 lần
            </span>
          ) : (
            <span className="text-[10px] text-gray-500 italic">Chưa tạo</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            readOnly
            value={emergencyKey || ''}
            placeholder='Bấm "Tạo & sao chép" ở trên để sinh Secret Key mới...'
            className={`flex-1 font-mono text-xs px-3.5 py-2.5 rounded-xl border outline-none select-all ${
              emergencyKey 
                ? 'bg-black/60 border-amber-500/30 text-amber-200 font-bold' 
                : 'bg-black/30 border-white/5 text-gray-500'
            }`}
          />
          {emergencyKey && (
            <button 
              onClick={handleCopyKey}
              className="bg-amber-400 hover:bg-amber-300 text-black font-bold px-3 py-2.5 rounded-xl transition-colors flex items-center gap-1 text-xs shadow-[0_0_10px_rgba(245,158,11,0.2)]"
              title="Sao chép Secret Key"
            >
              {copiedKey ? <Check size={14} /> : <Copy size={14} />}
              <span>{copiedKey ? 'Đã chép' : 'Chép Key'}</span>
            </button>
          )}
        </div>

        <div className="flex items-center justify-between text-[11px] text-gray-400 leading-relaxed pt-1">
          <span>
            {emergencyKey ? (
              <>Lưu mã này cẩn thận! Dùng để <strong>đổi pass Administrator/root</strong> hoặc <strong>chèn SSH key</strong> từ xa.</>
            ) : (
              <>Mã Secret Key sẽ được tự động sinh ngẫu nhiên và gán vào ô này mỗi khi bạn bấm Tạo lệnh.</>
            )}
          </span>
          {emergencyKey && (
            <button
              onClick={handleCopyAll}
              className="text-xs text-neon-blue hover:text-white hover:underline flex items-center gap-1 shrink-0 ml-2 font-medium"
            >
              {copiedAll ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
              <span>{copiedAll ? 'Đã chép cả 2' : 'Chép Lệnh + Key'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

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

interface APIKeyItem {
  id: number;
  user_id: number;
  name: string;
  key_prefix: string;
  role: string;
  scopes: string;
  last_used_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

const ApiKeysPage: React.FC<{ token: string; onUnauthorized: () => void }> = ({ token, onUnauthorized }) => {
  const [keys, setKeys] = useState<APIKeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [expiresInDays, setExpiresInDays] = useState(0);
  const [role, setRole] = useState('admin');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Step 2: Display created raw key
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [hasCopied, setHasCopied] = useState(false);

  const fetchKeys = async () => {
    try {
      const res = await fetch('/api/v1/api-keys', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.status === 401) return onUnauthorized();
      if (res.ok) setKeys(await res.json());
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError('');
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/v1/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name: name.trim(), expires_in_days: expiresInDays, role })
      });
      if (res.status === 401) return onUnauthorized();
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Không thể tạo API Key');
      setCreatedKey(data.key);
      fetchKeys();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteKey = async (id: number) => {
    if (!window.confirm('Bạn có chắc chắn muốn thu hồi (xóa) API Key này không? Các AI Agent hoặc script đang dùng key này sẽ bị ngắt quyền truy cập ngay lập tức.')) return;
    try {
      const res = await fetch(`/api/v1/api-keys/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.status === 401) return onUnauthorized();
      if (res.ok) fetchKeys();
    } catch {}
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCreatedKey(null);
    setName('');
    setExpiresInDays(0);
    setError('');
    setHasCopied(false);
  };

  const handleCopyKey = () => {
    if (!createdKey) return;
    navigator.clipboard.writeText(createdKey);
    setHasCopied(true);
    setTimeout(() => setHasCopied(false), 2000);
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Key className="text-neon-blue" /> Quản lý API Keys
          </h1>
          <p className="text-gray-400 mt-1">Cấp quyền truy cập tự động cho AI Agent, Script, và các dịch vụ bên ngoài</p>
        </div>
        <button
          onClick={() => { setIsModalOpen(true); setCreatedKey(null); }}
          className="bg-neon-blue text-black font-bold px-6 py-3 rounded-2xl flex items-center gap-2 hover:shadow-[0_0_20px_rgba(0,243,255,0.4)] transition-all"
        >
          <Plus size={18} /> Tạo API Key mới
        </button>
      </div>

      {/* AI Agent Quickstart Card */}
      <div className="glass rounded-[32px] p-6 border border-neon-blue/20 bg-neon-blue/5">
        <h3 className="text-lg font-bold text-neon-blue mb-2 flex items-center gap-2">
          🤖 Dành cho AI Agent & Tự động hóa
        </h3>
        <p className="text-sm text-gray-300 leading-relaxed mb-4">
          Hệ thống cung cấp sẵn các Endpoint tự mô tả để LLM (Claude, ChatGPT, Gemini, LangChain, MCP) có thể đọc hiểu cách gọi API tự động:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono">
          <a
            href="/api/v1/ai/docs"
            target="_blank"
            rel="noreferrer"
            className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl flex items-center justify-between text-gray-200 transition-colors"
          >
            <span>📄 /api/v1/ai/docs (Markdown)</span>
            <ChevronRight size={14} className="text-neon-blue" />
          </a>
          <a
            href="/llms.txt"
            target="_blank"
            rel="noreferrer"
            className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl flex items-center justify-between text-gray-200 transition-colors"
          >
            <span>📜 /llms.txt (LLM Prompt)</span>
            <ChevronRight size={14} className="text-neon-blue" />
          </a>
          <a
            href="/api/v1/openapi.json"
            target="_blank"
            rel="noreferrer"
            className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl flex items-center justify-between text-gray-200 transition-colors"
          >
            <span>⚙️ /api/v1/openapi.json (OpenAPI 3.0)</span>
            <ChevronRight size={14} className="text-neon-blue" />
          </a>
        </div>
        <div className="mt-4 p-3 bg-black/40 rounded-xl border border-white/5 text-xs font-mono text-gray-400">
          <span className="text-gray-500"># Gọi kiểm tra trạng thái:</span><br/>
          curl -H "X-API-Key: &lt;YOUR_API_KEY&gt;" {window.location.origin}/api/v1/ai/ping
        </div>
      </div>

      {/* API Keys Table */}
      <div className="glass rounded-[32px] overflow-hidden border border-white/10">
        {loading ? (
          <div className="p-8 text-center text-gray-500 flex items-center justify-center gap-2">
            <Loader2 className="animate-spin" size={20} /> Đang tải danh sách API Keys...
          </div>
        ) : keys.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Key size={40} className="mx-auto mb-3 opacity-30 text-neon-blue" />
            <p>Chưa có API Key nào được tạo.</p>
            <p className="text-xs text-gray-600 mt-1">Bấm "Tạo API Key mới" để bắt đầu tích hợp với AI Agent hoặc Script.</p>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-white/5 text-gray-400 text-xs uppercase">
              <tr>
                <th className="px-6 py-4">Tên Key</th>
                <th>Tiền tố (Prefix)</th>
                <th>Vai trò</th>
                <th>Phạm vi</th>
                <th>Lần dùng cuối</th>
                <th>Hết hạn</th>
                <th className="text-right px-6">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-gray-300">
              {keys.map(k => (
                <tr key={k.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="px-6 py-4 font-bold text-white flex items-center gap-2">
                    <Key size={14} className="text-neon-blue" />
                    {k.name}
                  </td>
                  <td className="font-mono text-xs text-neon-blue">
                    <code>{k.key_prefix}...</code>
                  </td>
                  <td>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${k.role === 'admin' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'}`}>
                      {k.role}
                    </span>
                  </td>
                  <td className="text-xs text-gray-400 font-mono">{k.scopes || 'full_access'}</td>
                  <td className="text-xs text-gray-400 font-mono">
                    {k.last_used_at ? new Date(k.last_used_at).toLocaleString() : <span className="italic text-gray-600">Chưa sử dụng</span>}
                  </td>
                  <td className="text-xs text-gray-400 font-mono">
                    {k.expires_at ? new Date(k.expires_at).toLocaleDateString() : <span className="text-green-400">Vĩnh viễn</span>}
                  </td>
                  <td className="text-right px-6">
                    <button
                      onClick={() => handleDeleteKey(k.id)}
                      className="p-2 text-gray-500 hover:text-red-400 transition-colors"
                      title="Thu hồi API Key"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal Tạo API Key */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="glass max-w-md w-full p-8 rounded-[32px] border border-white/10">
            {!createdKey ? (
              <>
                <h2 className="text-2xl font-bold mb-6 text-white flex items-center gap-2">
                  <Key className="text-neon-blue" /> Tạo API Key mới
                </h2>
                <form onSubmit={handleCreateKey} className="space-y-4">
                  <div>
                    <label className="text-xs text-gray-500 font-bold uppercase mb-1 block">Tên nhận diện (Mô tả)</label>
                    <input
                      type="text"
                      placeholder="Ví dụ: AI Agent Orchestrator, CLI Deploy Tool..."
                      value={name}
                      onChange={e => setName(e.target.value)}
                      required
                      className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-neon-blue/50 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-bold uppercase mb-1 block">Thời hạn hiệu lực</label>
                    <select
                      value={expiresInDays}
                      onChange={e => setExpiresInDays(parseInt(e.target.value))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white outline-none text-sm"
                    >
                      <option value={0}>Không bao giờ hết hạn (Khuyên dùng cho AI Agent)</option>
                      <option value={30}>30 ngày</option>
                      <option value={90}>90 ngày</option>
                      <option value={365}>1 năm</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-bold uppercase mb-1 block">Quyền hạn (Role)</label>
                    <select
                      value={role}
                      onChange={e => setRole(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white outline-none text-sm"
                    >
                      <option value="admin">Quản trị viên (Toàn quyền quản lý proxy & server)</option>
                      <option value="user">Người dùng thông thường</option>
                    </select>
                  </div>

                  {error && <p className="text-red-400 text-sm">{error}</p>}

                  <div className="pt-4 flex gap-2">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className={`flex-1 bg-neon-blue text-black font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-[0_0_20px_rgba(0,243,255,0.4)]'}`}
                    >
                      {isSubmitting && <Loader2 className="animate-spin" size={16} />}
                      {isSubmitting ? 'Đang tạo...' : 'Tạo Key'}
                    </button>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={handleCloseModal}
                      className="flex-1 bg-white/5 text-gray-400 hover:text-white py-3 rounded-xl transition-colors"
                    >
                      Hủy bỏ
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center gap-3 text-green-400">
                  <CheckCircle2 size={24} />
                  <h2 className="text-xl font-bold text-white">API Key đã được tạo!</h2>
                </div>

                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-xs text-amber-300 leading-relaxed">
                  ⚠️ <strong>Quan trọng:</strong> Hãy sao chép và lưu trữ API Key này ngay bây giờ. Vì lý do bảo mật, bạn sẽ <strong>không thể xem lại</strong> khóa này một khi cửa sổ đóng lại!
                </div>

                <div>
                  <label className="text-xs text-gray-400 font-bold uppercase mb-1 block">API Key của bạn:</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={createdKey}
                      className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-neon-blue font-mono text-xs outline-none select-all"
                    />
                    <button
                      onClick={handleCopyKey}
                      className={`px-4 py-3 rounded-xl font-bold text-sm flex items-center gap-1.5 transition-all ${hasCopied ? 'bg-green-500 text-black' : 'bg-neon-blue text-black hover:shadow-[0_0_15px_rgba(0,243,255,0.4)]'}`}
                    >
                      {hasCopied ? <Check size={16} /> : <Copy size={16} />}
                      <span>{hasCopied ? 'Đã chép' : 'Sao chép'}</span>
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleCloseModal}
                    className="w-full bg-white/10 text-white font-bold py-3 rounded-xl hover:bg-white/20 transition-all"
                  >
                    Tôi đã lưu khóa này an toàn
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
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
            <p className="font-bold text-white mb-1">HTTP Proxy (Subdomain hoặc Tên miền riêng):</p>
            <p>Sử dụng Subdomain hệ thống <code className="text-neon-blue">[subdomain].{import.meta.env.VITE_WILDCARD_DOMAIN || 'v1.ovncr.vn'}</code> hoặc Tên miền riêng (Custom Domain). Hệ thống hỗ trợ sinh cấu hình Nginx Reverse Proxy và cấp phát chứng chỉ SSL/TLS miễn phí qua Let's Encrypt.</p>
            <p className="text-xs text-gray-400 mt-2 border-t border-white/5 pt-2">
              <strong className="text-neon-blue">Cấu hình mặc định tối ưu:</strong> Tự động cách ly cấu hình trong thư mục riêng biệt <code className="text-neon-blue">/etc/nginx/proxymanager.d/</code>. Hỗ trợ đầy đủ kết nối WebSockets, tối ưu tải file dung lượng lớn (lên tới 1GB), và tăng giới hạn timeout kết nối lên 300s để đảm bảo đường truyền ổn định.
            </p>
          </div>
          <div>
            <p className="font-bold text-white mb-1">TCP/UDP Proxy:</p>
            <p>Nhập <span className="text-white font-bold">Cổng Công khai (Remote Port)</span> tùy ý mà bạn muốn mở trên máy chủ (hệ thống không giới hạn dải cổng, bạn có thể chọn bất kỳ cổng nào từ 1 - 65535 chưa bị trùng). Đây là cổng bạn sẽ dùng để truy cập dịch vụ từ xa.</p>
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
