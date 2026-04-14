-- Database Schema cho ProxyManager
-- Sẽ được Agent #2 sử dụng để setup MySQL

CREATE DATABASE IF NOT EXISTS proxymanager CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE proxymanager;

-- Bảng quản lý các Client Agent
CREATE TABLE IF NOT EXISTS agents (
    id VARCHAR(36) PRIMARY KEY,
    hostname VARCHAR(255) NOT NULL,
    os VARCHAR(50),
    private_ip VARCHAR(50),
    status ENUM('online', 'offline') DEFAULT 'offline',
    last_heartbeat TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    hardware_stats JSON, -- Lưu CPU, RAM, Disk
    open_ports JSON,     -- Lưu danh sách port đang listen
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Bảng quản lý cấu hình Proxy (FRP)
CREATE TABLE IF NOT EXISTS proxies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    agent_id VARCHAR(36) NOT NULL,
    name VARCHAR(100) NOT NULL, -- Tên proxy (ví dụ: ssh-server)
    proxy_type ENUM('http', 'https', 'tcp', 'udp') DEFAULT 'tcp',
    local_port INT NOT NULL,
    remote_port INT,           -- Port trên Server (đối với TCP/UDP)
    custom_domain VARCHAR(255), -- Domain (đối với HTTP/HTTPS)
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Bảng lưu log hoạt động
CREATE TABLE IF NOT EXISTS activity_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    agent_id VARCHAR(36),
    action VARCHAR(255),
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Bảng lưu lịch sử hardware stats (CPU/RAM/Network) cho vẽ biểu đồ
CREATE TABLE IF NOT EXISTS hardware_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    agent_id VARCHAR(36) NOT NULL,
    cpu_usage DOUBLE,
    ram_used BIGINT,
    ram_total BIGINT,
    network_rx BIGINT, -- Byte received
    network_tx BIGINT, -- Byte transmitted
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Tối ưu hóa cho Milestone #4
CREATE INDEX idx_hardware_agent_id_created_at ON hardware_logs (agent_id, created_at);

-- Bảng quản lý người dùng (Milestone 3)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'user') DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Bảng thu thập log từ Agent (Milestone 3)
CREATE TABLE IF NOT EXISTS agent_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    agent_id VARCHAR(36) NOT NULL,
    log_level VARCHAR(20),
    message TEXT,
    timestamp TIMESTAMP,
    source VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
    INDEX idx_agent_id_timestamp (agent_id, timestamp)
) ENGINE=InnoDB;

-- Bảng cấu hình hệ thống (Webhook, Alerts - Milestone 3)
CREATE TABLE IF NOT EXISTS settings (
    `key` VARCHAR(100) PRIMARY KEY,
    `value` TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Tài khoản admin mặc định (Mật khẩu: admin123 - Cần thay đổi khi chạy thực tế)
INSERT IGNORE INTO users (username, password_hash, role) VALUES ('admin', '$2a$10$58Hpa.34o.70uQyvgDRJ1uXSVo6LDVVl4JEcgs/Nh1zr5DHoAFRcG', 'admin');
