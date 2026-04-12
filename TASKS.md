# Project: FRP Centralized Management System
## Roadmap & Task Assignment

Đây là bản phân công nhiệm vụ chi tiết từ **Agent #1 (Lead System Architect)**. Các Agent sau khi "pull" code về vui lòng đọc đúng phần việc của mình và bắt đầu triển khai.

---

### Agent #2: Backend & Dashboard Developer
**Mục tiêu:** Xây dựng Control Plane (Server side).

1. **Tech Stack:** Go (Gin/Echo), MySQL, gRPC.
2. **Nhiệm vụ:**
   - Triển khai Database Schema (MySQL) dựa trên thiết kế của Agent #1.
   - Viết gRPC Server dựa trên `proto/agent.proto`.
   - Xây dựng REST API cho Dashboard (Quản lý Agent, cấu hình Proxy).
   - Viết module quản lý file `configs/frps.yaml` (Tự động cập nhật và reload FRPS).
   - Cung cấp API endpoint để Agent #4 lấy script cài đặt.

---

### Agent #3: Client Agent Developer
**Mục tiêu:** Xây dựng phần mềm Agent chạy trên Edge Node.

1. **Tech Stack:** Go, gRPC Client, FRP Client (frpc) v0.68.0.
2. **Nhiệm vụ:**
   - Viết ứng dụng Go chạy ngầm (Systemd service).
   - Sử dụng `gopsutil` để lấy thông tin CPU, RAM, Disk, Network.
   - Quét các port đang Listen trên máy và định danh service.
   - Kết nối về Server qua gRPC (gửi Heartbeat & nhận Command).
   - Tự động tải/cấu hình/chạy `frpc` v0.68.0 theo hướng dẫn từ Server.

---

### Agent #4: DevOps & Integration Engineer
**Mục tiêu:** Đóng gói, triển khai và tự động hóa.

1. **Nhiệm vụ:**
   - **Quick Install Script:** Viết script Bash để tự động tải `frp v0.68.0` + `Agent` (của Agent #3), cấu hình Systemd.
   - **Nginx Gateway:** Viết template Nginx để tự động tạo Proxy Pass từ Domain -> FRPS (port 8080/8443).
   - **Docker Setup:** Viết Dockerfile cho Dashboard/Server và `docker-compose.yml` để chạy toàn bộ hệ thống (Go Server + MySQL + FRPS + Nginx).
   - **CI/CD:** Hỗ trợ kịch bản build và deploy nhanh.

---

### Ghi chú chung:
- Tất cả cấu hình FRP phải dùng định dạng **YAML** (FRP v0.68.0).
- Giao tiếp giữa Client-Server bắt buộc qua **gRPC**.
- Mọi thay đổi code phải được commit và push lên Git để các thành viên khác đồng bộ.
