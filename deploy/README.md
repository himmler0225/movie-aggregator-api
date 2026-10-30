# Deploying Cine-Flow

Production runs on one Ubuntu 22.04 VPS (`103.77.214.232`, SSH on port **6986**):
nginx (TLS) → Docker containers `frontend` (:3000), `backend` (:3001), `redis`.
Database and auth live in Supabase.

## Deploy / redeploy

```bash
ssh -p 6986 root@103.77.214.232
bash /root/setup.sh            # pulls both repos, migrates, rebuilds, reloads nginx
```

On a brand-new server: put the backend env at `/root/cineflow-backend.env`, then

```bash
curl -fsSL https://raw.githubusercontent.com/himmler0225/movie-aggregator-api/main/deploy/setup.sh -o /root/setup.sh
bash /root/setup.sh you@example.com   # email for Let's Encrypt
```

`setup.sh` is idempotent. It also sets up: swap, automatic security updates,
ufw (SSH port + 80/443), fail2ban, the nginx config in `deploy/nginx/`,
certificate renewal, and the cron jobs in `/etc/cron.d/cineflow`
(nightly DB backup, restart of unhealthy containers, weekly image cleanup).

## One-time manual steps

### 1. Keep the env file somewhere safe
`/opt/cine-flow/movie-aggregator-api/.env` holds every secret (Supabase, Google,
JWT). Store a copy in a password manager; the server alone is not a backup.

### 2. Key-only SSH
From your computer:

```bash
ssh-keygen -t ed25519            # only if you have no key yet
ssh-copy-id -p 6986 root@103.77.214.232
ssh -p 6986 root@103.77.214.232  # must log in WITHOUT a password
```

Then on the server (keep that session open, test a new login before closing):

```bash
bash /opt/cine-flow/movie-aggregator-api/deploy/harden-ssh.sh
```

### 3. Off-server database backups
Backups are written to `/var/backups/cineflow` (14 days). To also copy them off
the VPS, configure an rclone remote named `cineflow-backup`, e.g. Cloudflare R2
(free 10 GB) or Google Drive:

```bash
apt-get install -y rclone
rclone config                     # create remote "cineflow-backup"
rclone mkdir cineflow-backup:cineflow-db
cineflow-backup-db                # run once now; should end with "uploaded to …"
```

Restore: `gunzip -c cineflow-YYYY-MM-DD-HHMM.sql.gz | psql "$DIRECT_URL"`
(into an empty database / new Supabase project).

### 4. Uptime monitoring
Create free HTTP monitors (UptimeRobot or Better Stack), 5-minute interval,
alerts by email/Telegram:

- `https://be.review-mine.com/api/health` (expects `"ok":true`)
- `https://review-mine.com/robots.txt`

## Useful commands

```bash
cd /opt/cine-flow
docker compose ps                         # status + health
docker compose logs -f backend --tail 100
tail -n 20 /var/log/cineflow-backup.log
fail2ban-client status sshd
ufw status
```
