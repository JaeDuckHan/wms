# 3PL Docker Deployment Guide (Ubuntu + Host Nginx)

This guide defines a simple production standard for `3pl.kowinsblue.com` using Docker Compose.

## 1) Operating policy

1. Expose only host `nginx` on ports `80/443`.
2. Run app services only in Docker: `web`, `api`, `db`.
3. Bind `api(3100)` and `web(3000)` to `127.0.0.1` only.
4. Keep DB data persistent in Docker volume `db_data`.
5. Run schema/seed init scripts only once on first DB bootstrap.
6. Disable mock and fallback in production.

## 2) One-time server setup

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg lsb-release nginx certbot python3-certbot-nginx

sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo \"$VERSION_CODENAME\") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin git
sudo usermod -aG docker $USER
```

Log out and log back in to apply docker group membership.

## 3) Checkout and environment file

```bash
sudo mkdir -p /var/www
sudo chown -R $USER:$USER /var/www
cd /var/www
git clone <REPO_URL> wms
cd /var/www/wms

cp docker.env.example .env.docker
```

Required `.env.docker` updates:

1. `MYSQL_ROOT_PASSWORD`
2. `MYSQL_PASSWORD`
3. `JWT_SECRET`

## 4) Start containers

```bash
cd /var/www/wms
docker compose --env-file .env.docker up -d --build
docker compose --env-file .env.docker ps
```

Health checks:

```bash
curl -I http://127.0.0.1:3100/health
curl -I http://127.0.0.1:3000/login
```

## 5) Host nginx config

Create `/etc/nginx/sites-available/3pl.kowinsblue.com`:

```nginx
server {
  listen 80;
  server_name 3pl.kowinsblue.com;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Apply and issue TLS certificate:

```bash
sudo ln -s /etc/nginx/sites-available/3pl.kowinsblue.com /etc/nginx/sites-enabled/3pl.kowinsblue.com
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d 3pl.kowinsblue.com
```

## 6) Deploy updates

```bash
cd /var/www/wms
git pull --rebase origin main
docker compose --env-file .env.docker up -d --build
docker image prune -f
```

## 7) Database operations

Connection policy:

1. Host: `127.0.0.1`
2. Port: `3306` (do not expose publicly)
3. DB name: `MYSQL_DATABASE`
4. App user: `MYSQL_USER`

Backup:

```bash
cd /var/www/wms
mkdir -p backups
docker compose --env-file .env.docker exec -T db \
  sh -lc 'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --databases "$MYSQL_DATABASE"' \
  > backups/wms_$(date +%F_%H%M%S).sql
```

Restore (overwrites existing data):

```bash
cd /var/www/wms
cat backups/<backup-file>.sql | docker compose --env-file .env.docker exec -T db \
  sh -lc 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD"'
```

Reset DB (deletes all data):

```bash
cd /var/www/wms
docker compose --env-file .env.docker down -v
docker compose --env-file .env.docker up -d --build
```

Apply additional sample data to an already-running DB:

```bash
cd /var/www/wms
cat apps/api/sql/seed/seed_sample_realistic_10x.sql | docker compose --env-file .env.docker exec -T db \
  sh -lc 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"'
```

Apply runtime DB patches on an already-running DB (required for Billing/Storage/Warehouse settings):

```bash
cd /var/www/wms
bash apps/api/scripts/run_docker_billing_patch_idempotent.sh .env.docker
```

Manual fallback (same idempotent patches):

```bash
cat apps/api/sql/patch_billing_invoice_engine.sql | docker compose --env-file .env.docker exec -T db sh -lc 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"'
cat apps/api/sql/patch_multi_warehouse_billing_storage.sql | docker compose --env-file .env.docker exec -T db sh -lc 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"'
cat apps/api/sql/patch_warehouse_default_cbm_rate.sql | docker compose --env-file .env.docker exec -T db sh -lc 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"'
```

## 8) Default login

Seed default account:

1. Email: `admin@example.com`
2. Password: `x`
3. Extra sample admin: `ops.admin@amorepacific-partner.co.kr` / `1234`
