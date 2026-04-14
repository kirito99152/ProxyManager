#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="proxymanager-server"
PROJECT_DIR="/root/ProxyManager"
RUNTIME_DIR="/opt/proxymanager"
SERVER_BIN="$RUNTIME_DIR/server"

echo "[1/5] Stopping service: $SERVICE_NAME"
systemctl stop "$SERVICE_NAME"

echo "[2/5] Removing old build"
rm -f "$SERVER_BIN"

echo "[3/5] Building Dashboard"
cd "$PROJECT_DIR/dashboard"
npm run build

echo "[4/5] Building Server and Agents"
cd "$PROJECT_DIR"
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

echo "Starting service: $SERVICE_NAME"
systemctl start "$SERVICE_NAME"

echo "Update completed successfully."
systemctl --no-pager --full status "$SERVICE_NAME"
