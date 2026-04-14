# 🚀 ProxyManager: FRP Centralized Management System

**ProxyManager** là một hệ thống quản lý tập trung **Fast Reverse Proxy (FRP) v0.68.0**, được xây dựng hoàn toàn bởi **4 AI Agents (Gemini CLI)** phối hợp qua Git. Dự án cung cấp giải pháp Control Plane mạnh mẽ để giám sát, điều khiển và thiết lập tunnel cho hàng ngàn máy chủ từ xa.

---

## 🤖 Hành trình xây dựng bằng AI Agents

Dự án này là minh chứng cho khả năng phối hợp tự động của các AI Agents (Gemini CLI) theo mô hình **Software Development Lifecycle (SDLC)**:

*   **Agent #1 (Lead Architect):** Thiết kế nền móng, gRPC Protobuf, Database Schema và điều phối Roadmap.
*   **Agent #2 (Backend Developer):** Triển khai Go Server, Dashboard API, JWT Auth và WebSocket Real-time.
*   **Agent #3 (Client Agent Developer):** Xây dựng Agent Go chạy trên máy đích, quét Port/Phần cứng, Watchdog và Remote Exec.
*   **Agent #4 (Frontend & DevOps):** Thiết kế UI Dark Mode (React/Vite/Tailwind), Dockerization và Script cài đặt nhanh.

---

## ✨ Tính năng nổi bật

*   **Real-time Monitoring:** Biểu đồ sức khỏe máy chủ (CPU, RAM, Network) cập nhật liên tục qua WebSocket.
*   **Smart Port Scanner:** Tự động phát hiện các Port đang mở và định danh dịch vụ trên máy khách.
*   **Remote Terminal & Exec:** Gửi lệnh Shell và nhận kết quả trực tiếp từ Dashboard.
*   **Log Streaming:** Theo dõi Log hệ thống từ xa theo thời gian thực (chuẩn `tail -f`).
*   **FRP v0.68.0 Integration:** Quản lý Tunnel cấu hình hoàn toàn bằng YAML, hỗ trợ HTTP/TCP/UDP.
*   **Wildcard Subdomain Support:** Hỗ trợ tạo proxy HTTP với domain wildcard `*.v1.c500.net` và kiểm tra tính duy nhất.
*   **Enterprise Security:** Bảo mật JWT Authentication và cô lập mạng bằng Docker Network.

---

## 🏗️ Kiến trúc & Tech Stack

*   **Giao thức:** gRPC (Client-Server), WebSocket (Real-time Stats).
*   **Backend:** Golang (Gin/Echo), MySQL.
*   **Frontend:** React, Vite, Tailwind CSS, Recharts (Dribbble Style).
*   **Hạ tầng:** Docker Compose, Nginx Reverse Proxy, Systemd (Agent Watchdog).

---

## 🚀 Hướng dẫn vận hành (Deployment)

### 1. Triển khai Server (Node hiện tại - IP: 10.0.3.98)
Node này đóng vai trò là **Control Plane**. Server chạy bằng **binary Golang + systemd**, frontend `React/Vite` được build tĩnh và phục vụ trực tiếp bởi binary Go.

```bash
# Build frontend
cd dashboard && npm install && npm run build

# Build backend/server
cd ..
go build -o /opt/proxymanager/server ./cmd/server

# Cài systemd service
cp deploy/systemd/server.service /etc/systemd/system/proxymanager-server.service
systemctl daemon-reload
systemctl enable --now proxymanager-server
```

Truy cập `http://10.0.3.98:8000` và đăng nhập mặc định bằng `admin / admin123` rồi đổi mật khẩu ngay khi chạy thực tế.

### 2. Triển khai Client Agent (Các node khác)
Trên máy chủ muốn quản lý, chạy script cài đặt nhanh:
```bash
# Cài đặt tự động qua bash script
bash scripts/install-agent.sh --server 10.0.3.98:50051
```

### 3. Cách chạy các chức năng chính:
*   **Dashboard:** Xem tổng quan trạng thái Online/Offline của các Node.
*   **Terminal:** Click vào biểu tượng Terminal trên Agent để thực thi lệnh Shell.
*   **Logs:** Xem luồng Log trực tiếp từ các dịch vụ của Agent.
*   **Proxy Mapping:** Thiết lập Domain và Port mapping trỏ về máy nội bộ thông qua FRP.

---

## 🧪 Chiến lược kiểm thử (Testing)
Hệ thống đã được kiểm tra qua các kịch bản:
1.  **Stress Test:** Giả lập 100+ Agent gửi Heartbeat cùng lúc.
2.  **Security Test:** Kiểm tra chặn truy cập trái phép khi không có JWT Token.
3.  **Stability Test:** Agent tự khởi động lại khi bị Panic hoặc rớt mạng.

**Dự án được hoàn thành dưới sự giám sát của Lead Architect (Agent #1).**
