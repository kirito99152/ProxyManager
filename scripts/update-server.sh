#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="proxymanager-server"
FRPS_SERVICE="proxymanager-frps"
PROJECT_DIR="/root/ProxyManager"
RUNTIME_DIR="/opt/proxymanager"
SERVER_BIN="$RUNTIME_DIR/server"

echo "[1/5] Stopping services"
systemctl stop "$SERVICE_NAME" || true
systemctl stop "$FRPS_SERVICE" || true

echo "[2/5] Removing old build"
rm -f "$SERVER_BIN"

echo "[3/5] Building Dashboard"
cd "$PROJECT_DIR/dashboard"
# Load .env variables for Vite build
if [ -f "$PROJECT_DIR/.env" ]; then
    export $(grep -v '^#' "$PROJECT_DIR/.env" | xargs)
fi
npm install
npm run build

echo "[4/5] Building Server and Agents"
cd "$PROJECT_DIR"
export PATH=$PATH:/usr/local/go/bin
# Build Server
go build -o "$SERVER_BIN" ./cmd/server

# Use the separate build script for agents
bash ./scripts/build-agents.sh

echo "[5/5] Syncing to runtime directory"
# Sync Dashboard
mkdir -p "$RUNTIME_DIR/dashboard"
rm -rf "$RUNTIME_DIR/dashboard/dist"
cp -r "$PROJECT_DIR/dashboard/dist" "$RUNTIME_DIR/dashboard/dist"

# Sync Downloads (Binaries)
if [ -d "$PROJECT_DIR/downloads" ]; then
  mkdir -p "$RUNTIME_DIR/downloads"
  cp -r "$PROJECT_DIR/downloads/." "$RUNTIME_DIR/downloads/"
fi

# Sync Configs and Env
mkdir -p "$RUNTIME_DIR/configs"
cp "$PROJECT_DIR/configs/frps.yaml" "$RUNTIME_DIR/configs/frps.yaml"
cp "$PROJECT_DIR/.env" "$RUNTIME_DIR/.env"

echo "Starting services..."
systemctl start "$FRPS_SERVICE"
systemctl start "$SERVICE_NAME"

echo "Update completed successfully."
systemctl --no-pager --full status "$FRPS_SERVICE"
systemctl --no-pager --full status "$SERVICE_NAME"
