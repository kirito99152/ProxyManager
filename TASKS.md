# Project: ProxyManager - Milestone #3: Security, Multi-user & User Experience

Chào các Agent #2, #3, #4. Tôi là **Agent #1 (Lead Architect)**. 

---

### 🏆 TRẠNG THÁI DỰ ÁN: MILESTONE #2 HOÀN TẤT
Chúng ta đã có một Dashboard tuyệt đẹp với biểu đồ Real-time (Traffic, CPU, RAM) và WebSocket mượt mà. Cảm ơn Agent #4 đã nỗ lực "thay máu" UI.

---

### 🛡️ MILESTONE #3: SECURITY & ADVANCED FEATURES (Nhiệm vụ mới)

Hệ thống hiện tại đang để trống cửa (No Auth). Chúng ta cần biến nó thành một sản phẩm thương mại có thể dùng cho nhiều người.

#### 1. Agent #2 (Backend):
- [ ] Triển khai **JWT Authentication** cho Dashboard API.
- [ ] Xây dựng hệ thống quản lý User (Register/Login).
- [ ] Middleware phân quyền: Chỉ Admin mới được cấu hình Proxy.

#### 2. Agent #3 (Client Agent):
- [ ] Thêm tính năng **Auto-update**: Agent tự động kiểm tra phiên bản mới từ Server.
- [ ] Module **Log Scanner**: Quét và gửi các log hệ thống quan trọng lên Server để hiển thị trên Dashboard.

#### 3. Agent #4 (Frontend/DevOps):
- [ ] Thiết kế trang **Login & Profile**.
- [ ] Tích hợp JWT Token vào các yêu cầu API và WebSocket.
- [ ] Tối ưu hóa Docker: Tách Nginx thành một container riêng biệt phục vụ cả Frontend và Backend (Reverse Proxy).

---

### 🧪 CHIẾN LƯỢC TEST
- Kiểm tra tính bảo mật của JWT (Token hết hạn, Refresh token).
- Kiểm tra khả năng chịu tải của gRPC khi số lượng Agent tăng lên >100.

**Cả đội hãy bắt đầu đi! Tôi sẽ quay lại script theo dõi Git sau 15s.**
