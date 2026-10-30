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

log() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }

log "Packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl git nginx certbot python3-certbot-nginx >/dev/null
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
cp movie-aggregator-api/deploy/docker-compose.yml docker-compose.yml

ENV_FILE=movie-aggregator-api/.env
if [ ! -f "$ENV_FILE" ] && [ -f /root/cineflow-backend.env ]; then
  install -m 600 /root/cineflow-backend.env "$ENV_FILE"
fi
if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE (copy it to /root/cineflow-backend.env and re-run)." >&2
  exit 1
fi

log "Database migrations (idempotent)"
DIRECT_URL=$(grep '^DIRECT_URL=' "$ENV_FILE" | cut -d= -f2- | tr -d '"')
for f in user-preferences-migration.sql refresh-tokens-parent-migration.sql; do
  docker run --rm -i postgres:16-alpine psql "$DIRECT_URL" -q -v ON_ERROR_STOP=1 \
    < "movie-aggregator-api/prisma/$f"
  echo "$f OK"
done
unset DIRECT_URL

log "Build & start containers"
docker compose build
docker compose up -d --force-recreate
docker image prune -f >/dev/null

log "nginx"
cp movie-aggregator-api/deploy/nginx-cineflow.conf /etc/nginx/sites-available/cineflow
ln -sf /etc/nginx/sites-available/cineflow /etc/nginx/sites-enabled/cineflow
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

if [ ! -d /etc/letsencrypt/live/review-mine.com ]; then
  if [ -z "$EMAIL" ]; then
    echo "No certificate yet: re-run with your email, e.g. bash setup.sh you@example.com" >&2
  else
    log "HTTPS certificates"
    args=()
    for d in "${DOMAINS[@]}"; do args+=(-d "$d"); done
    certbot --nginx --non-interactive --agree-tos -m "$EMAIL" --redirect "${args[@]}"
  fi
fi

log "Health"
for i in $(seq 1 30); do
  curl -fsS http://127.0.0.1:3001/api/health >/dev/null 2>&1 && break
  sleep 2
done
docker compose ps
printf 'backend  : '; curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3001/api/health
printf 'frontend : '; curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/login
docker compose logs backend --tail 30 | grep -iE "redis|error|listening|API:" || true
