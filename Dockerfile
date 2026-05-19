# Stage 1: Build Frontend (Dashboard)
FROM node:24-alpine AS dashboard-builder
WORKDIR /app/dashboard
COPY dashboard/package*.json ./
RUN npm install
COPY dashboard/ .
RUN npm run build

# Stage 2: Build Go Server and Agents
FROM golang:1.24-alpine AS server-builder
RUN apk add --no-cache bash
WORKDIR /app
COPY go.mod ./
# Skip go.sum if not present (from previous read, I didn't see it)
# COPY go.mod go.sum ./
RUN go mod download
COPY . .
# Copy built dashboard from Stage 1
COPY --from=dashboard-builder /app/dashboard/dist /app/dashboard/dist

# Build server
RUN go build -o /app/server ./cmd/server

# Build agent binaries for downloads
RUN mkdir -p /app/downloads && \
    GOOS=linux GOARCH=amd64 go build -o /app/downloads/agent-linux-amd64 ./cmd/agent && \
    GOOS=linux GOARCH=arm64 go build -o /app/downloads/agent-linux-arm64 ./cmd/agent && \
    GOOS=windows GOARCH=amd64 go build -o /app/downloads/agent-windows-amd64.exe ./cmd/agent

# Stage 3: Final Production Image
FROM alpine:latest
RUN apk add --no-cache ca-certificates tzdata bash
WORKDIR /opt/proxymanager

# Copy binaries and assets from Stage 2
COPY --from=server-builder /app/server ./server
COPY --from=server-builder /app/dashboard/dist ./dashboard/dist
COPY --from=server-builder /app/downloads ./downloads

# Expose ports
EXPOSE 8000 50051

# Default command
CMD ["./server"]
