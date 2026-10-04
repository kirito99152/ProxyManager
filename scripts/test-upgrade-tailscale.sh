#!/usr/bin/env bash
# Integration Test for Agent Automatic Upgrade on Remote Tailscale Machines
set -euo pipefail

PROJECT_DIR="/root/ProxyManager"
PRIVATE_KEY="/root/.ssh/vsieu"

# Ensure target IP is provided
if [ "$#" -lt 1 ]; then
    echo "Usage: $0 <tailscale_ip>"
    echo "Example: $0 100.115.92.5"
    exit 1
fi

TARGET_IP="$1"

echo "=== Starting Agent Remote Upgrade Test ==="
echo "Target Tailscale Host: root@$TARGET_IP"
echo "SSH Private Key: $PRIVATE_KEY"

# 1. Verify SSH Private Key exists
if [ ! -f "$PRIVATE_KEY" ]; then
    echo "ERROR: SSH Private Key not found at $PRIVATE_KEY"
    exit 1
fi

# Try SSH connection
echo "Checking SSH connection to remote host..."
if ! ssh -i "$PRIVATE_KEY" -o ConnectTimeout=5 -o StrictHostKeyChecking=no "root@$TARGET_IP" "uname -a" > /dev/null 2>&1; then
    echo "ERROR: Cannot connect to root@$TARGET_IP via SSH using $PRIVATE_KEY"
    exit 1
fi
echo "SSH Connection OK!"

# 2. Get the server IP from .env
SERVER_IP=$(grep SERVER_IP "$PROJECT_DIR/.env" | cut -d'=' -f2 | xargs)
if [ -z "$SERVER_IP" ]; then
    SERVER_IP="127.0.0.1"
fi
GRPC_PORT=50051
SERVER_ADDR="$SERVER_IP:$GRPC_PORT"
echo "Server address from .env: $SERVER_ADDR"

# Define cleanup handler
cleanup() {
    echo "=== Running Cleanup ==="
    echo "Restoring local code files to production version (v1.1.0)..."
    sed -i 's/const LatestAgentVersion = "1.1.1"/const LatestAgentVersion = "1.1.0"/' "$PROJECT_DIR/internal/api/handler.go"
    sed -i 's/const Version = "1.1.1"/const Version = "1.1.0"/' "$PROJECT_DIR/cmd/agent/main.go"
    
    echo "Rebuilding and restarting production server..."
    cd "$PROJECT_DIR"
    go build -o /opt/proxymanager/server cmd/server/main.go
    systemctl restart proxymanager-server
    
    echo "Restoring remote agent from backup if possible..."
    ssh -i "$PRIVATE_KEY" -o StrictHostKeyChecking=no "root@$TARGET_IP" "if [ -f /usr/local/bin/agent.bak ]; then mv /usr/local/bin/agent.bak /usr/local/bin/agent && systemctl restart agent.service || true; fi" || true
    
    echo "Cleanup complete."
}
trap cleanup EXIT

# 3. Build Fake "Latest" Agent (v1.1.1)
echo "[1/5] Building fake 'Latest' Agent (v1.1.1)..."
sed -i 's/const Version = "1.1.0"/const Version = "1.1.1"/' "$PROJECT_DIR/cmd/agent/main.go"
GOOS=linux GOARCH=amd64 go build -o "/opt/proxymanager/downloads/agent-linux-amd64" "$PROJECT_DIR/cmd/agent"
cp "/opt/proxymanager/downloads/agent-linux-amd64" "$PROJECT_DIR/downloads/agent-linux-amd64"

# 4. Build "Current" Agent (v1.1.0)
echo "[2/5] Building 'Current' Agent (v1.1.0)..."
sed -i 's/const Version = "1.1.1"/const Version = "1.1.0"/' "$PROJECT_DIR/cmd/agent/main.go"
GOOS=linux GOARCH=amd64 go build -o "/tmp/agent_v1.1.0" "$PROJECT_DIR/cmd/agent"

# 5. Update Server to report v1.1.1
echo "[3/5] Updating server configuration to advertise v1.1.1 as latest..."
sed -i 's/const LatestAgentVersion = "1.1.0"/const LatestAgentVersion = "1.1.1"/' "$PROJECT_DIR/internal/api/handler.go"
go build -o /opt/proxymanager/server "$PROJECT_DIR/cmd/server/main.go"
systemctl restart proxymanager-server
echo "Waiting for server to fully start..."
sleep 3

# 6. Install old agent (v1.1.0) on remote machine
echo "[4/5] Deploying Agent v1.1.0 to root@$TARGET_IP..."
# Backup existing binary
ssh -i "$PRIVATE_KEY" -o StrictHostKeyChecking=no "root@$TARGET_IP" "cp /usr/local/bin/agent /usr/local/bin/agent.bak || true"
# Copy new v1.1.0 binary
scp -i "$PRIVATE_KEY" -o StrictHostKeyChecking=no "/tmp/agent_v1.1.0" "root@$TARGET_IP:/usr/local/bin/agent"
# Restart agent service
ssh -i "$PRIVATE_KEY" -o StrictHostKeyChecking=no "root@$TARGET_IP" "systemctl restart agent.service || (nohup /usr/local/bin/agent -server '$SERVER_ADDR' > /var/log/agent_test.log 2>&1 &)"

echo "Agent deployed. Waiting 20 seconds for auto-upgrade to trigger and complete..."
sleep 20

# 7. Verify upgrade on remote host
echo "[5/5] Verifying remote agent version..."
REMOTE_VERSION=$(ssh -i "$PRIVATE_KEY" -o StrictHostKeyChecking=no "root@$TARGET_IP" "/usr/local/bin/agent -version" || echo "unknown")
echo "Remote Agent version reports: $REMOTE_VERSION"

if [ "$REMOTE_VERSION" == "v1.1.1" ]; then
    echo "=================================================="
    echo "🎉 SUCCESS: Remote Agent successfully upgraded to v1.1.1!"
    echo "=================================================="
else
    echo "=================================================="
    echo "❌ FAILURE: Remote Agent is still running version: $REMOTE_VERSION"
    echo "Let's grab the remote logs if possible..."
    ssh -i "$PRIVATE_KEY" -o StrictHostKeyChecking=no "root@$TARGET_IP" "journalctl -u agent.service -n 50 --no-pager || tail -n 50 /var/log/agent_test.log" || true
    echo "=================================================="
    exit 1
fi
