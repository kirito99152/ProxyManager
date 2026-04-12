# ProxyManager - Ultimate Professional Guide

Chào mừng bạn đến với hệ thống quản lý Proxy tập trung chuyên nghiệp. Dưới đây là hướng dẫn toàn diện để vận hành hệ thống Milestone #4.

## 📦 1. Triển khai Server (Docker)

Sử dụng Docker Compose để khởi chạy toàn bộ hạ tầng với hệ thống mạng được phân tách bảo mật.

```bash
docker-compose -f deploy/docker/docker-compose.yml up -d --build
```

- **Dashboard:** `http://your-server-ip`
- **API Server:** `http://your-server-ip:8081`
- **FRPS:** Port 7000 (Tunnel), 7500 (Dashboard).

## 🛡️ 2. Bảo mật & Xác thực (JWT)

Truy cập Dashboard và đăng nhập bằng tài khoản mặc định:
- **User:** `admin`
- **Pass:** `admin` (Hãy đổi ngay trong phần **Profile**).

Hệ thống sử dụng JWT Token để bảo vệ tất cả các yêu cầu API và kết nối WebSocket. Nếu Token hết hạn, bạn sẽ tự động được chuyển hướng về trang Login.

## 📟 3. Sử dụng Terminal từ xa (Shell Console)

Bạn có thể thực thi lệnh trực tiếp trên các Agent thông qua Dashboard:
1. Vào mục **Terminal** trong Sidebar.
2. Chọn Agent mục tiêu từ danh sách.
3. Nhập lệnh (ví dụ: `ls`, `df -h`, `netstat`) và nhấn Enter.
*Lưu ý: Chỉ các lệnh an toàn mới được phép thực thi.*

## 📜 4. Theo dõi Log (Log Viewer)

Mục **Logs** cho phép bạn xem dòng log thời gian thực từ tất cả các Agent:
- Lọc theo **Severity** (Info, Warning, Error).
- Tìm kiếm theo nội dung log.
- Tự động cuộn theo dữ liệu mới nhất.

## ⚙️ 5. Cấu hình Webhook (Alerting)

Vào mục **Settings** để cấu hình thông báo tự động:
- **Telegram:** Nhập Bot Token và Chat ID.
- **Discord:** Nhập Webhook URL.
Hệ thống sẽ gửi cảnh báo khi Agent offline hoặc có sự cố tài nguyên.

## 🚀 6. Cài đặt Agent mới

Chạy lệnh sau trên node khách để cài đặt tự động:
```bash
curl -sSL https://raw.githubusercontent.com/kirito99152/ProxyManager/main/scripts/install-agent.sh | sudo bash
```
Sau khi cài đặt, Agent sẽ tự khởi động cùng hệ thống qua **systemd**.

---
*Chúc bạn có trải nghiệm tuyệt vời với ProxyManager!*
