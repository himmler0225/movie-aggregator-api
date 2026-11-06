#!/usr/bin/env bash
# Fresh-VPS (Ubuntu) setup / redeploy for Cine-Flow. Safe to re-run.
#   bash setup.sh you@example.com      # email is used for Let's Encrypt
# Expects the backend env file at /root/cineflow-backend.env (first run) or
# /opt/cine-flow/movie-aggregator-api/.env (later runs).
set -euo pipefail

EMAIL="${1:-}"
DIR=/opt/cine-flow
REPOS=(cine-flow movie-aggregator-api)
DOMAINS=(review-mine.com www.review-mine.com be.review-mine.com)
CERT_DIR=/etc/letsencrypt/live/review-mine.com

log() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }

log "Packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl git nginx certbot python3-certbot-nginx \
  ufw fail2ban unattended-upgrades >/dev/null
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker >/dev/null

# The frontend build needs ~2GB RAM; add swap on small VPS plans.
if ! swapon --show | grep -q .; then
  log "Adding 2G swap"
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

log "Security: automatic security updates, firewall, fail2ban"
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'CONF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
CONF
# Allow whatever port(s) sshd really listens on (this VPS uses a custom one).
SSH_PORTS=$(sshd -T 2>/dev/null | awk '/^port /{print $2}' | sort -u)
[ -n "$SSH_PORTS" ] || SSH_PORTS=22
for p in $SSH_PORTS; do ufw allow "$p/tcp" >/dev/null; done
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null
ufw status | sed -n '1,12p'
cat > /etc/fail2ban/jail.d/cineflow-sshd.local <<CONF
[sshd]
enabled = true
port = $(echo "$SSH_PORTS" | paste -sd, -)
maxretry = 5
findtime = 10m
bantime = 1h
CONF
systemctl enable --now fail2ban >/dev/null
systemctl restart fail2ban

log "Code"
mkdir -p "$DIR" && cd "$DIR"
for repo in "${REPOS[@]}"; do
  if [ -d "$repo/.git" ]; then
    git -C "$repo" pull --ff-only origin main
  else
    git clone "https://github.com/himmler0225/$repo.git" "$repo"
  fi
  echo "$repo @ $(git -C "$repo" log --oneline -1)"
done
DEPLOY="$DIR/movie-aggregator-api/deploy"
cp "$DEPLOY/docker-compose.yml" docker-compose.yml

ENV_FILE=movie-aggregator-api/.env
if [ ! -f "$ENV_FILE" ] && [ -f /root/cineflow-backend.env ]; then
  install -m 600 /root/cineflow-backend.env "$ENV_FILE"
fi
if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE (copy it to /root/cineflow-backend.env and re-run)." >&2
  exit 1
fi
chmod 600 "$ENV_FILE"

# Web push needs a VAPID key pair; generate one once and keep it (changing it
# invalidates every browser subscription).
if ! grep -q '^VAPID_PRIVATE_KEY=.' "$ENV_FILE"; then
  log "Generating VAPID keys for web push"
  KEYS=$(docker run --rm node:22-alpine npx -y web-push@3.6.7 generate-vapid-keys --json)
  PUB=$(printf '%s' "$KEYS" | sed -E 's/.*"publicKey":"([^"]+)".*/\1/')
  PRIV=$(printf '%s' "$KEYS" | sed -E 's/.*"privateKey":"([^"]+)".*/\1/')
  sed -i '/^VAPID_/d' "$ENV_FILE"
  printf 'VAPID_PUBLIC_KEY=%s\nVAPID_PRIVATE_KEY=%s\nVAPID_SUBJECT=https://review-mine.com\n' "$PUB" "$PRIV" >> "$ENV_FILE"
  unset KEYS PUB PRIV
fi

log "Database migrations (idempotent)"
DIRECT_URL=$(grep '^DIRECT_URL=' "$ENV_FILE" | cut -d= -f2- | tr -d '"')
for f in user-preferences-migration.sql refresh-tokens-parent-migration.sql quick-features-migration.sql; do
  docker run --rm -i postgres:16-alpine psql "$DIRECT_URL" -q -v ON_ERROR_STOP=1 \
    < "movie-aggregator-api/prisma/$f"
  echo "$f OK"
done
unset DIRECT_URL

log "Build & start containers"
docker compose build
docker compose up -d --force-recreate
docker image prune -f >/dev/null

log "nginx + HTTPS"
install -m 644 "$DEPLOY/nginx/proxy-common.conf" /etc/nginx/snippets/cineflow-proxy.conf
rm -f /etc/nginx/sites-enabled/default

