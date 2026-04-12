# Build stage
FROM golang:1.22-alpine AS builder

WORKDIR /app

# Install dependencies
COPY go.mod ./
# COPY go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build the server
RUN CGO_ENABLED=0 GOOS=linux go build -o /server cmd/server/main.go

# Final stage
FROM alpine:latest

WORKDIR /

COPY --from=builder /server /server
COPY configs/frps.yaml /configs/frps.yaml

# Install FRP (optional, or run as a separate container)
# For this setup, we will run FRPS in a separate container for better management

EXPOSE 8080 8443

ENTRYPOINT ["/server"]
