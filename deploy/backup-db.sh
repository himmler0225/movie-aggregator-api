#!/usr/bin/env bash
# Nightly database backup (installed to cron by setup.sh).
# Dumps the public + auth schemas, keeps the last 14 days locally, and copies
# each dump off the server when an rclone remote named "cineflow-backup" exists
# (see deploy/README.md). A VPS-only backup dies with the VPS.
set -euo pipefail

ENV_FILE=/opt/cine-flow/movie-aggregator-api/.env
OUT_DIR=/var/backups/cineflow
KEEP_DAYS=14
REMOTE="cineflow-backup:cineflow-db"

mkdir -p "$OUT_DIR" && chmod 700 "$OUT_DIR"
DIRECT_URL=$(grep '^DIRECT_URL=' "$ENV_FILE" | cut -d= -f2- | tr -d '"')
FILE="$OUT_DIR/cineflow-$(date +%F-%H%M).sql.gz"

# pg_dump must be at least as new as the server (Supabase runs PG 15/17).
docker run --rm postgres:17-alpine pg_dump "$DIRECT_URL" \
  --schema=public --schema=auth --no-owner --no-privileges \
  | gzip -9 > "$FILE.tmp"
mv "$FILE.tmp" "$FILE"
chmod 600 "$FILE"
echo "$(date -Is) backup ok: $FILE ($(du -h "$FILE" | cut -f1))"

find "$OUT_DIR" -name 'cineflow-*.sql.gz' -mtime +"$KEEP_DAYS" -delete

if command -v rclone >/dev/null && rclone listremotes 2>/dev/null | grep -q '^cineflow-backup:$'; then
  rclone copy "$FILE" "$REMOTE" --quiet
  rclone delete "$REMOTE" --min-age "${KEEP_DAYS}d" --quiet || true
  echo "$(date -Is) uploaded to $REMOTE"
else
  echo "$(date -Is) WARNING: no off-server copy (rclone remote 'cineflow-backup' not configured)"
fi
