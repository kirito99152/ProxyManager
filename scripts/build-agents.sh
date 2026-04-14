#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/root/ProxyManager"
DOWNLOADS_DIR="$PROJECT_DIR/downloads"

echo "Building Agent binaries for all platforms..."
mkdir -p "$DOWNLOADS_DIR"

echo "-> Linux AMD64"
GOOS=linux GOARCH=amd64 go build -o "$DOWNLOADS_DIR/agent-linux-amd64" ./cmd/agent
echo "-> Linux ARM64"
GOOS=linux GOARCH=arm64 go build -o "$DOWNLOADS_DIR/agent-linux-arm64" ./cmd/agent
echo "-> Windows AMD64"
GOOS=windows GOARCH=amd64 go build -o "$DOWNLOADS_DIR/agent-windows-amd64.exe" ./cmd/agent

echo "Build completed. Binaries are in $DOWNLOADS_DIR"
