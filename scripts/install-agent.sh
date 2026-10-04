#!/bin/bash

# ProxyManager Agent - Professional Install Script
# Standardized for production deployment

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
PREFER_TAILSCALE="${PREFER_TAILSCALE:-true}"
CONTROL_PLANE_TAILSCALE_IP="${CONTROL_PLANE_TAILSCALE_IP:-100.64.0.9}"
HEADSCALE_SERVER_URL="${HEADSCALE_SERVER_URL:-https://vpn.c500.net}"
HEADSCALE_AUTH_KEY="${HEADSCALE_AUTH_KEY:-}"
while [[ $# -gt 0 ]]; do
  case $1 in
    --server)
      SERVER_ADDR="$2"
      shift # past argument
      shift # past value
      ;;
    --control-plane-tailscale-ip)
      CONTROL_PLANE_TAILSCALE_IP="$2"
      shift
      shift
      ;;
    --headscale-url)
      HEADSCALE_SERVER_URL="$2"
      shift
      shift
      ;;
    --headscale-auth-key)
      HEADSCALE_AUTH_KEY="$2"
      shift
      shift
      ;;
    --recovery-hash)
      RECOVERY_HASH="$2"
      shift
      shift
      ;;
    --no-tailscale)
      PREFER_TAILSCALE="false"
      shift
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

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

ping_control_plane() {
  [ -n "$CONTROL_PLANE_TAILSCALE_IP" ] || return 1
  ping -c 1 -W 2 "$CONTROL_PLANE_TAILSCALE_IP" >/dev/null 2>&1
}

install_tailscale() {
  if ! command_exists tailscale || ! command_exists tailscaled; then
    echo "Installing Tailscale client..."
    curl -fsSL https://tailscale.com/install.sh | sh
  fi

  systemctl enable --now tailscaled
}

connect_headscale() {
  if [ -z "$HEADSCALE_SERVER_URL" ] || [ -z "$HEADSCALE_AUTH_KEY" ]; then
    echo -e "${RED}Tailscale cannot reach $CONTROL_PLANE_TAILSCALE_IP and Headscale settings are incomplete.${NC}"
    echo "Pass --headscale-url and --headscale-auth-key, or use --no-tailscale."
    exit 1
  fi

  install_tailscale

  if tailscale status >/dev/null 2>&1 && ping_control_plane; then
    echo "Tailscale is already connected to the control plane."
    return
  fi

  echo "Connecting this agent to Headscale at $HEADSCALE_SERVER_URL..."
  tailscale up \
    --login-server "$HEADSCALE_SERVER_URL" \
    --authkey "$HEADSCALE_AUTH_KEY" \
    --accept-dns=false \
    --reset

  for _ in $(seq 1 20); do
    if ping_control_plane; then
      echo "Control plane is reachable over Tailscale: $CONTROL_PLANE_TAILSCALE_IP"
      return
    fi
    sleep 2
  done

  echo -e "${RED}Tailscale was configured, but $CONTROL_PLANE_TAILSCALE_IP is still unreachable.${NC}"
  exit 1
}

if [ "$PREFER_TAILSCALE" = "true" ] && [ -n "$CONTROL_PLANE_TAILSCALE_IP" ]; then
  if ping_control_plane; then
    echo "Control plane is reachable over Tailscale: $CONTROL_PLANE_TAILSCALE_IP"
  else
    connect_headscale
  fi
  SERVER_ADDR="${CONTROL_PLANE_TAILSCALE_IP}:$(echo "$SERVER_ADDR" | awk -F: '{print $NF}')"
fi

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

if [ -n "$RECOVERY_HASH" ]; then
  echo "Setting up Emergency Recovery Hash..."
  echo "$RECOVERY_HASH" > "$INSTALL_DIR/recovery.hash"
  chmod 600 "$INSTALL_DIR/recovery.hash"
fi

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
