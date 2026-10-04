package mailer

import (
	"crypto/tls"
	"encoding/base64"
	"fmt"
	"log"
	"net"
	"net/smtp"
	"os"
	"strings"
	"time"
)

type Mailer struct {
	Host     string
	Port     string
	Username string
	Password string
	From     string
	FromName string
}

func NewMailer() *Mailer {
	host := os.Getenv("SMTP_HOST")
	if host == "" {
		host = "127.0.0.1"
	}
	port := os.Getenv("SMTP_PORT")
	if port == "" {
		port = "25"
	}
	user := os.Getenv("SMTP_USER")
	pass := os.Getenv("SMTP_PASS")
	from := os.Getenv("SMTP_FROM")
	if from == "" {
		if user != "" {
			from = user
		} else {
			from = "admin@c500.net"
		}
	}
	fromName := os.Getenv("SMTP_FROM_NAME")
	if fromName == "" {
		fromName = "ProxyManager Alert System"
	}

	return &Mailer{
		Host:     host,
		Port:     port,
		Username: user,
		Password: pass,
		From:     from,
		FromName: fromName,
	}
}

// SendEmail sends an HTML email to one or multiple recipients using the local mail server.
func (m *Mailer) SendEmail(to []string, subject string, htmlBody string) error {
	if len(to) == 0 {
		return nil
	}

	// Clean up email list
	var validRecipients []string
	for _, recipient := range to {
		trimmed := strings.TrimSpace(recipient)
		if trimmed != "" {
			validRecipients = append(validRecipients, trimmed)
		}
	}
	if len(validRecipients) == 0 {
		return nil
	}

	var lastErr error
	var sentCount int

	for _, recipient := range validRecipients {
		if err := m.sendSingle(recipient, subject, htmlBody); err != nil {
			log.Printf("[Mailer] Failed to send email to %s: %v", recipient, err)
			lastErr = err
		} else {
			sentCount++
			log.Printf("[Mailer] Successfully sent email to %s (Subject: %s)", recipient, subject)
		}
	}

	if sentCount > 0 {
		return nil
	}
	return lastErr
}

func (m *Mailer) sendSingle(recipient string, subject string, htmlBody string) error {
	addr := fmt.Sprintf("%s:%s", m.Host, m.Port)
	encodedSubject := fmt.Sprintf("=?UTF-8?B?%s?=", base64.StdEncoding.EncodeToString([]byte(subject)))
	encodedFromName := fmt.Sprintf("=?UTF-8?B?%s?=", base64.StdEncoding.EncodeToString([]byte(m.FromName)))
	dateHeader := time.Now().Format(time.RFC1123Z)
	msgID := fmt.Sprintf("<%d.%d@%s>", time.Now().UnixNano(), os.Getpid(), "gmail.com")

	header := make(map[string]string)
	header["From"] = fmt.Sprintf("%s <%s>", encodedFromName, m.From)
	header["To"] = recipient
	header["Subject"] = encodedSubject
	header["Date"] = dateHeader
	header["Message-ID"] = msgID
	header["MIME-Version"] = "1.0"
	header["Content-Type"] = "text/html; charset=UTF-8"
	header["Content-Transfer-Encoding"] = "base64"

	var message strings.Builder
	for k, v := range header {
		message.WriteString(fmt.Sprintf("%s: %s\r\n", k, v))
	}
	message.WriteString("\r\n")
	message.WriteString(base64.StdEncoding.EncodeToString([]byte(htmlBody)))

	// Connect with IPv4 preference ("tcp4") to avoid IPv6 Google blocks
	conn, err := net.DialTimeout("tcp4", addr, 10*time.Second)
	if err != nil {
		conn, err = net.DialTimeout("tcp", addr, 10*time.Second)
		if err != nil {
			return fmt.Errorf("dial failed: %w", err)
		}
	}
	defer conn.Close()

	client, err := smtp.NewClient(conn, m.Host)
	if err != nil {
		return fmt.Errorf("client creation failed: %w", err)
	}
	defer client.Quit()

	fqdn := os.Getenv("MAIL_FQDN")
	if fqdn == "" {
		fqdn = "mail.c500.net"
	}
	if err = client.Hello(fqdn); err != nil {
		log.Printf("[Mailer] HELO/EHLO warning: %v", err)
	}

	if ok, _ := client.Extension("STARTTLS"); ok {
		tlsConfig := &tls.Config{
			ServerName: m.Host,
		}
		if err = client.StartTLS(tlsConfig); err != nil {
			return fmt.Errorf("STARTTLS failed: %w", err)
		}
	}

	// Authenticate if SMTP credentials are provided (e.g. Gmail App Password)
	if m.Username != "" && m.Password != "" {
		auth := smtp.PlainAuth("", m.Username, m.Password, m.Host)
		if err = client.Auth(auth); err != nil {
			return fmt.Errorf("SMTP auth failed: %w", err)
		}
	}

	if err = client.Mail(m.From); err != nil {
		return fmt.Errorf("MAIL FROM failed: %w", err)
	}

	if err = client.Rcpt(recipient); err != nil {
		return fmt.Errorf("RCPT TO failed: %w", err)
	}

	w, err := client.Data()
	if err != nil {
		return fmt.Errorf("DATA command failed: %w", err)
	}

	_, err = w.Write([]byte(message.String()))
	if err != nil {
		return fmt.Errorf("write data failed: %w", err)
	}

	err = w.Close()
	if err != nil {
		return fmt.Errorf("close data failed: %w", err)
	}

	return nil
}
