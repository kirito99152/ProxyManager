package mailer

import (
	"fmt"
	"log"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/kirito99152/ProxyManager/internal/db"
	"github.com/kirito99152/ProxyManager/internal/models"
)

const (
	AlertTypeOffline = "offline"
	AlertTypeOnline  = "online"
	AlertTypeCPU     = "cpu_high"
	AlertTypeRAM     = "ram_high"
	AlertTypeDisk    = "disk_high"

	DefaultResourceCooldown = 30 * time.Minute
	DefaultStateCooldown    = 5 * time.Minute
)

type AlertManager struct {
	database        *db.DB
	mailer          *Mailer
	lastAlertTimes  map[string]time.Time // key: agentID:alertType -> thời điểm gửi cảnh báo tài nguyên gần nhất
	lastOnlineState map[string]string    // key: agentID -> AlertTypeOnline hoặc AlertTypeOffline
	lastStateAlert  map[string]time.Time // key: agentID:state -> thời điểm gửi email mở/tắt gần nhất
	mu              sync.RWMutex
}

func NewAlertManager(database *db.DB, mailer *Mailer) *AlertManager {
	am := &AlertManager{
		database:        database,
		mailer:          mailer,
		lastAlertTimes:  make(map[string]time.Time),
		lastOnlineState: make(map[string]string),
		lastStateAlert:  make(map[string]time.Time),
	}

	// Nạp trạng thái ban đầu của các Agent từ DB để tránh spam khi khởi động server
	if database != nil {
		var agents []models.Agent
		if err := database.Select(&agents, "SELECT id, status FROM agents"); err == nil {
			for _, a := range agents {
				if a.Status != "" {
					am.lastOnlineState[a.ID] = a.Status
				}
			}
		}
	}

	return am
}

// GetSettingInt fetches an integer configuration from settings table with default fallback.
func (am *AlertManager) GetSettingInt(key string, defaultVal int) int {
	if am.database == nil {
		return defaultVal
	}
	var val string
	err := am.database.Get(&val, "SELECT `value` FROM settings WHERE `key` = ?", key)
	if err != nil || strings.TrimSpace(val) == "" {
		return defaultVal
	}
	if n, err := strconv.Atoi(strings.TrimSpace(val)); err == nil && n > 0 {
		return n
	}
	return defaultVal
}

// GetSettingFloat fetches a float configuration from settings table with default fallback.
func (am *AlertManager) GetSettingFloat(key string, defaultVal float64) float64 {
	if am.database == nil {
		return defaultVal
	}
	var val string
	err := am.database.Get(&val, "SELECT `value` FROM settings WHERE `key` = ?", key)
	if err != nil || strings.TrimSpace(val) == "" {
		return defaultVal
	}
	if f, err := strconv.ParseFloat(strings.TrimSpace(val), 64); err == nil && f > 0 {
		return f
	}
	return defaultVal
}

// GetResourceCooldown returns the configured rate limit interval for each specific alert type.
func (am *AlertManager) GetResourceCooldown(alertType string) time.Duration {
	key := ""
	switch alertType {
	case AlertTypeCPU:
		key = "alert_interval_cpu_minutes"
	case AlertTypeRAM:
		key = "alert_interval_ram_minutes"
	case AlertTypeDisk:
		key = "alert_interval_disk_minutes"
	default:
		key = "alert_interval_default_minutes"
	}
	minutes := am.GetSettingInt(key, 30)
	return time.Duration(minutes) * time.Minute
}

// GetThreshold returns the alert threshold percentage for a resource.
func (am *AlertManager) GetThreshold(alertType string, defaultVal float64) float64 {
	key := ""
	switch alertType {
	case AlertTypeCPU:
		key = "alert_threshold_cpu"
	case AlertTypeRAM:
		key = "alert_threshold_ram"
	case AlertTypeDisk:
		key = "alert_threshold_disk"
	default:
		return defaultVal
	}
	return am.GetSettingFloat(key, defaultVal)
}

// GetStateCooldown returns the anti-flapping minimum duration between state change alerts.
func (am *AlertManager) GetStateCooldown() time.Duration {
	minutes := am.GetSettingInt("alert_state_cooldown_minutes", 5)
	return time.Duration(minutes) * time.Minute
}

// GetManagerEmails returns a list of verified emails assigned to manage the given agent.
func (am *AlertManager) GetManagerEmails(agentID string) ([]string, error) {
	query := `
		SELECT u.email 
		FROM users u 
		JOIN agent_managers am ON u.id = am.user_id 
		WHERE am.agent_id = ? 
		  AND u.is_verified = 1 
		  AND u.email IS NOT NULL 
		  AND u.email != ''
	`
	var emails []string
	err := am.database.Select(&emails, query, agentID)
	if err != nil {
		return nil, err
	}
	return emails, nil
}

// SendVerificationOTP sends an OTP code email to a user for email verification.
func (am *AlertManager) SendVerificationOTP(email string, username string, code string) error {
	subject, htmlBody := BuildVerificationEmail(username, code, 15)
	return am.mailer.SendEmail([]string{email}, subject, htmlBody)
}

