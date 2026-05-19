# ProxyManager - Ultimate Professional Guide

Chào mừng bạn đến với hệ thống quản lý Proxy tập trung chuyên nghiệp. Đây là phiên bản đã được tinh chỉnh tối ưu (Production-Ready) sau quá trình phát triển Hybrid giữa AI và Human Architect.

## 📦 1. Triển khai Server (Docker)

Sử dụng Docker Compose để khởi chạy toàn bộ hạ tầng với hệ thống mạng được phân tách bảo mật.

```bash
docker-compose -f deploy/docker/docker-compose.yml up -d --build
```

- **Dashboard:** `http://ip-cua-ban`
- **API Server:** `http://ip-cua-ban:8081`
- **FRPS:** Port 7000 (Tunnel), 7500 (Dashboard).

## 🛡️ 2. Bảo mật & Xác thực (JWT)

Truy cập Dashboard và đăng nhập bằng tài khoản mặc định:
- **User:** `admin`
- **Pass:** `admin123` (Đổi ngay trong mục **Profile**).

Hệ thống sử dụng JWT Token để bảo vệ mọi yêu cầu API và WebSocket. Nếu Token hết hạn, bạn sẽ tự động được điều hướng về trang Login.

## 📟 3. Điều khiển từ xa (Shell Console)

Bạn có thể thực thi lệnh trực tiếp trên các Agent thông qua Dashboard:
1. Vào mục **Terminal** ở Sidebar.
2. Chọn Agent mục tiêu từ danh sách.
3. Nhập lệnh (Ví dụ: `ls`, `df -h`, `netstat`) và nhấn Enter.
*Lưu ý: Chỉ những lệnh an toàn mới được phép thực thi.*

## 📜 4. Giám sát Log (Log Viewer)

Mục **Logs** cho phép xem luồng log theo thời gian thực từ toàn bộ Agent:
- Lọc theo **Severity** (Info, Warning, Error).
- Tìm kiếm theo nội dung log.
- Tự động cuộn tới dữ liệu mới nhất.

## ⚙️ 5. Cấu hình Webhook (Alerting)

Vào mục **Settings** để cấu hình thông báo tự động:
- **Telegram:** Nhập Bot Token và Chat ID.
- **Discord:** Nhập Webhook URL.
Hệ thống sẽ gửi cảnh báo khi Agent rớt mạng (Offline) hoặc có vấn đề về tài nguyên.

## 🚀 6. Cài đặt Agent mới

Chạy lệnh sau trên máy client để cài đặt tự động:
```bash
curl -sSL https://raw.githubusercontent.com/kirito99152/ProxyManager/main/scripts/install-agent.sh | sudo bash
```
Sau khi cài đặt, Agent sẽ tự khởi động cùng hệ thống qua **systemd**.

---
*Chúc bạn có trải nghiệm tuyệt vời với ProxyManager!*
