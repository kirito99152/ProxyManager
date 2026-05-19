-- Database Schema for ProxyManager

CREATE DATABASE IF NOT EXISTS proxymanager CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE proxymanager;

-- Table for Client Agents
CREATE TABLE IF NOT EXISTS agents (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255),    -- Friendly name set by admin
    hostname VARCHAR(255) NOT NULL,
    os VARCHAR(50),
    private_ip VARCHAR(50),
    status ENUM('online', 'offline') DEFAULT 'offline',
    last_heartbeat TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    hardware_stats JSON, -- Stores CPU, RAM, Disk
    open_ports JSON,     -- Stores list of listening ports
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Table for Proxy Configurations (FRP)
CREATE TABLE IF NOT EXISTS proxies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    agent_id VARCHAR(36) NOT NULL,
    name VARCHAR(100) NOT NULL, -- Proxy name (e.g., ssh-server)
    proxy_type ENUM('http', 'https', 'tcp', 'udp') DEFAULT 'tcp',
    local_ip VARCHAR(50) NOT NULL DEFAULT '127.0.0.1',
    local_port INT NOT NULL,
    remote_port INT,           -- Port on Server (for TCP/UDP)
    custom_domain VARCHAR(255), -- Domain (for HTTP/HTTPS)
    status ENUM('active', 'inactive', 'online', 'offline') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Table for Activity Logs
CREATE TABLE IF NOT EXISTS activity_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    agent_id VARCHAR(36),
    action VARCHAR(255),
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Table for Hardware Logs (CPU/RAM/Network) for charting
CREATE TABLE IF NOT EXISTS hardware_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    agent_id VARCHAR(36) NOT NULL,
    cpu_usage DOUBLE,
    ram_used BIGINT,
    ram_total BIGINT,
    network_rx BIGINT, -- Bytes received
    network_tx BIGINT, -- Bytes transmitted
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Index for analytics optimization
CREATE INDEX idx_hardware_agent_id_created_at ON hardware_logs (agent_id, created_at);

-- Table for Users
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'user') DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Table for Collected Logs from Agents
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

-- Table for System Settings (Webhook, Alerts)
CREATE TABLE IF NOT EXISTS settings (
    `key` VARCHAR(100) PRIMARY KEY,
    `value` TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Default admin account (Password: admin123 - MUST change in production)
INSERT IGNORE INTO users (username, password_hash, role) VALUES ('admin', '$2a$10$58Hpa.34o.70uQyvgDRJ1uXSVo6LDVVl4JEcgs/Nh1zr5DHoAFRcG', 'admin');