// TriggerOfflineAlert sends an offline notification to all verified managers of the agent.
// Luôn đảm bảo: Chỉ gửi ĐÚNG 1 LẦN cho mỗi sự kiện tắt máy / mất kết nối (không spam).
func (am *AlertManager) TriggerOfflineAlert(agent models.Agent) {
	am.mu.Lock()
	// 1. Nếu máy đã được ghi nhận là offline thì tuyệt đối không gửi lại
	if am.lastOnlineState[agent.ID] == AlertTypeOffline {
		am.mu.Unlock()
		return
	}

	// 2. Chống spam khi mạng chập chờn (anti-flapping)
	stateCooldown := am.GetStateCooldown()
	stateKey := fmt.Sprintf("%s:%s", agent.ID, AlertTypeOffline)
	if lastSent, exists := am.lastStateAlert[stateKey]; exists && time.Since(lastSent) < stateCooldown {
		am.lastOnlineState[agent.ID] = AlertTypeOffline
		am.mu.Unlock()
		log.Printf("[AlertManager] Agent %s (%s) offline alert suppressed by state cooldown (%v)", agent.Hostname, agent.ID, stateCooldown)
		return
	}

	am.lastOnlineState[agent.ID] = AlertTypeOffline
	am.lastStateAlert[stateKey] = time.Now()
	am.mu.Unlock()

	go func() {
		emails, err := am.GetManagerEmails(agent.ID)
		if err != nil {
			log.Printf("[AlertManager] Failed to get manager emails for agent %s: %v", agent.ID, err)
			return
		}
		if len(emails) == 0 {
			log.Printf("[AlertManager] No verified manager emails for agent %s (%s). Skipping offline email.", agent.Hostname, agent.ID)
			return
		}

		subject, htmlBody := BuildOfflineAlertEmail(agent.Name, agent.Hostname, agent.PrivateIP, time.Now())
		if err := am.mailer.SendEmail(emails, subject, htmlBody); err != nil {
			log.Printf("[AlertManager] Error sending offline alert for %s: %v", agent.Hostname, err)
		}
	}()
}

// TriggerOnlineAlert sends a reconnected/online notification to all verified managers of the agent.
// Luôn đảm bảo: Chỉ gửi ĐÚNG 1 LẦN cho mỗi sự kiện mở lại sau khi bị tắt.
func (am *AlertManager) TriggerOnlineAlert(agent models.Agent) {
	am.mu.Lock()
	// 1. Nếu máy đã ở trạng thái online thì không gửi lại
	if am.lastOnlineState[agent.ID] == AlertTypeOnline {
		am.mu.Unlock()
		return
	}

	// 2. Chỉ gửi thông báo Online nếu trước đó máy ĐÃ TỪNG được ghi nhận là Offline!
	// (Tránh trường hợp server khởi động lại hoặc agent kết nối lần đầu gửi mail spam)
	if am.lastOnlineState[agent.ID] != AlertTypeOffline {
		am.lastOnlineState[agent.ID] = AlertTypeOnline
		am.mu.Unlock()
		return
	}

	// 3. Chống spam khi mạng chập chờn (anti-flapping)
	stateCooldown := am.GetStateCooldown()
	stateKey := fmt.Sprintf("%s:%s", agent.ID, AlertTypeOnline)
	if lastSent, exists := am.lastStateAlert[stateKey]; exists && time.Since(lastSent) < stateCooldown {
		am.lastOnlineState[agent.ID] = AlertTypeOnline
		am.mu.Unlock()
		log.Printf("[AlertManager] Agent %s (%s) online alert suppressed by state cooldown (%v)", agent.Hostname, agent.ID, stateCooldown)
		return
	}

	am.lastOnlineState[agent.ID] = AlertTypeOnline
	am.lastStateAlert[stateKey] = time.Now()
	am.mu.Unlock()

	go func() {
		emails, err := am.GetManagerEmails(agent.ID)
		if err != nil {
			log.Printf("[AlertManager] Failed to get manager emails for agent %s: %v", agent.ID, err)
			return
		}
		if len(emails) == 0 {
			log.Printf("[AlertManager] No verified manager emails for agent %s (%s). Skipping online email.", agent.Hostname, agent.ID)
			return
		}

		subject, htmlBody := BuildOnlineAlertEmail(agent.Name, agent.Hostname, agent.PrivateIP, time.Now())
		if err := am.mailer.SendEmail(emails, subject, htmlBody); err != nil {
			log.Printf("[AlertManager] Error sending online alert for %s: %v", agent.Hostname, err)
		}
	}()
}

// TriggerResourceAlert checks individual cooldown and sends high resource alert (CPU, RAM, Disk).
// Giới hạn thời gian gửi được cấu hình độc lập cho mỗi loại lỗi (mặc định 30 phút).
func (am *AlertManager) TriggerResourceAlert(agent models.Agent, alertType string, resourceName string, currentVal float64, thresholdVal float64, details string) {
	key := fmt.Sprintf("%s:%s", agent.ID, alertType)
	cooldown := am.GetResourceCooldown(alertType)
	
	am.mu.Lock()
	lastSent, exists := am.lastAlertTimes[key]
	if exists && time.Since(lastSent) < cooldown {
		am.mu.Unlock()
		return
	}
	am.lastAlertTimes[key] = time.Now()
	am.mu.Unlock()

	go func() {
		emails, err := am.GetManagerEmails(agent.ID)
		if err != nil {
			log.Printf("[AlertManager] Failed to get manager emails for agent %s: %v", agent.ID, err)
			return
		}
		if len(emails) == 0 {
			return
		}

		subject, htmlBody := BuildResourceAlertEmail(agent.Name, agent.Hostname, agent.PrivateIP, resourceName, currentVal, thresholdVal, details)
		if err := am.mailer.SendEmail(emails, subject, htmlBody); err != nil {
			log.Printf("[AlertManager] Error sending %s alert for %s: %v", alertType, agent.Hostname, err)
		}
	}()
}

// ClearResourceAlert ghi nhận khi tài nguyên hạ dưới ngưỡng.
// Giữ nguyên timestamp để tuân thủ thời gian giãn cách tối thiểu đã cấu hình.
func (am *AlertManager) ClearResourceAlert(agentID string, alertType string) {
	// Giữ nguyên timestamp để tuân thủ quy tắc giới hạn gửi mail theo từng lỗi
}
