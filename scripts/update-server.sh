#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="proxymanager-server"
PROJECT_DIR="/root/ProxyManager"
RUNTIME_DIR="/opt/proxymanager"
SERVER_BIN="$RUNTIME_DIR/server"

echo "[1/4] Stopping service: $SERVICE_NAME"
systemctl stop "$SERVICE_NAME"

echo "[2/4] Removing old build"
rm -f "$SERVER_BIN"

echo "[3/4] Building new version"
cd "$PROJECT_DIR/dashboard"
npm run build

cd "$PROJECT_DIR"
go build -o "$SERVER_BIN" ./cmd/server

mkdir -p "$RUNTIME_DIR/dashboard"
rm -rf "$RUNTIME_DIR/dashboard/dist"
cp -r "$PROJECT_DIR/dashboard/dist" "$RUNTIME_DIR/dashboard/dist"

if [ -d "$PROJECT_DIR/downloads" ]; then
  mkdir -p "$RUNTIME_DIR/downloads"
  cp -r "$PROJECT_DIR/downloads/." "$RUNTIME_DIR/downloads/"
fi

echo "[4/4] Starting service: $SERVICE_NAME"
systemctl start "$SERVICE_NAME"

echo "Update completed."
systemctl --no-pager --full status "$SERVICE_NAME"
