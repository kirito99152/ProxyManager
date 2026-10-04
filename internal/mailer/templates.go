package mailer

import (
	"fmt"
	"time"
)

// BuildVerificationEmail creates subject and HTML content for email verification OTP.
func BuildVerificationEmail(username string, code string, expiresMinutes int) (string, string) {
	subject := fmt.Sprintf("🔐 [%s] Mã xác thực thành viên ProxyManager", code)
	
	html := fmt.Sprintf(`<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Xác thực Email</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0c0d12; color: #e2e8f0; margin: 0; padding: 24px; }
  .card { max-width: 540px; margin: 0 auto; background: #161822; border-radius: 18px; border: 1px solid rgba(255,255,255,0.08); padding: 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
  .header { text-align: center; margin-bottom: 24px; }
  .logo { font-size: 20px; font-weight: 800; color: #00f3ff; letter-spacing: 1px; }
  .title { font-size: 20px; font-weight: 700; color: #ffffff; margin-top: 12px; }
  .text { font-size: 14px; line-height: 1.6; color: #94a3b8; margin: 16px 0; }
  .otp-box { text-align: center; margin: 28px 0; background: rgba(0, 243, 255, 0.06); border: 1px dashed rgba(0, 243, 255, 0.3); border-radius: 12px; padding: 20px; }
  .otp-code { font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #00f3ff; font-family: monospace; }
  .badge { display: inline-block; font-size: 12px; font-weight: 600; padding: 4px 12px; border-radius: 9999px; background: rgba(255,255,255,0.05); color: #cbd5e1; margin-top: 8px; }
  .footer { margin-top: 32px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 16px; font-size: 12px; color: #64748b; text-align: center; }
</style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="logo">⚡ PROXYMANAGER C500</div>
      <div class="title">Xác Thực Địa Chỉ Email Thành Viên</div>
    </div>
    <div class="text">
      Xin chào <strong>%s</strong>,<br><br>
      Bạn nhận được email này vì địa chỉ email này được đăng ký làm người quản lý hệ thống máy chủ trong ProxyManager. Hãy sử dụng mã xác thực OTP dưới đây để hoàn tất đăng ký:
    </div>
    <div class="otp-box">
      <div class="otp-code">%s</div>
      <div class="badge">Hiệu lực trong %d phút</div>
    </div>
    <div class="text">
      Nhập mã OTP này trên giao diện Dashboard để kích hoạt trạng thái xác thực. Sau khi xác thực, bạn có thể được gán quản lý các máy chủ và nhận thông báo cảnh báo tự động.
    </div>
    <div class="footer">
      Email tự động được gửi từ máy chủ c500.net. Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua.
    </div>
  </div>
</body>
</html>`, username, code, expiresMinutes)

	return subject, html
}

// BuildOfflineAlertEmail creates subject and HTML content when an agent goes offline.
func BuildOfflineAlertEmail(agentName string, hostname string, privateIP string, lastSeen time.Time) (string, string) {
	timeStr := lastSeen.In(time.FixedZone("Asia/Ho_Chi_Minh", 7*3600)).Format("15:04:05 02/01/2006")
	subject := fmt.Sprintf("🔴 [CẢNH BÁO MẤT KẾT NỐI] Máy chủ %s đã Ngoại tuyến", hostname)
	
	displayName := agentName
	if displayName == "" {
		displayName = hostname
	}

	html := fmt.Sprintf(`<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Cảnh báo mất kết nối</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0c0d12; color: #e2e8f0; margin: 0; padding: 24px; }
  .card { max-width: 560px; margin: 0 auto; background: #161822; border-radius: 18px; border: 1px solid rgba(239, 68, 68, 0.3); padding: 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
  .status-badge { display: inline-flex; align-items: center; background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); padding: 6px 14px; border-radius: 9999px; font-weight: 700; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; }
  .title { font-size: 22px; font-weight: 800; color: #ffffff; margin: 16px 0 8px 0; }
  .info-table { width: 100%%; margin: 20px 0; border-collapse: separate; border-spacing: 0; background: rgba(255,255,255,0.02); border-radius: 12px; border: 1px solid rgba(255,255,255,0.06); overflow: hidden; }
  .info-table td { padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.04); font-size: 13px; }
  .info-table tr:last-child td { border-bottom: none; }
  .label { color: #94a3b8; font-weight: 500; width: 40%%; }
  .val { color: #f1f5f9; font-weight: 700; }
  .val-highlight { color: #f87171; font-weight: 800; }
  .note { background: rgba(239, 68, 68, 0.08); border-left: 4px solid #ef4444; padding: 12px 16px; border-radius: 6px; font-size: 13px; color: #fca5a5; line-height: 1.5; margin-top: 20px; }
  .footer { margin-top: 28px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 16px; font-size: 12px; color: #64748b; text-align: center; }
</style>
</head>
<body>
  <div class="card">
    <div class="status-badge">● MẤT KẾT NỐI (OFFLINE)</div>
    <div class="title">Máy chủ %s không phản hồi</div>
    <p style="color: #94a3b8; font-size: 14px; margin-top: 0;">Hệ thống giám sát ProxyManager không nhận được tín hiệu Heartbeat từ máy chủ trong hơn 30 giây.</p>
    
    <table class="info-table">
      <tr><td class="label">Tên máy hiển thị</td><td class="val">%s</td></tr>
      <tr><td class="label">Hostname</td><td class="val">%s</td></tr>
      <tr><td class="label">IP Nội bộ</td><td class="val">%s</td></tr>
      <tr><td class="label">Trạng thái</td><td class="val-highlight">NGNgoại tuyến (Offline)</td></tr>
      <tr><td class="label">Thời gian phát hiện</td><td class="val">%s</td></tr>
    </table>

    <div class="note">
      ⚠️ <strong>Lưu ý:</strong> Tất cả các kết nối tunnel/proxy trỏ tới máy chủ này có thể đang bị gián đoạn. Vui lòng kiểm tra nguồn điện, mạng hoặc tiến trình agent trên máy.
    </div>

    <div class="footer">
      Email thông báo tự động từ ProxyManager Monitor (c500.net).
    </div>
  </div>
</body>
</html>`, displayName, displayName, hostname, privateIP, timeStr)

	return subject, html
}

