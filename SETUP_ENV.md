# Huong Dan Setup Moi Truong ProxyManager

Tai lieu nay huong dan tao va cau hinh file moi truong de chay duoc project ProxyManager.

## Cac File Can Biet

- `.env.example`: file mau, duoc commit len Git.
- `.env`: file moi truong khi chay local tai thu muc goc project.
- `/opt/proxymanager/.env`: file moi truong khi chay production bang systemd.
- `dashboard/.env.local`: file tuy chon cho frontend Vite neu build dashboard rieng.

Khong commit file `.env` that vi trong do co mat khau va token. Chi commit `.env.example`.

## 1. Tao File Moi Truong

Chay local:

```bash
cp .env.example .env
```

Chay production bang systemd:

```bash
sudo mkdir -p /opt/proxymanager
sudo cp .env.example /opt/proxymanager/.env
sudo nano /opt/proxymanager/.env
```

Neu chi build/chay frontend rieng va muon doi wildcard domain:

```bash
echo 'VITE_WILDCARD_DOMAIN=v1.example.com' > dashboard/.env.local
```

## 2. Bien Bat Buoc Can Sua

Mo `.env` hoac `/opt/proxymanager/.env` va sua cac bien chinh:

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=change_me_mysql_password
DB_NAME=proxymanager

SERVER_IP=203.0.113.10
PUBLIC_URL=https://proxy.example.com
DASHBOARD_PORT=8000
GRPC_PORT=50051

AGENT_AUTH_TOKEN=change_me_agent_runtime_token
JWT_SECRET=change_me_long_random_jwt_secret

FRPS_BIND_PORT=7001
FRPS_VHOST_HTTP_PORT=18081
FRPS_DASHBOARD_PORT=7501
FRPS_TOKEN=change_me_frps_token
```

Ghi chu:

- `SERVER_IP`: IP/domain ma agent co the ket noi toi. Bien nay duoc gui ve agent trong cau hinh FRP.
- `PUBLIC_URL`: URL dashboard public, dung cho link download/upgrade agent, vi du `https://proxy.example.com`.
- `AGENT_AUTH_TOKEN`: token runtime de agent xac thuc voi gRPC server. Link cai agent co token 1 lan rieng, nhung script sinh ra van gan token runtime nay vao service agent.
- `JWT_SECRET`: khoa ky JWT cho phien dang nhap dashboard. Nen dat chuoi dai va ngau nhien.
- `FRPS_TOKEN`: token FRP, phai trung voi token trong `configs/frps.yaml`.

Tao secret manh:

```bash
openssl rand -hex 32
```

## 3. Cai Database

Tao database va import schema:

```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS proxymanager CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p proxymanager < internal/db/schema.sql
```

Schema se tao tai khoan admin mac dinh. Sau khi dang nhap lan dau nen doi mat khau.

## 4. Cau Hinh FRPS

Sua `configs/frps.yaml` de khop voi `.env`:

```yaml
bindPort: 7001
vhostHTTPPort: 18081

auth:
  method: "token"
  token: "change_me_frps_token"
```

Neu dung `setup.sh`, file nay se duoc copy sang:

```text
/opt/proxymanager/configs/frps.yaml
```

## 5. Chay Local

Backend:

```bash
go mod tidy
go run ./cmd/server
```

Dashboard:

```bash
cd dashboard
npm install
npm run dev
```

Build dashboard production:

```bash
cd dashboard
npm install
npm run build
```

## 6. Chay Bang Systemd

Sau khi da dat `/opt/proxymanager/.env`:

```bash
sudo systemctl daemon-reload
sudo systemctl restart proxymanager-server
sudo systemctl restart proxymanager-frps
sudo systemctl status proxymanager-server --no-pager --full
```

Xem log:

```bash
journalctl -u proxymanager-server -f
journalctl -u proxymanager-frps -f
```

## 7. Chay Bang Docker Compose

Docker Compose doc file `.env` o thu muc goc project:

```bash
cp .env.example .env
docker compose up -d --build
```

Trong Docker, `DB_HOST` cua container server da duoc set thanh `mysql` trong `docker-compose.yml`.

## 8. Luong Cai Agent

Khong nen cai agent bang URL tinh public. Hay dung command duoc sinh tu dashboard.

Quy trinh:

1. Dang nhap dashboard.
2. Vao trang Agents.
3. Bam `Tao & sao chep`.
4. Dan command vao server can cai agent trong vong 5 phut.

Moi link cai dat agent co token 1 lan:

- hieu luc 5 phut;
- bi consume ngay khi script duoc tai ve;
- gan voi OS da chon, vi du Linux hoac Windows.

## 9. Nginx Va Chung Chi SSL

Bien tuy chon cho tinh nang tao reverse proxy/domain:

```env
PUBLIC_IP=203.0.113.10
NGINX_PROXY_CONF_DIR=/etc/nginx/proxymanager.d
CERTBOT_EMAIL=admin@example.com
VITE_WILDCARD_DOMAIN=v1.example.com
```

Can dam bao Nginx include thu muc cau hinh ProxyManager:

```nginx
include /etc/nginx/proxymanager.d/*.conf;
```

Mo firewall cac cong can thiet:

- `8000/tcp`: dashboard, neu khong di qua Nginx;
- `50051/tcp`: ket noi gRPC tu agent;
- `7001/tcp`: cong bind cua FRPS;
- `18081/tcp`: cong HTTP vhost cua FRPS;
- `80/tcp` va `443/tcp`: Nginx va Let's Encrypt.

## 10. Kiem Tra Nhanh

```bash
go test ./...
curl -f http://127.0.0.1:8000/api/v1/install/script
systemctl is-active proxymanager-server
systemctl is-active proxymanager-frps
```

Neu `/api/v1/install/script?os=linux` tra ve `401`, day la dung hanh vi khi khong co token cai dat 1 lan.
