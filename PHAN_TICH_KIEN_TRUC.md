# Phân tích kiến trúc ProxyManager - So sánh nền tảng

## Điểm tốt hơn của project này (TL;DR)

**ProxyManager đóng gói 4 thứ vốn rời rạc vào 1 hệ self-host duy nhất: reverse-proxy (tunnel vượt NAT) + auto-provisioning (zero-touch) + giám sát fleet (telemetry/log/port-scan) + remote ops (exec/upgrade từ xa).**

Cụ thể hơn hẳn đối thủ ở:

1. **Zero-touch provisioning.** Thêm 1 máy mới chỉ cần 1 lệnh hoặc token cài-1-lần. Agent tự register, server tự sinh `frpc.yaml` + token đẩy về qua gRPC. Không sửa file YAML tay. FRP thuần bắt cấu hình thủ công từng máy.
2. **Monitoring gộp sẵn.** Agent vừa tạo tunnel vừa báo CPU/RAM/disk/net, quét port mở, theo dõi systemd service, stream log real-time. Không cần ghép thêm Prometheus/Grafana.
3. **Vận hành phẳng theo số máy.** Quản 100 máy cũng chỉ 1 dashboard, click chuột map domain/port. Không SSH từng máy. FRP thuần khó tuyến tính theo số agent; cái này phẳng.
4. **Self-host, miễn phí, làm chủ data.** Không phụ thuộc bên thứ 3 như ngrok/Cloudflare, không phí định kỳ.

**Đánh đổi:** setup server 1 lần (nặng) để lấy vận hành fleet (nhẹ). Càng nhiều agent càng lời.

---

## 1. Kiến trúc

Control Plane tập trung quấn quanh **FRP v0.68.0**. VPS = gateway "lá chắn", máy nội bộ sau NAT hoàn toàn vô hình với Internet (không mở inbound port nào).

**Stack:** Go (Gin) + gRPC + MySQL + React/Vite/Tailwind + WebSocket. Agent đa nền: linux amd64/arm64, windows.

**3 thành phần:**
- **Server Node (Control Plane / Gateway VPS):** ProxyManager server (gRPC listener + REST + WebSocket) + frps (router tunnel) + MySQL (metadata).
- **Agent Node (máy sau NAT):** ProxyManager agent (telemetry + control) + frpc (tunnel).
- **Dashboard:** React, xem online/offline, log, map proxy.

**Luồng hoạt động:**
1. Agent mở kết nối **outbound** gRPC (port 50051) → xuyên NAT/firewall không cần port forward.
2. Đăng ký: gửi hostname/OS/IP nội bộ → server cấp `Agent ID` + sinh `frpc.yaml` chứa token.
3. Agent chạy `frpc` → tạo tunnel tới frps.
4. Heartbeat liên tục: hardware stats, open_ports, services, log stream.
5. Remote control: admin map proxy trên dashboard → server lưu DB → đẩy gRPC command (`RELOAD_FRPC`) xuống agent cấu hình lại tức thì.

**gRPC service (`proto/agent.proto`):** Register, Heartbeat, ForwardLog, CommandStream (stream Command). Command actions: `RELOAD_FRPC`, `UPGRADE_AGENT`, `RESTART_AGENT`, `REMOTE_EXEC`.

---

## 2. Điểm mới so với FRP thuần

FRP gốc chỉ tạo tunnel. Project bọc thêm:

| Tính năng | FRP thuần | ProxyManager |
|---|---|---|
| Tạo tunnel vượt NAT | Có | Có (dùng FRP) |
| Auto sinh config + token | Không (sửa tay) | Có (gRPC đẩy về) |
| Telemetry CPU/RAM/net | Không | Có |
| Port scanner | Không | Có |
| Log stream từ xa | Không | Có |
| Remote exec / self-update | Không | Có |
| Dashboard quản fleet | Không | Có |
| Token cài-1-lần | Không | Có (bảng `install_tokens`) |

Không phát minh giao thức mới. Mới ở **tích hợp**: gateway bảo mật + auto-tunnel + fleet monitoring + remote ops trong 1 hệ.

---

## 3. Đối tượng nhắm tới

- **Admin/MSP quản nhiều máy sau NAT/IoT** không có IP public: homelab, máy chủ chi nhánh, thiết bị edge.
- **Team nhỏ / tổ chức nội bộ** (repo có localization tiếng Việt) muốn self-host thay ngrok/Cloudflare.
- Người cần **vừa expose service vừa giám sát fleet** mà không muốn ghép 2 tool.
- KHÔNG hợp: SaaS multi-tenant quy mô lớn (thiết kế single control-plane, single admin).

---

## 4. So sánh các nền tảng

### Tính năng / vị thế

| Đối thủ | Project hơn | Project thua |
|---|---|---|
| **ngrok / Cloudflare Tunnel** | Self-host, miễn phí, làm chủ data, có monitoring + remote exec | Họ có anycast edge toàn cầu, DDoS scrubbing, SLA, zero-maintenance |
| **FRP thuần / frp-panel** | Zero-touch provision, telemetry+log gộp, token cài đặt, remote ops | FRP gốc ổn định hơn, cộng đồng lớn |
| **Tailscale / Headscale** | Map domain HTTP/wildcard ra public dễ, monitoring built-in | Mesh WireGuard E2E, NAT traversal P2P xịn hơn; project dồn traffic qua VPS (bottleneck + SPOF) |
| **Pangolin** | Có agent telemetry + remote exec | Pangolin có identity/SSO, ACL chín hơn |

### Độ đơn giản vận hành (dễ → khó)

1. **ngrok / Cloudflare Tunnel** - dễ nhất. Không quản hạ tầng, 1 lệnh. Đổi lại: trả phí, phụ thuộc bên thứ 3.
2. **Tailscale** - rất dễ. Cài client + login, mesh tự lo NAT.
3. **ProxyManager** - trung bình. Setup server nặng (VPS + Go/Node/MySQL/frps/Nginx/systemd), nhưng thêm agent cực dễ (1 lệnh / token), vận hành ngày-thường click chuột.
4. **FRP thuần / frp-panel** - khó hơn cái này. Sửa config tay từng máy, không auto-provision, không monitoring; muốn giám sát phải ghép Prometheus/Grafana.

| Tiêu chí | Dễ nhất |
|---|---|
| Setup ban đầu | ngrok / Cloudflare |
| Thêm 1 máy mới | **ProxyManager** (ngang ngrok) |
| Vận hành nhiều máy hằng ngày | **ProxyManager** |
| Không muốn quản gì | ngrok / Cloudflare / Tailscale |
| Self-host + nhiều agent | **ProxyManager** (hơn FRP thuần rõ rệt) |

**Kết:** ít máy + ngại hạ tầng → ngrok/Tailscale. Nhiều máy + muốn self-host + giám sát → ProxyManager đáng công setup.

---

## 5. Điểm yếu / rủi ro (đọc từ code)

- **`REMOTE_EXEC` = backdoor.** Server đẩy shell tùy ý xuống agent. Control-plane bị chiếm → toàn fleet bị chiếm. Cần audit log + ký lệnh.
- **Mọi traffic qua 1 VPS** - single point of failure + bottleneck băng thông. Không P2P như Tailscale.
- **WebSocket hub broadcast tất cả tới mọi client** (`internal/hub/hub.go`) - không lọc theo quyền. Không scale + lộ data.
- **`SendCommand` rò agent IDs trong error** (`internal/api/handler.go:251`).
- Single-admin, chưa có RBAC/multi-tenant.
- Repo lẫn `tmp/frp_source` + tarball Go 69MB - nên dọn.
