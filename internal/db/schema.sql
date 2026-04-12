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
