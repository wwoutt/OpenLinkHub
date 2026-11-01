#!/bin/bash
# Installs a locally built OpenLinkHub over an existing /opt/OpenLinkHub install,
# keeping its database and configuration. The replaced files are backed up first.
# Author: wwoutt (2026-11-01), part of a fork of OpenLinkHub by Nikola Jurkovic
# License: GPL-3.0 or later
#
# Usage: extras/deploy-local.sh             (build first with extras/build-podman.sh)
#        extras/deploy-local.sh --rollback  (restore the most recent backup)

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="/var/opt/OpenLinkHub"
BACKUPS="/var/opt/OpenLinkHub-backups"
SERVICE="OpenLinkHub"

[ -d "$TARGET" ] || { echo "$TARGET not found"; exit 1; }

if [ "$1" = "--rollback" ]; then
  LATEST="$(sudo ls -1d "$BACKUPS"/* 2>/dev/null | sort | tail -1)"
  [ -n "$LATEST" ] || { echo "No backup found in $BACKUPS"; exit 1; }
  echo "Restoring $LATEST"
  sudo LATEST="$LATEST" TARGET="$TARGET" SERVICE="$SERVICE" bash -e <<'EOF'
systemctl stop "$SERVICE"
rm -rf "$TARGET/web" "$TARGET/static"
cp -a "$LATEST/OpenLinkHub" "$LATEST/web" "$LATEST/static" "$TARGET/"
restorecon -R "$TARGET" 2>/dev/null || true
systemctl start "$SERVICE"
EOF
  echo "Restored."
  exit 0
fi

[ -x "$ROOT/OpenLinkHub" ] || { echo "No binary, run extras/build-podman.sh first"; exit 1; }

STAMP="$(date +%Y%m%d-%H%M%S)"
sudo ROOT="$ROOT" TARGET="$TARGET" BACKUP="$BACKUPS/$STAMP" SERVICE="$SERVICE" bash -e <<'EOF'
mkdir -p "$BACKUP"
cp -a "$TARGET/OpenLinkHub" "$TARGET/web" "$TARGET/static" "$BACKUP/"

systemctl stop "$SERVICE"
rm -rf "$TARGET/web" "$TARGET/static"
cp "$ROOT/OpenLinkHub" "$TARGET/OpenLinkHub"
cp -r "$ROOT/web" "$ROOT/static" "$TARGET/"
chown -R openlinkhub:openlinkhub "$TARGET/OpenLinkHub" "$TARGET/web" "$TARGET/static"
chmod 755 "$TARGET/OpenLinkHub"
restorecon -R "$TARGET" 2>/dev/null || true
systemctl start "$SERVICE"
EOF

echo "Deployed. Backup of the previous version: $BACKUPS/$STAMP"
echo "Roll back with: extras/deploy-local.sh --rollback"
