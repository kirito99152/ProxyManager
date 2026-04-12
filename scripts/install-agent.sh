#!/bin/bash

# Quick Install Script for ProxyManager Agent
# Author: Agent #4 (DevOps)

set -e

# Configuration
FRP_VERSION="0.68.0"
AGENT_NAME="proxymanager-agent"
INSTALL_DIR="/opt/proxymanager"
SYSTEMD_DIR="/etc/systemd/system"

# Colors for output
RED='\033[0-1;31m'
GREEN='\033[0-1;32m'
NC='\033[0m'

echo -e "${GREEN}Starting ProxyManager Agent Installation...${NC}"

# 1. Prerequisites
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}This script must be run as root${NC}"
   exit 1
fi

mkdir -p $INSTALL_DIR

# 2. Download FRP v0.68.0
echo "Downloading FRP v0.68.0..."
TEMP_DIR=$(mktemp -d)
cd $TEMP_DIR
wget -q https://github.com/fatedier/frp/releases/download/v${FRP_VERSION}/frp_${FRP_VERSION}_linux_amd64.tar.gz
tar -xzf frp_${FRP_VERSION}_linux_amd64.tar.gz
cp frp_${FRP_VERSION}_linux_amd64/frpc $INSTALL_DIR/
rm -rf $TEMP_DIR

# 3. Download Agent (Placeholder - need URL from Agent #2/#3)
# For now, we assume the binary is already built and we just copy it if exists locally
# or we can add a placeholder curl command.
echo "Downloading ProxyManager Agent..."
# curl -L https://your-server.com/api/v1/download/agent -o $INSTALL_DIR/agent
# chmod +x $INSTALL_DIR/agent

# 4. Create Configuration files
cat <<EOF > $INSTALL_DIR/frpc.yaml
serverAddr: "YOUR_SERVER_IP"
serverPort: 7000
auth:
  method: token
  token: "YOUR_TOKEN"
EOF

# 5. Setup Systemd Service for Agent
cat <<EOF > $SYSTEMD_DIR/$AGENT_NAME.service
[Unit]
Description=ProxyManager Client Agent
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR
ExecStart=$INSTALL_DIR/agent -config $INSTALL_DIR/agent.yaml
Restart=always
RestartSec=5

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
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# 7. Reload and Start
systemctl daemon-reload
# systemctl enable $AGENT_NAME
# systemctl enable frpc

echo -e "${GREEN}Installation completed!${NC}"
echo "Please update $INSTALL_DIR/frpc.yaml and start the services:"
echo "systemctl start $AGENT_NAME"
echo "systemctl start frpc"
