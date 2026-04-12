# Stage 1: Build the Go Server
FROM golang:1.22-alpine AS go-builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /server cmd/server/main.go

# Stage 2: Build the Dashboard (Vite)
FROM node:20-alpine AS dashboard-builder
WORKDIR /app
COPY dashboard/package.json dashboard/package-lock.json ./
RUN npm install
COPY dashboard/ .
RUN npm run build

# Stage 3: Final Image (Pure API Server)
FROM alpine:latest
WORKDIR /
COPY --from=go-builder /server /server
COPY --from=dashboard-builder /app/dist /dashboard/dist
COPY configs/frps.yaml /configs/frps.yaml
EXPOSE 8080 8443
ENTRYPOINT ["/server"]
