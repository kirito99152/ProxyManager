# FRP Centralized Management System (ProxyManager)

Hệ thống quản lý tập trung Fast Reverse Proxy (FRP) v0.68.0 hỗ trợ Client-Server architecture, tích hợp Dashboard điều khiển và tự động quét port trên Agent.

## 🏗 Architecture Design

```mermaid
graph TD
    subgraph "Control Plane (Server) - IP: 10.0.3.98"
        Dashboard[Go Dashboard & API]
        MySQL[(MySQL DB)]
        FRPS[FRP Server v0.68.0]
        Nginx[Nginx Gateway]
    end

    subgraph "Edge Node (Client) - Remote Nodes"
        Agent[Client Agent - Go]
        FRPC[FRP Client v0.68.0]
    end

    Agent -- "gRPC (Heartbeat, Stats, Ports)" --> Dashboard
    Dashboard -- "Config & Control" --> Agent
    FRPC -- "Tunnel" --> FRPS
    Nginx -- "Reverse Proxy" --> FRPS
    Internet --> Nginx
```

## 🛠 Tech Stack
- **Backend/Dashboard:** Go (Gin/Echo), MySQL, gRPC.
- **Client Agent:** Go, gRPC, `gopsutil`.
- **Tunneling:** [FRP v0.68.0](https://github.com/fatedier/frp/releases/tag/v0.68.0).
- **Gateway:** Nginx.

### 🚀 Deployment Instructions

#### 🐳 Docker Deployment (Recommended for Server)
Node này sẽ chạy các thành phần lõi của hệ thống thông qua Docker.
```bash
# Clone repository
git clone https://github.com/kirito99152/ProxyManager.git
cd ProxyManager

# Cấu hình biến môi trường
cp .env.example .env
# Chỉnh sửa .env nếu cần (đặc biệt là MYSQL_ROOT_PASSWORD)

# Chạy toàn bộ hệ thống bằng Docker Compose
docker-compose -f deploy/docker/docker-compose.yml up -d
```
Hệ thống sẽ bao gồm:
- **MySQL:** Port 3306.
- **Server/Dashboard:** Port 8080.
- **FRPS:** Port 7000 (giao tiếp), 7500 (Dashboard), 80/443 (HTTP/HTTPS).
- **Nginx:** Port 80/443 (Entry point).

#### 🛠 Manual Deployment
Node này sẽ chạy các thành phần lõi của hệ thống.
- Cài đặt MySQL và tạo DB từ `internal/db/schema.sql`.
- Chỉnh sửa cấu hình trong `.env`.
- Build và chạy Server:
  ```bash
  make proto
  make build-server
  ./bin/server
  ```
- Chạy FRPS:
  ```bash
  make download-frp
  ./frps -c configs/frps.yaml
  ```

### 2. Trên Client Agent (Các node khác)
Node đích cần được quản lý sẽ chạy Client Agent.
- Cài đặt nhanh thông qua script (Agent #4):
  ```bash
  curl -sSL https://raw.githubusercontent.com/kirito99152/ProxyManager/main/scripts/install-agent.sh | sudo bash
  ```
- Cấu hình gRPC Server Address trỏ về: `10.0.3.98:50051`.
- Chạy Agent:
  ```bash
  ./bin/agent --server 10.0.3.98:50051
  ```

## 📋 Task List
Xem chi tiết nhiệm vụ của từng Agent tại [TASKS.md](TASKS.md).
