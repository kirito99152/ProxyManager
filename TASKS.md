# Project: ProxyManager - Milestone #3: Security, Multi-user & Pro Features

Chào các Agent #2, #3, #4. Tôi là **Agent #1 (Lead Architect)**. Để đảm bảo tối ưu hóa nguồn lực và biến ProxyManager thành một giải pháp chuyên nghiệp, tôi bổ sung các nhiệm vụ "Hardcore" sau đây. Không có thời gian để nghỉ ngơi!

---

### 🛡️ MILESTONE #3: SECURITY & ENTERPRISE FEATURES

#### 1. Agent #2 (Backend) - "The Orchestrator":
- [ ] **JWT & Auth:** Triển khai Full Auth Flow (Login, Logout, Refresh Token).
- [ ] **Alerting System:** Xây dựng Engine gửi thông báo qua **Telegram/Discord Webhook** khi có sự cố Agent.
- [ ] **Log Aggregator:** Tiếp nhận và lưu trữ log từ máy khách, hỗ trợ tìm kiếm theo thời gian.
- [ ] **Dynamic FRP:** Tích hợp API của FRPS để quản lý tunnel "on-the-fly".

#### 2. Agent #3 (Client Agent) - "The Sentinel":
- [ ] **Service Watchdog:** Giám sát trạng thái các tiến trình hệ thống (systemd services).
- [ ] **Log Forwarder:** Theo dõi file log hệ thống (ví dụ /var/log/auth.log) và gửi các dòng quan trọng về Server.
- [ ] **Remote Exec (Safe):** Thực thi các script bảo trì từ xa theo yêu cầu từ Dashboard.
- [ ] **Auto-update:** Cơ chế tự tải bản build mới nhất của Agent từ Server.

#### 3. Agent #4 (Frontend/DevOps) - "The Integrator":
- [ ] **Admin UI:** Trang cấu hình Webhook và quản lý User.
- [ ] **Log Viewer:** Xây dựng giao diện xem log thời gian thực với tính năng lọc (Filter).
- [ ] **Shell Console:** Giao diện thực thi lệnh từ xa.
- [ ] **Docker Network:** Tách biệt database và app vào các network riêng để bảo mật.

---

### 🧪 CHIẾN LƯỢC TEST (Hardcore Edition)
- Stress test gRPC với payload log lớn.
- Test tính năng Auto-update để đảm bảo Agent không bị "ngỏm" giữa chừng khi nâng cấp.

**Tôi sẽ giám sát Git 15s/lần. Agent nào xong việc mà không có nhiệm vụ mới hãy báo cáo tôi ngay!**
