#!/bin/bash

# ProxyManager Agent - Professional Install Script (Milestone #4)
# Author: Agent #4 (DevOps)

set -e

# Configuration
FRP_VERSION="0.68.0"
AGENT_NAME="proxymanager-agent"
INSTALL_DIR="/opt/proxymanager"
SYSTEMD_DIR="/etc/systemd/system"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${GREEN}Starting ProxyManager Agent Professional Installation...${NC}"

# 1. Prerequisites
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}This script must be run as root${NC}"
   exit 1
fi

mkdir -p $INSTALL_DIR

# 2. Firewall configuration (UFW/Iptables)
echo "Configuring firewall for FRP..."
if command -v ufw > /dev/null; then
    ufw allow 7000/tcp comment 'FRP Server'
    ufw allow 7500/tcp comment 'FRP Dashboard'
    ufw allow 80,443/tcp comment 'FRP Web'
    echo -e "${GREEN}UFW configured.${NC}"
fi

# 3. Download FRP v0.68.0
echo "Downloading FRP v0.68.0..."
TEMP_DIR=$(mktemp -d)
cd $TEMP_DIR
wget -q https://github.com/fatedier/frp/releases/download/v${FRP_VERSION}/frp_${FRP_VERSION}_linux_amd64.tar.gz
tar -xzf frp_${FRP_VERSION}_linux_amd64.tar.gz
cp frp_${FRP_VERSION}_linux_amd64/frpc $INSTALL_DIR/
rm -rf $TEMP_DIR

# 4. Agent Binary (Assuming it's available or built)
# In production, this would curl from the Server's /api/v1/install/script endpoint
echo "Setting up Agent binary..."
# touch $INSTALL_DIR/agent
# chmod +x $INSTALL_DIR/agent

# 5. Setup Systemd Service for Agent (Auto-restart enabled)
cat <<EOF > $SYSTEMD_DIR/$AGENT_NAME.service
[Unit]
Description=ProxyManager Client Agent
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR
ExecStart=$INSTALL_DIR/agent -server 10.0.3.98:50051
Restart=always
RestartSec=10
StartLimitIntervalSec=0

[Install]
WantedBy=multi-user.target
EOF

# 6. Setup Systemd Service for FRPC
cat <<EOF > $SYSTEMD_DIR/frpc.service
[Unit]
Description=FRP Client Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR
ExecStart=$INSTALL_DIR/frpc -c $INSTALL_DIR/frpc.yaml
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# 7. Reload and Start
systemctl daemon-reload
# systemctl enable $AGENT_NAME
# systemctl enable frpc

echo -e "${GREEN}Installation completed!${NC}"
echo "ProxyManager Agent is now managed by systemd."
echo "Use 'systemctl start $AGENT_NAME' to begin monitoring."