// BuildOnlineAlertEmail creates subject and HTML content when an agent reconnects.
func BuildOnlineAlertEmail(agentName string, hostname string, privateIP string, reconnectedAt time.Time) (string, string) {
	timeStr := reconnectedAt.In(time.FixedZone("Asia/Ho_Chi_Minh", 7*3600)).Format("15:04:05 02/01/2006")
	subject := fmt.Sprintf("🟢 [KẾT NỐI LẠI] Máy chủ %s đã Trực tuyến", hostname)

	displayName := agentName
	if displayName == "" {
		displayName = hostname
	}

	html := fmt.Sprintf(`<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Thông báo kết nối lại</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0c0d12; color: #e2e8f0; margin: 0; padding: 24px; }
  .card { max-width: 560px; margin: 0 auto; background: #161822; border-radius: 18px; border: 1px solid rgba(74, 222, 128, 0.3); padding: 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
  .status-badge { display: inline-flex; align-items: center; background: rgba(74, 222, 128, 0.15); color: #4ade80; border: 1px solid rgba(74, 222, 128, 0.3); padding: 6px 14px; border-radius: 9999px; font-weight: 700; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; }
  .title { font-size: 22px; font-weight: 800; color: #ffffff; margin: 16px 0 8px 0; }
  .info-table { width: 100%%; margin: 20px 0; border-collapse: separate; border-spacing: 0; background: rgba(255,255,255,0.02); border-radius: 12px; border: 1px solid rgba(255,255,255,0.06); overflow: hidden; }
  .info-table td { padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.04); font-size: 13px; }
  .info-table tr:last-child td { border-bottom: none; }
  .label { color: #94a3b8; font-weight: 500; width: 40%%; }
  .val { color: #f1f5f9; font-weight: 700; }
  .val-highlight { color: #4ade80; font-weight: 800; }
  .note { background: rgba(74, 222, 128, 0.08); border-left: 4px solid #4ade80; padding: 12px 16px; border-radius: 6px; font-size: 13px; color: #86efac; line-height: 1.5; margin-top: 20px; }
  .footer { margin-top: 28px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 16px; font-size: 12px; color: #64748b; text-align: center; }
</style>
</head>
<body>
  <div class="card">
    <div class="status-badge">● ĐÃ KẾT NỐI LẠI (ONLINE)</div>
    <div class="title">Máy chủ %s đã hoạt động trở lại</div>
    <p style="color: #94a3b8; font-size: 14px; margin-top: 0;">Máy chủ đã gửi tín hiệu Heartbeat và thiết lập lại liên lạc thành công với cụm điều khiển ProxyManager.</p>
    
    <table class="info-table">
      <tr><td class="label">Tên máy hiển thị</td><td class="val">%s</td></tr>
      <tr><td class="label">Hostname</td><td class="val">%s</td></tr>
      <tr><td class="label">IP Nội bộ</td><td class="val">%s</td></tr>
      <tr><td class="label">Trạng thái</td><td class="val-highlight">Trực tuyến (Online)</td></tr>
      <tr><td class="label">Thời gian kết nối lại</td><td class="val">%s</td></tr>
    </table>

    <div class="note">
      ✅ Các tunnel kết nối và dịch vụ mạng phụ thuộc đã được phục hồi bình thường.
    </div>

    <div class="footer">
      Email thông báo tự động từ ProxyManager Monitor (c500.net).
    </div>
  </div>
</body>
</html>`, displayName, displayName, hostname, privateIP, timeStr)

	return subject, html
}

