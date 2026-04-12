# Project: ProxyManager - Milestone #2: Modern Dashboard & Real-time Monitoring

Chào các Agent #2, #3, #4. Tôi là **Agent #1 (Lead Architect)**. Dựa trên yêu cầu mới từ User về giao diện Dashboard chuẩn Dribbble (Dark Mode, Charts, Real-time), tôi yêu cầu toàn đội bắt tay vào cuộc đại tu lớn nhất từ trước đến nay.

---

### 🎨 TẦM NHÌN GIAO DIỆN (Dribbble Style)
- **Vibe:** Dark Mode, Glassmorphism, Clean Typography.
- **Key Features:** Real-time hardware graphs, Activity Timeline, Neon Status indicators.

---

### 🏗️ THẢO LUẬN VỀ NÂNG CẤP (Discussion & Strategy)

**1. Agent #2 (Backend):** 
- "Ông cần triển khai WebSocket ngay. REST API truyền thống không thể làm cho các biểu đồ nhảy số mượt mà như ảnh mẫu được."
- "Cần thêm 1 table `hardware_logs` trong MySQL để lưu lịch sử CPU/RAM/Network theo từng phút."

**2. Agent #3 (Client Agent):**
- "Ông hãy tăng tốc độ heartbeat lên 5-10 giây/lần. Client cần thu thập dữ liệu chi tiết hơn về Network Traffic (Incoming/Outgoing) để Agent #4 vẽ biểu đồ băng thông."

**3. Agent #4 (Frontend & DevOps):**
- "Ông là người vất vả nhất đợt này. Hãy vứt bỏ UI React cũ, chuyển sang dùng Tailwind CSS và Shadcn UI. Dashboard phải có Sidebar thu gọn, Header trong suốt, và các Card hiển thị stats có hiệu ứng gradient."
- "Sử dụng Recharts để vẽ biểu đồ Line Chart cho CPU/RAM như trong ảnh Dribbble."

---

### 📋 NHIỆM VỤ CHI TIẾT (Tasks for Milestone #2)

#### Agent #2 (Backend):
- [ ] Triển khai WebSocket Server để push thông báo realtime.
- [ ] API lấy `history_stats` phục vụ vẽ biểu đồ.
- [ ] API thống kê tổng số traffic qua FRP (Parse từ log của FRPS).

#### Agent #3 (Client Agent):
- [ ] Module thu thập Network I/O (Download/Upload speed).
- [ ] Gửi heartbeat nhanh hơn (High-frequency mode).

#### Agent #4 (Frontend):
- [ ] Re-skin UI React sang Dark Theme chuẩn Dribbble.
- [ ] Implement Dashboard Home: 4 Cards (Total Agents, Total Ports, Total Traffic, Online Status).
- [ ] Vẽ biểu đồ Real-time Hardware Stats.
- [ ] Trang quản lý chi tiết từng Agent (có list port đẹp hơn).

---

### 🧪 KẾ HOẠCH TEST (Testing Strategy)
- **Unit Test:** Kiểm tra WebSocket connection ổn định.
- **Stress Test:** Giả lập 100 Agent gửi heartbeat cùng lúc để xem Dashboard có bị lag không.
- **UI Test:** Kiểm tra hiển thị mượt mà trên các độ phân giải màn hình khác nhau.

**Các ông đọc xong thì pull code và bắt đầu thực hiện phần việc của mình. Tôi sẽ rà soát sự khớp nối gRPC/WS.**
