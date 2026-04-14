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

### 1. Triển khai Server (IP: 10.0.3.98)
Dự án hỗ trợ hai phương pháp triển khai chính cho cụm điều khiển (Control Plane).

#### Phương pháp 1: Sử dụng Script cập nhật nhanh (Khuyên dùng)
Đây là cách nhanh nhất để build và cập nhật hệ thống trực tiếp trên host bằng `systemd`. Script sẽ tự động build Dashboard, Server và các Agent binaries.

```bash
# Chạy script cập nhật tự động
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
bash scripts/install-agent.sh --server 10.0.3.98:50051
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
