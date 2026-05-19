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

echo "Creating Windows ZIP package..."
TMP_DIR="/tmp/win_agent_build"
mkdir -p "$TMP_DIR"
cp "$DOWNLOADS_DIR/agent-windows-amd64.exe" "$TMP_DIR/agent.exe"
# Note: frpc.exe is already in downloads from setup.sh or manual download
if [ -f "$DOWNLOADS_DIR/frpc-windows-amd64.exe" ]; then
    cp "$DOWNLOADS_DIR/frpc-windows-amd64.exe" "$TMP_DIR/frpc.exe"
else
    echo "Warning: frpc-windows-amd64.exe not found, using placeholder if possible or skip"
fi

cat <<'EOF' > "$TMP_DIR/setup.ps1"
# ProxyManager Local Setup Script
# Run this script as Administrator from the extracted folder.

$InstallDir = "C:\ProxyManager"
$ServiceName = "ProxyManagerAgent"
# We'll use the domain name for the server address
$ServerAddr = "proxy.ovncr.vn:50051"

# 1. Check for Admin rights
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Error "Please run this script as Administrator!"
    exit
}

# 2. Create directory and copy files
if (!(Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir
}

Write-Host "Copying files to $InstallDir..."
Copy-Item -Path "agent.exe", "frpc.exe" -Destination $InstallDir -Force

# 3. Setup Service
if (Get-Service -Name $ServiceName -ErrorAction SilentlyContinue) {
    Write-Host "Stopping and removing existing service..."
    Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
    sc.exe delete $ServiceName
    Start-Sleep -s 2
}

Write-Host "Creating Windows Service..."
New-Service -Name $ServiceName `
            -BinaryPathName "`"$InstallDir\agent.exe`" -server $ServerAddr" `
            -DisplayName "ProxyManager Client Agent" `
            -StartupType Automatic `
            -Description "Monitors host and manages FRP tunnels"

Write-Host "Starting service..."
Start-Service -Name $ServiceName

Write-Host "-------------------------------------------"
Write-Host "Setup Completed Successfully!"
Write-Host "The agent is now running from $InstallDir"
Write-Host "-------------------------------------------"
pause
EOF

cd "$TMP_DIR" && zip -r "$DOWNLOADS_DIR/proxymanager-agent-windows.zip" . && cd -
rm -rf "$TMP_DIR"

echo "Build completed. Binaries are in $DOWNLOADS_DIR"
