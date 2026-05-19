#!/usr/bin/env bash
# Unit Test for Agent Automatic Upgrade
set -e

PROJECT_DIR="/root/ProxyManager"
DOWNLOADS_DIR="$PROJECT_DIR/downloads"
TEST_DIR="/tmp/agent_test"
SERVER_IP=$(grep SERVER_IP .env | cut -d'=' -f2)
GRPC_PORT=50051

echo "=== Starting Agent Upgrade Unit Test ==="

# 1. Prepare environment
mkdir -p "$TEST_DIR"
cd "$PROJECT_DIR"

# 2. Build Agent with version 1.1.1 (Fake "Latest")
echo "[1/4] Building fake 'Latest' Agent (v1.1.1)..."
sed -i 's/const Version = "1.1.0"/const Version = "1.1.1"/' cmd/agent/main.go
go build -o "/opt/proxymanager/downloads/agent-linux-amd64" ./cmd/agent

# 3. Build Agent with version 1.1.0 (Current)
echo "[2/4] Building 'Current' Agent (v1.1.0)..."
sed -i 's/const Version = "1.1.1"/const Version = "1.1.0"/' cmd/agent/main.go
go build -o "$TEST_DIR/agent" ./cmd/agent
cp /opt/proxymanager/downloads/frpc-linux-amd64 "$TEST_DIR/frpc" || cp downloads/frpc-linux-amd64 "$TEST_DIR/frpc"

# 4. Update Server to report 1.1.1 as latest
echo "[3/4] Updating Server to report v1.1.1..."
sed -i 's/const LatestAgentVersion = "1.1.0"/const LatestAgentVersion = "1.1.1"/' internal/api/handler.go
go build -o /opt/proxymanager/server cmd/server/main.go
systemctl restart proxymanager-server
echo "Waiting for server to be ready..."
sleep 5

# 5. Run the 'Current' agent and monitor
echo "[4/4] Running Agent v1.1.0 in test directory..."
cd "$TEST_DIR"
# Run agent in background and wait for it to upgrade
./agent -server "127.0.0.1:$GRPC_PORT" > agent_test.log 2>&1 &
AGENT_PID=$!

echo "Agent running (PID: $AGENT_PID). Waiting for auto-upgrade..."
sleep 15

# Check if agent restarted and version changed
if grep -q "New version detected: 1.1.1" agent_test.log; then
    echo "SUCCESS: Agent detected new version."
else
    echo "FAILURE: Agent did not detect new version. Log output:"
    cat agent_test.log
    kill $AGENT_PID || true
    exit 1
fi

# Check if the binary was updated
ACTUAL_VERSION=$($TEST_DIR/agent -version)
if [ "$ACTUAL_VERSION" == "v1.1.1" ]; then
    echo "SUCCESS: Agent binary updated to $ACTUAL_VERSION"
else
    echo "FAILURE: Agent binary version is $ACTUAL_VERSION, expected v1.1.1"
    exit 1
fi

echo "Cleaning up..."
# Reset Server and Agent code to 1.1.0 for production
cd "$PROJECT_DIR"
sed -i 's/const LatestAgentVersion = "1.1.1"/const LatestAgentVersion = "1.1.0"/' internal/api/handler.go
sed -i 's/const Version = "1.1.1"/const Version = "1.1.0"/' cmd/agent/main.go
go build -o /opt/proxymanager/server ./cmd/server
systemctl restart proxymanager-server

echo "=== Test Completed ==="
