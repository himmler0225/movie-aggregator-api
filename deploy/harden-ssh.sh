#!/usr/bin/env bash
# Key-only SSH for root. Run ONLY after `ssh -p <port> root@<host>` works with
# your key without asking for a password (see deploy/README.md), otherwise you
# could lock yourself out. Safe to re-run.
set -euo pipefail

KEYS=/root/.ssh/authorized_keys
if [ ! -s "$KEYS" ]; then
  echo "No keys in $KEYS: add your public key first (ssh-copy-id). Aborting." >&2
  exit 1
fi

CONF=/etc/ssh/sshd_config.d/99-cineflow.conf
mkdir -p /etc/ssh/sshd_config.d
# Older/provider images may lack the Include line; without it the drop-in is ignored.
if ! grep -qE '^\s*Include\s+/etc/ssh/sshd_config\.d/\*\.conf' /etc/ssh/sshd_config; then
  sed -i '1i Include /etc/ssh/sshd_config.d/*.conf' /etc/ssh/sshd_config
fi
cat > "$CONF" <<'CONF'
PermitRootLogin prohibit-password
PasswordAuthentication no
KbdInteractiveAuthentication no
ChallengeResponseAuthentication no
MaxAuthTries 4
CONF

sshd -t
systemctl reload ssh
sshd -T | grep -E '^(port|permitrootlogin|passwordauthentication) '
echo "Done. Keep this session open and test a NEW ssh login before closing it."
