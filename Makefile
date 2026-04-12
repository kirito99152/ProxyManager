# Makefile cho dự án ProxyManager

PROTO_DIR=proto
API_DIR=internal/api

# Lệnh cài đặt cơ bản cho môi trường Ubuntu/Linux
install-deps:
	@echo "Installing dependencies..."
	@apt update && apt install -y protobuf-compiler golang
	@go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
	@go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest

# Biên dịch file gRPC Protobuf
proto:
	@echo "Generating gRPC code from proto..."
	@protoc --go_out=. --go_opt=paths=source_relative \
	    --go-grpc_out=. --go-grpc_opt=paths=source_relative \
	    $(PROTO_DIR)/agent.proto

# Build Server/Dashboard
build-server:
	@echo "Building Server..."
	@go build -o bin/server cmd/server/main.go

# Build Client Agent
build-agent:
	@echo "Building Agent..."
	@go build -o bin/agent cmd/agent/main.go

# Chạy project ở chế độ dev
run-server:
	@go run cmd/server/main.go

# Tải FRP v0.68.0 (Linux x64)
download-frp:
	@echo "Downloading FRP v0.68.0..."
	@mkdir -p tmp && cd tmp && \
	wget https://github.com/fatedier/frp/releases/download/v0.68.0/frp_0.68.0_linux_amd64.tar.gz && \
	tar -xvzf frp_0.68.0_linux_amd64.tar.gz && \
	cp frp_0.68.0_linux_amd64/frps ../ && \
	cp frp_0.68.0_linux_amd64/frpc ../
