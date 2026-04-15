# 🚀 ProxyManager: FRP Centralized Management System

**ProxyManager** là một hệ thống quản lý tập trung **Fast Reverse Proxy (FRP) v0.68.0**, được xây dựng hoàn toàn bởi **4 AI Agents (Gemini CLI)** phối hợp qua Git. Dự án cung cấp giải pháp Control Plane mạnh mẽ để giám sát, điều khiển và thiết lập tunnel cho hàng ngàn máy chủ từ xa.

---

## 🤖 Hành trình xây dựng bằng AI Agents

Dự án này là minh chứng cho khả năng phối hợp tự động của các AI Agents (Gemini CLI) theo mô hình **Software Development Lifecycle (SDLC)**:

*   **Agent #1 (Lead Architect):** Thiết kế nền móng, gRPC Protobuf, Database Schema và điều phối Roadmap.
*   **Agent #2 (Backend Developer):** Triển khai Go Server, Dashboard API, JWT Auth và WebSocket Real-time.
*   **Agent #3 (Client Agent Developer):** Xây dựng Agent Go chạy trên máy đích, quét Port/Phần cứng, Watchdog.
*   **Agent #4 (Frontend & DevOps):** Thiết kế UI Dark Mode (React/Vite/Tailwind), Dockerization và Script cài đặt nhanh.

---

## ✨ Tính năng nổi bật

*   **Real-time Monitoring:** Biểu đồ sức khỏe máy chủ (CPU, RAM, Network) cập nhật liên tục qua WebSocket.
*   **Smart Port Scanner:** Tự động phát hiện các Port đang mở và định danh dịch vụ trên máy khách.
*   **Log Streaming:** Theo dõi Log hệ thống từ xa theo thời gian thực (chuẩn `tail -f`).
*   **FRP v0.68.0 Integration:** Quản lý Tunnel cấu hình hoàn toàn bằng YAML, hỗ trợ HTTP/TCP/UDP.
*   **Wildcard Subdomain Support:** Hỗ trợ tạo proxy HTTP với domain wildcard `*.v1.ovncr.vn` và kiểm tra tính duy nhất.
*   **Enterprise Security:** Bảo mật JWT Authentication và cô lập mạng bằng Docker Network.

---

## 🏗️ Kiến trúc & Tech Stack

*   **Giao thức:** gRPC (Client-Server), WebSocket (Real-time Stats).
*   **Backend:** Golang (Gin/Echo), MySQL.
*   **Frontend:** React, Vite, Tailwind CSS, Recharts (Dribbble Style).
*   **Hạ tầng:** Docker Compose, Nginx Reverse Proxy, Systemd (Agent Watchdog).

---

## 📋 Yêu cầu hệ thống (System Requirements)
*   **Go:** v1.24.2+
*   **Node.js:** v20.x+
*   **MySQL:** v8.0+
*   **FRP:** v0.68.0 (Tải tại: [frp v0.68.1 Releases](https://github.com/fatedier/frp/releases/tag/v0.68.1))
    *   Sử dụng định dạng cấu hình `.yaml`.
    *   Hệ thống yêu cầu cả `frps` (server) và `frpc` (agent) phải cùng phiên bản 0.68.0 để đảm bảo tính tương thích tốt nhất.

---

## 🚀 Hướng dẫn vận hành (Deployment)

### 1. Triển khai Server (IP: YOUR_SERVER_IP)
Dự án hỗ trợ hai phương pháp triển khai chính cho cụm điều khiển (Control Plane).

#### Phương pháp 1: Sử dụng Script cài đặt & cập nhật (Khuyên dùng)
Đây là cách nhanh nhất để build và cài đặt hệ thống trực tiếp trên host bằng `systemd`.

```bash
# 1. Cài đặt đầy đủ môi trường (Go, Node, MySQL, FRPS)
bash setup.sh

# 2. Chạy script cập nhật & build dự án
bash scripts/update-server.sh
```

#### Phương pháp 2: Triển khai bằng Docker (Alternative)
Nếu bạn muốn chạy hệ thống trong môi trường container cô lập:

```bash
# Khởi chạy toàn bộ stack (Server + MySQL)
docker-compose up -d --build
```
Lưu ý: Chỉnh sửa các biến môi trường trong file `.env` hoặc `docker-compose.yml` trước khi chạy.

### 2. Triển khai Client Agent (Các node khác)
Trên các máy chủ mục tiêu (Target Nodes), chạy script cài đặt tự động để kết nối về Control Plane:
```bash
bash scripts/install-agent.sh --server <YOUR_SERVER_IP>:50051
```

### 3. Cách chạy các chức năng chính:
*   **Dashboard:** Xem tổng quan trạng thái Online/Offline của các Node.
*   **Logs:** Xem luồng Log trực tiếp từ các dịch vụ của Agent.
*   **Proxy Mapping:** Thiết lập Domain và Port mapping trỏ về máy nội bộ thông qua FRP.

---

## 🧪 Chiến lược kiểm thử (Testing)
Hệ thống đã được kiểm tra qua các kịch bản:
1.  **Stress Test:** Giả lập 100+ Agent gửi Heartbeat cùng lúc.
2.  **Security Test:** Kiểm tra chặn truy cập trái phép khi không có JWT Token.
3.  **Stability Test:** Agent tự khởi động lại khi bị Panic hoặc rớt mạng.

**Dự án được hoàn thành dưới sự giám sát của Lead Architect (Agent #1).**
