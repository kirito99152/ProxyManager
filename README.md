# 🚀 ProxyManager: Hệ thống Quản lý FRP Tập Trung

**ProxyManager** là một hệ thống quản lý tập trung **Fast Reverse Proxy (FRP) v0.68.0**, cung cấp một Control Plane mạnh mẽ để giám sát, điều khiển và thiết lập tunnel cho hàng ngàn máy chủ từ xa.

---

## 🤖 Hành trình xây dựng Hybrid (AI & Human)

Dự án này là minh chứng cho sự kết hợp mạnh mẽ giữa sức mạnh của **AI Agents** và sự tinh chỉnh kỹ thuật từ **Con người**:

*   **80% Khung xương hệ thống (Scaffolding):** Được khởi tạo bởi 4 AI Agents (Gemini CLI) phối hợp song song, giúp đẩy tốc độ xây dựng gRPC, REST API, Dashboard và DevOps lên mức tối đa chỉ trong thời gian ngắn.
*   **20% Hoàn thiện & Production-Ready:** Được tinh chỉnh thủ công bởi nhà phát triển (Human Architect) thông qua việc kiểm thử chuyên sâu với một Gemini CLI duy nhất. Giai đoạn này tập trung vào:
    *   Tối ưu hóa độ ổn định của kết nối gRPC và WebSocket.
    *   Xử lý các trường hợp lỗi mạng (Edge cases) và khôi phục sau sự cố.
    *   Đảm bảo tính bảo mật và hiệu năng thực tế của hệ thống tunnel.

---

## ✨ Tính năng nổi bật

*   **Real-time Monitoring:** Biểu đồ sức khỏe server (CPU, RAM, Network) cập nhật liên tục qua WebSocket.
*   **Smart Port Scanner:** Tự động quét các cổng đang mở và nhận diện dịch vụ trên máy client.
*   **Log Streaming:** Theo dõi log hệ thống từ xa theo thời gian thực (giống `tail -f`).
*   **FRP v0.68.0 Integration:** Quản lý tunnel hoàn toàn bằng cấu hình YAML, hỗ trợ HTTP/TCP/UDP.
*   **Wildcard Subdomain Support:** Hỗ trợ tạo HTTP proxy với tên miền wildcard, tự động kiểm tra tính duy nhất.
*   **Enterprise Security:** Xác thực JWT và phân tách mạng bằng Docker Network.

---

## 🏗️ Kiến trúc & Công nghệ

*   **Protocols:** gRPC (Client-Server), WebSocket (Real-time Stats).
*   **Backend:** Golang (Gin), MySQL.
*   **Frontend:** React, Vite, Tailwind CSS, Recharts.
*   **Infrastructure:** Docker Compose, Nginx Reverse Proxy, Systemd (Agent Watchdog).

---

## 📋 Yêu cầu hệ thống
*   **Go:** v1.22+
*   **Node.js:** v20.x+
*   **MySQL:** v8.0+
*   **FRP:** v0.68.0
    *   Sử dụng định dạng cấu hình `.yaml`.
    *   Yêu cầu cả `frps` (server) và `frpc` (agent) cùng ở bản 0.68.0 để tương thích tốt nhất.

---

## 🚀 Hướng dẫn triển khai

### 1. Triển khai Server (Control Plane)
Dự án hỗ trợ hai phương thức triển khai chính.

#### Cách 1: Script cài đặt (Khuyên dùng)
Cách nhanh nhất để build và cài đặt hệ thống trực tiếp lên host bằng `systemd`.

```bash
# 1. Cài đặt toàn bộ môi trường (Go, Node, MySQL, FRPS)
bash setup.sh

# 2. Chạy script cập nhật và build
bash scripts/update-server.sh
```

#### Cách 2: Triển khai Docker
Dành cho môi trường container biệt lập:

```bash
# Khởi chạy toàn bộ stack (Server + MySQL)
docker-compose up -d --build
```
Lưu ý: Chỉnh sửa các biến môi trường trong `.env` hoặc `docker-compose.yml` trước khi chạy.

### 2. Triển khai Client Agent
Trên các máy con cần quản lý, chạy script cài đặt tự động:
```bash
bash scripts/install-agent.sh --server <IP_SERVER_CỦA_BẠN>:50051
```

### 3. Cách sử dụng:
*   **Dashboard:** Xem trạng thái Online/Offline của toàn bộ Node.
*   **Logs:** Xem luồng Log trực tiếp từ các dịch vụ của Agent.
*   **Proxy Mapping:** Thiết lập Domain và Port mapping trỏ về các máy nội bộ qua FRP.

---

## 📚 Tài liệu bổ sung

Để hiểu sâu hơn về hệ thống, vui lòng tham khảo các tài liệu sau:
*   [Tài liệu Kỹ thuật chi tiết (Architecture)](ProxyManager_Documentation.md)
*   [Hướng dẫn Vận hành chuyên nghiệp (User Guide)](GUIDE.md)

---

## 🧪 Chiến lược kiểm thử (Testing)
Hệ thống đã được kiểm tra qua các kịch bản:
1.  **Stress Test:** Giả lập 100+ Agent gửi Heartbeat cùng lúc.
2.  **Security Test:** Kiểm tra chặn truy cập trái phép khi không có JWT Token.
3.  **Stability Test:** Agent tự khởi động lại khi bị Panic hoặc rớt mạng.

**Dự án được hoàn thành dưới sự giám sát của Lead Architect.**
