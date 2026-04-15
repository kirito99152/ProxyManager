#!/usr/bin/env bash
set -euo pipefail

echo "=== ProxyManager Setup Script ==="

# 0. Load environment variables if .env exists
if [ -f .env ]; then
    echo "Loading variables from .env..."
    export $(grep -v '^#' .env | xargs)
fi

DB_USER=${DB_USER:-root}
DB_PASSWORD=${DB_PASSWORD:-pm_password_2026}
DB_NAME=${DB_NAME:-proxymanager}

# 1. Update system and install dependencies
apt-get update
apt-get install -y wget curl tar build-essential mysql-server

# 2. Install Go 1.24.2
if ! go version | grep -q "go1.24.2"; then
    echo "Installing Go 1.24.2..."
    wget https://go.dev/dl/go1.24.2.linux-amd64.tar.gz
    rm -rf /usr/local/go
    tar -C /usr/local -xzf go1.24.2.linux-amd64.tar.gz
    rm go1.24.2.linux-amd64.tar.gz
    export PATH=$PATH:/usr/local/go/bin
    echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc
fi

# 3. Install Node.js (Latest LTS if not present)
if ! node -v >/dev/null 2>&1; then
    echo "Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi

# 4. Install FRPS v0.68.0
echo "Installing FRPS v0.68.0..."
mkdir -p /opt/frp
wget https://github.com/fatedier/frp/releases/download/v0.68.0/frp_0.68.0_linux_amd64.tar.gz
tar -xzf frp_0.68.0_linux_amd64.tar.gz
cp frp_0.68.0_linux_amd64/frps /opt/frp/frps
chmod +x /opt/frp/frps
rm -rf frp_0.68.0_linux_amd64*

# 5. Configure MySQL
echo "Configuring MySQL..."
systemctl start mysql
systemctl enable mysql
# Set root password if not already set or update it
mysql -e "CREATE DATABASE IF NOT EXISTS ${DB_NAME};" || true
mysql -e "ALTER USER '${DB_USER}'@'localhost' IDENTIFIED WITH mysql_native_password BY '${DB_PASSWORD}'; FLUSH PRIVILEGES;" || true
mysql -u ${DB_USER} -p${DB_PASSWORD} ${DB_NAME} < internal/db/schema.sql || echo "Schema already imported or error occurred"

# 6. Create Runtime Directory
mkdir -p /opt/proxymanager
mkdir -p /opt/proxymanager/dashboard
mkdir -p /opt/proxymanager/downloads

# 7. Setup Systemd Services
echo "Setting up Systemd services..."
cp deploy/systemd/server.service /etc/systemd/system/proxymanager-server.service
cp deploy/systemd/proxymanager-frps.service /etc/systemd/system/proxymanager-frps.service

# Update service paths if necessary (they seem correct based on our /opt plan)
sed -i 's|WorkingDirectory=/root/ProxyManager|WorkingDirectory=/opt/proxymanager|' /etc/systemd/system/proxymanager-frps.service
sed -i 's|ExecStart=/opt/frp/frps -c /root/ProxyManager/configs/frps.yaml|ExecStart=/opt/frp/frps -c /opt/proxymanager/configs/frps.yaml|' /etc/systemd/system/proxymanager-frps.service

# Ensure config directory exists in runtime
mkdir -p /opt/proxymanager/configs
cp configs/frps.yaml /opt/proxymanager/configs/frps.yaml

systemctl daemon-reload

echo "Setup completed. Now you can run ./scripts/update-server.sh"
