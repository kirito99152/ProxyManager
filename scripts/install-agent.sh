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

# Parse arguments
SERVER_ADDR=""
while [[ $# -gt 0 ]]; do
  case $1 in
    --server)
      SERVER_ADDR="$2"
      shift # past argument
      shift # past value
      ;;
    *)
      echo "Unknown argument: $1"
      exit 1
      ;;
  esac
done

if [ -z "$SERVER_ADDR" ]; then
    echo -e "${RED}Error: --server argument is required (e.g. --server 59.153.245.146:50051)${NC}"
    exit 1
fi

SERVER_IP=$(echo $SERVER_ADDR | cut -d':' -f1)
DASHBOARD_URL="http://$SERVER_IP:8000"

echo -e "${GREEN}Starting ProxyManager Agent Professional Installation...${NC}"
echo "Server Address: $SERVER_ADDR"

# 1. Prerequisites
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}This script must be run as root${NC}"
   exit 1
fi

mkdir -p $INSTALL_DIR

# 2. Firewall configuration (UFW/Iptables)
echo "Configuring firewall for FRP..."
if command -v ufw > /dev/null; then
    # Standard ports
    ufw allow 7000/tcp comment 'FRP Server'
    ufw allow 7500/tcp comment 'FRP Dashboard'
    ufw allow 80,443/tcp comment 'FRP Web'
    echo -e "${GREEN}UFW configured.${NC}"
fi

# 3. Download FRP v0.68.0 from local server
echo "Downloading FRP v0.68.0 from ProxyManager Server..."
wget -q "$DASHBOARD_URL/downloads/frpc-linux-amd64" -O $INSTALL_DIR/frpc
chmod +x $INSTALL_DIR/frpc

# 4. Agent Binary
echo "Setting up Agent binary..."
wget -q "$DASHBOARD_URL/downloads/agent-linux-amd64" -O $INSTALL_DIR/agent
chmod +x $INSTALL_DIR/agent

# 5. Setup Systemd Service for Agent (Auto-restart enabled)
cat <<EOF > $SYSTEMD_DIR/$AGENT_NAME.service
[Unit]
Description=ProxyManager Client Agent
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR
ExecStart=$INSTALL_DIR/agent -server $SERVER_ADDR
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

echo -e "${GREEN}Installation completed!${NC}"
echo "ProxyManager Agent is now managed by systemd."
echo "Use 'systemctl start $AGENT_NAME' to begin monitoring."
