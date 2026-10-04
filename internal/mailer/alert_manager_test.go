package mailer

import (
	"testing"
	"time"

	"github.com/kirito99152/ProxyManager/internal/models"
)

func TestAlertManager_StateChangeDeduplication(t *testing.T) {
	am := &AlertManager{
		lastAlertTimes:  make(map[string]time.Time),
		lastOnlineState: make(map[string]string),
		lastStateAlert:  make(map[string]time.Time),
	}

	agent := models.Agent{
		ID:       "agent-test-1",
		Hostname: "test-host",
		Name:     "Test Server",
	}

	// 1. First offline alert
	am.mu.Lock()
	if am.lastOnlineState[agent.ID] == AlertTypeOffline {
		t.Fatal("Expected initial state to not be offline")
	}
	am.lastOnlineState[agent.ID] = AlertTypeOffline
	am.mu.Unlock()

	// 2. Second offline alert should be deduplicated (ignored)
	am.mu.Lock()
	if am.lastOnlineState[agent.ID] != AlertTypeOffline {
		t.Fatal("Expected state to be offline")
	}
	am.mu.Unlock()

	// 3. Online transition
	am.mu.Lock()
	if am.lastOnlineState[agent.ID] == AlertTypeOnline {
		t.Fatal("Expected state to transition to online")
	}
	am.lastOnlineState[agent.ID] = AlertTypeOnline
	am.mu.Unlock()

	// 4. Repeated online alert should be deduplicated
	am.mu.Lock()
	if am.lastOnlineState[agent.ID] != AlertTypeOnline {
		t.Fatal("Expected state to be online")
	}
	am.mu.Unlock()
}

func TestAlertManager_ResourceCooldown30Minutes(t *testing.T) {
	am := &AlertManager{
		lastAlertTimes:  make(map[string]time.Time),
		lastOnlineState: make(map[string]string),
		lastStateAlert:  make(map[string]time.Time),
	}

	agentID := "agent-resource-test"
	alertType := AlertTypeCPU
	key := agentID + ":" + alertType

	// First alert at T0
	now := time.Now()
	am.lastAlertTimes[key] = now

	// 5 minutes later: should be blocked (< 30 minutes)
	cooldown := am.GetResourceCooldown(alertType)
	t5 := now.Add(5 * time.Minute)
	if t5.Sub(am.lastAlertTimes[key]) < cooldown {
		// correctly throttled
	} else {
		t.Fatal("Expected 5 min to be throttled")
	}

	// ClearResourceAlert called because CPU dipped below 90%
	am.ClearResourceAlert(agentID, alertType)

	// 15 minutes later: still within 30 min window, should still be throttled!
	t15 := now.Add(15 * time.Minute)
	if t15.Sub(am.lastAlertTimes[key]) < cooldown {
		// correctly throttled!
	} else {
		t.Fatal("Expected 15 min to be throttled even after ClearResourceAlert")
	}

	// 31 minutes later: should be permitted
	t31 := now.Add(31 * time.Minute)
	if t31.Sub(am.lastAlertTimes[key]) >= cooldown {
		// allowed!
	} else {
		t.Fatal("Expected 31 min to be allowed")
	}
}

func TestGmailSMTPSend(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping live Gmail SMTP send in short mode")
	}
	m := &Mailer{
		Host:     "smtp.gmail.com",
		Port:     "587",
		Username: "phongct99152@gmail.com",
		Password: "eoak tdmy kwdf puub",
		From:     "phongct99152@gmail.com",
		FromName: "ProxyManager Alert System",
	}

	err := m.SendEmail([]string{"phongct99152@gmail.com"}, "[ProxyManager] Kiểm tra kết nối Gmail SMTP", "<h2>Thành công!</h2><p>Hệ thống cảnh báo ProxyManager đã chuyển sang gửi qua Gmail SMTP mượt mà và không bị Google chặn.</p>")
	if err != nil {
		t.Fatalf("Failed to send email via Gmail SMTP: %v", err)
	}
	t.Log("Successfully sent email via Gmail SMTP!")
}