// BuildResourceAlertEmail creates subject and HTML content for CPU, RAM, or Disk > 95% alerts.
func BuildResourceAlertEmail(agentName string, hostname string, privateIP string, resourceType string, currentVal float64, thresholdVal float64, details string) (string, string) {
	timeStr := time.Now().In(time.FixedZone("Asia/Ho_Chi_Minh", 7*3600)).Format("15:04:05 02/01/2006")
	subject := fmt.Sprintf("⚠️ [CẢNH BÁO TÀI NGUYÊN] %s máy chủ %s vượt ngưỡng %.1f%% (Hiện tại: %.1f%%)", resourceType, hostname, thresholdVal, currentVal)

	displayName := agentName
	if displayName == "" {
		displayName = hostname
	}

	html := fmt.Sprintf(`<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Cảnh báo tài nguyên vượt ngưỡng</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0c0d12; color: #e2e8f0; margin: 0; padding: 24px; }
  .card { max-width: 560px; margin: 0 auto; background: #161822; border-radius: 18px; border: 1px solid rgba(245, 158, 11, 0.4); padding: 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
  .status-badge { display: inline-flex; align-items: center; background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); padding: 6px 14px; border-radius: 9999px; font-weight: 700; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; }
  .title { font-size: 22px; font-weight: 800; color: #ffffff; margin: 16px 0 8px 0; }
  .progress-bg { background: rgba(255,255,255,0.08); border-radius: 9999px; height: 16px; margin: 20px 0 10px 0; overflow: hidden; }
  .progress-bar { background: linear-gradient(90deg, #f59e0b, #ef4444); height: 100%%; border-radius: 9999px; }
  .info-table { width: 100%%; margin: 20px 0; border-collapse: separate; border-spacing: 0; background: rgba(255,255,255,0.02); border-radius: 12px; border: 1px solid rgba(255,255,255,0.06); overflow: hidden; }
  .info-table td { padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.04); font-size: 13px; }
  .info-table tr:last-child td { border-bottom: none; }
  .label { color: #94a3b8; font-weight: 500; width: 40%%; }
  .val { color: #f1f5f9; font-weight: 700; }
  .val-danger { color: #f87171; font-weight: 900; font-size: 15px; }
  .note { background: rgba(245, 158, 11, 0.08); border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 6px; font-size: 13px; color: #fde68a; line-height: 1.5; margin-top: 20px; }
  .footer { margin-top: 28px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 16px; font-size: 12px; color: #64748b; text-align: center; }
</style>
</head>
<body>
  <div class="card">
    <div class="status-badge">⚠️ CẢNH BÁO TÀI NGUYÊN CAO (>95%%)</div>
    <div class="title">%s trên %s đang vượt ngưỡng</div>
    <p style="color: #94a3b8; font-size: 14px; margin-top: 0;">Mức độ sử dụng tài nguyên %s đã vượt ngưỡng an toàn quy định (95.0%%).</p>
    
    <div class="progress-bg">
      <div class="progress-bar" style="width: %.1f%%;"></div>
    </div>
    <div style="display: flex; justify-content: space-between; font-size: 12px; color: #94a3b8; margin-bottom: 20px;">
      <span>Ngưỡng cảnh báo: %.1f%%</span>
      <span style="color: #f87171; font-weight: bold;">Hiện tại: %.1f%%</span>
    </div>

    <table class="info-table">
      <tr><td class="label">Tên máy</td><td class="val">%s</td></tr>
      <tr><td class="label">Hostname</td><td class="val">%s</td></tr>
      <tr><td class="label">IP Nội bộ</td><td class="val">%s</td></tr>
      <tr><td class="label">Loại tài nguyên</td><td class="val">%s</td></tr>
      <tr><td class="label">Mức sử dụng</td><td class="val-danger">%.1f%%</td></tr>
      <tr><td class="label">Chi tiết số liệu</td><td class="val">%s</td></tr>
      <tr><td class="label">Thời điểm ghi nhận</td><td class="val">%s</td></tr>
    </table>

    <div class="note">
      🚨 <strong>Khuyến nghị:</strong> Vui lòng kiểm tra các tiến trình đang chiếm dụng tài nguyên quá mức trên máy chủ để tránh tình trạng máy bị treo (OOM / Freeze).
    </div>

    <div class="footer">
      Email thông báo tự động từ ProxyManager Resource Monitor (c500.net) · Giới hạn tối đa 30 phút gửi 1 lần cho cùng một tài nguyên.
    </div>
  </div>
</body>
</html>`, resourceType, displayName, resourceType, currentVal, thresholdVal, currentVal, displayName, hostname, privateIP, resourceType, currentVal, details, timeStr)

	return subject, html
}
