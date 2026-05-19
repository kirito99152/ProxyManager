# Tài Liệu Kỹ Thuật: Hệ Thống Quản Lý Proxy Tập Trung (ProxyManager)

## 1. Chức năng và Mục đích Cốt lõi (Tầm nhìn Kiến trúc)

ProxyManager không đơn thuần chỉ là một giao diện đồ họa (Dashboard) để cấu hình Proxy. Nó được thiết kế với mục đích cốt lõi là tạo ra một **Control Plane kiến trúc Gateway bảo mật**, biến một máy chủ Cloud VPS thành "Lá chắn thép" đứng mũi chịu sào, bảo vệ toàn bộ cụm máy chủ và thiết bị IoT nằm sau NAT hoặc trong mạng Local.

### Các giá trị cốt lõi:

*   **Bảo vệ các máy chủ nội bộ (Invisible Backend):** Các máy chủ thực thi ứng dụng thực tế (Web Server, Database, Service) nằm phía sau NAT hoàn toàn không cần mở bất kỳ cổng (Inbound Port) nào ra Internet. Do đó, chúng hoàn toàn vô hình trước các công cụ dò quét (Port Scanner) và miễn nhiễm với các cuộc tấn công khai thác lỗ hổng trực tiếp từ bên ngoài mạng.
*   **Tập trung hóa Tường lửa (Centralized Firewall):** Thay vì phải phân tán nguồn lực cấu hình bảo mật trên hàng chục, hàng trăm máy chủ con, quản trị viên chỉ cần dồn toàn bộ nguồn lực để thiết lập lớp bảo mật cực mạnh tại máy chủ VPS trung tâm (Gateway). Tại đây, bạn có thể triển khai iptables, UFW, WAF, Fail2ban, Rate Limiting, hay cấu hình SSL/TLS (Wildcard Domain) một cách đồng nhất để chống lại DDoS hoặc tấn công Web.
*   **Vượt rào NAT & Quản lý linh hoạt:** Hệ thống giải quyết triệt để bài toán đưa các dịch vụ nằm trong mạng nội bộ (không có IP Public) ra ngoài Internet một cách an toàn thông qua các giao thức TCP, UDP, HTTP, HTTPS. Admin có thể dễ dàng map một Domain hoặc Port trên VPS về một máy cụ thể trong mạng nội bộ chỉ bằng vài cú click chuột.
*   **Giám sát & Telemetry Toàn diện:** Agent đóng vai trò như một thám tử nội bộ. Nó liên tục giám sát phần cứng (CPU, RAM, Network), quét các Port đang lắng nghe, theo dõi trạng thái các systemd service và truyền log trực tiếp (Stream Log) về trung tâm. Admin có thể nắm bắt sức khỏe toàn bộ hệ thống mà không cần SSH vào từng máy riêng lẻ.

---

## 2. Cơ chế Vận hành (Architecture & Operations)

Hệ thống hoạt động dựa trên mô hình **Client-Server** kết nối qua kênh gRPC (mã hóa và tốc độ cao), kết hợp với sức mạnh tạo đường hầm (Tunnel) của `FRP`.

Hệ thống chia làm 3 thành phần chính:

### A. Server Node (Control Plane / Gateway VPS)
Đây là "bộ não" điều phối và là cửa ngõ giao tiếp với Internet. Nó chạy các dịch vụ:
*   **ProxyManager Server (Go):** Lắng nghe các kết nối gRPC từ các Agent, cung cấp RESTful API & WebSockets cho Dashboard. Nó tương tác với MySQL để lưu trữ thông tin cấu hình, trạng thái agent, logs và metrics.
*   **FRP Server (frps):** Lắng nghe và duy trì các tunnel từ các nhánh mạng gửi tới. Nó cũng đóng vai trò router định tuyến traffic từ người dùng Internet đẩy vào đúng tunnel của máy chủ nội bộ.
*   **MySQL Database:** Lưu trữ toàn bộ metadata của hệ thống.

### B. Agent Node (Máy chủ bị ẩn sau NAT)
Đây là các máy chủ cần được bảo vệ và cần đưa dịch vụ ra ngoài. Nó chạy:
*   **ProxyManager Agent (Go):** Ứng dụng chạy ngầm quản lý tiến trình của máy trạm.
*   **FRP Client (frpc):** Tiến trình tạo tunnel kết nối ngược ra VPS.

**Luồng hoạt động (Workflow):**
1.  **Khởi tạo kết nối (Outbound Only):** Khi Agent được cài đặt, nó sẽ chủ động mở một kết nối (Outbound) tới Server thông qua gRPC (mặc định Port 50051). Vì là kết nối hướng ra (Outbound), nó dễ dàng xuyên qua mọi tường lửa và Router NAT của mạng nội bộ mà không cần cấu hình Forwarding.
2.  **Đăng ký & Cấp phép:** Agent gửi thông tin phần cứng, OS, IP nội bộ lên Server. Server ghi nhận, tạo ra một `Agent ID` duy nhất, đồng thời sinh ra cấu hình `frpc.yaml` chứa Token bảo mật để trả về cho Agent.
3.  **Thiết lập Đường hầm (Tunneling):** Agent dùng cấu hình được cấp phát tự động khởi chạy tiến trình `frpc`, thiết lập thành công đường hầm proxy tới `frps` trên VPS trung tâm.
4.  **Giữ nhịp tim (Heartbeat & Telemetry):** Xuyên suốt quá trình chạy, Agent sử dụng gRPC để liên tục gửi các báo cáo:
    *   Tình trạng tiêu thụ CPU, RAM, Disk, Network.
    *   Danh sách các Port đang mở (`open_ports`) và dịch vụ (`services`).
    *   Real-time Log stream.
5.  **Điều khiển từ xa (Command Stream):** Khi Admin dùng Dashboard cấu hình một Proxy Rule mới, Server sẽ lưu vào DB, sau đó cập nhật cấu hình cho `frps` hoặc gửi gRPC command xuống cho Agent để yêu cầu Agent/frpc cấu hình lại một cách tức thì và hoàn toàn trong suốt.

## 3. Quá trình phát triển Hybrid (AI & Human)

ProxyManager không chỉ là một sản phẩm của lập trình truyền thống mà là kết quả của mô hình **AI-Assisted Engineering**:

1.  **AI Orchestration:** Sử dụng mô hình nhiều Agent (Multi-agent) để song song hóa việc phát triển các module độc lập.
2.  **Human Finalization:** Nhà phát triển đóng vai trò "Tổng công trình sư", thực hiện việc tích hợp (Integration) và kiểm thử thực tế (Production Testing). Sự can thiệp thủ công này đảm bảo hệ thống vượt qua được các giới hạn về độ ổn định mà AI đơn thuần chưa thể đạt tới.
3.  **Continuous Improvement:** Hệ thống được duy trì và cập nhật thông qua sự hỗ trợ liên tục từ Gemini CLI, giúp giảm thiểu nỗ lực bảo trì và tăng tốc độ triển khai tính năng mới.