# Ubuntu's stock nginx.conf still allows TLSv1/TLSv1.1. Tighten it in place
# (idempotent) and keep it in sync with the site config, which must NOT
# declare ssl_protocols / ssl_prefer_server_ciphers again (nginx would refuse
# to start with "directive is duplicate").
if grep -qE '^\s*ssl_protocols\s' /etc/nginx/nginx.conf; then
  sed -i 's|^\(\s*\)ssl_protocols\s.*$|\1ssl_protocols TLSv1.2 TLSv1.3;|' /etc/nginx/nginx.conf
fi
if [ ! -f "$CERT_DIR/fullchain.pem" ]; then
  if [ -z "$EMAIL" ]; then
    echo "No certificate yet: re-run with your email, e.g. bash setup.sh you@example.com" >&2
    exit 1
  fi
  install -m 644 "$DEPLOY/nginx/bootstrap.conf" /etc/nginx/sites-available/cineflow
  ln -sf /etc/nginx/sites-available/cineflow /etc/nginx/sites-enabled/cineflow
  nginx -t && systemctl reload nginx
  args=()
  for d in "${DOMAINS[@]}"; do args+=(-d "$d"); done
  # certonly: certbot never edits our nginx files, so deploys can overwrite them.
  certbot certonly --nginx --non-interactive --agree-tos -m "$EMAIL" "${args[@]}"
fi
# Certificates issued earlier with `certbot --nginx` also have an "installer" that
# rewrites the nginx config on renewal; drop it so renewals only fetch the cert.
for f in /etc/letsencrypt/renewal/*.conf; do
  [ -f "$f" ] && sed -i '/^installer = nginx$/d' "$f"
done
mkdir -p /etc/letsencrypt/renewal-hooks/deploy
cat > /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh <<'HOOK'
#!/bin/sh
systemctl reload nginx
HOOK
chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh

# Install the site config, but never leave a broken one in place: if `nginx -t`
# fails we restore the previous file and keep serving with it. A bad config here
# silently takes the whole site down (nginx refuses to start).
install -m 644 "$DEPLOY/nginx/cineflow.conf" /etc/nginx/sites-available/cineflow
ln -sf /etc/nginx/sites-available/cineflow /etc/nginx/sites-enabled/cineflow
if ! nginx -t; then
  echo "nginx config test failed — restoring the previous site config." >&2
  if [ -f /etc/nginx/sites-available/cineflow.bak ]; then
    install -m 644 /etc/nginx/sites-available/cineflow.bak /etc/nginx/sites-available/cineflow
  else
    rm -f /etc/nginx/sites-enabled/cineflow
  fi
  nginx -t && systemctl reload nginx
  exit 1
fi
cp -a /etc/nginx/sites-available/cineflow /etc/nginx/sites-available/cineflow.bak
systemctl reload nginx

log "Scheduled jobs: DB backup, self-healing, cleanup"
install -m 755 "$DEPLOY/backup-db.sh" /usr/local/bin/cineflow-backup-db
cat > /etc/cron.d/cineflow <<'CRON'
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
# Nightly database backup (03:30 server time)
30 3 * * * root /usr/local/bin/cineflow-backup-db >> /var/log/cineflow-backup.log 2>&1
# Restart containers whose healthcheck failed (Docker only restarts exited ones)
*/2 * * * * root docker ps -q --filter health=unhealthy | xargs -r docker restart >> /var/log/cineflow-heal.log 2>&1
# Weekly cleanup of old images and build cache
0 4 * * 0 root docker image prune -af --filter until=168h >/dev/null 2>&1; docker builder prune -af --filter until=168h >/dev/null 2>&1
CRON
chmod 644 /etc/cron.d/cineflow

log "Health"
for _ in $(seq 1 30); do
  curl -fsS http://127.0.0.1:3001/api/health >/dev/null 2>&1 && break
  sleep 2
done
docker compose ps
printf 'backend  : '; curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3001/api/health
printf 'frontend : '; curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/robots.txt
printf 'https    : '; curl -s -o /dev/null -w '%{http_code}\n' --resolve review-mine.com:443:127.0.0.1 https://review-mine.com/robots.txt
docker compose logs backend --tail 30 | grep -iE "redis|error|API:" || true
if ! command -v rclone >/dev/null || ! rclone listremotes 2>/dev/null | grep -q '^cineflow-backup:$'; then
  echo
  echo "NOTE: database backups stay on this VPS only until rclone remote 'cineflow-backup' is set up (deploy/README.md)."
fi
