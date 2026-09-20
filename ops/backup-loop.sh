#!/bin/sh
set -eu

INTERVAL="${BACKUP_INTERVAL_SECONDS:-86400}"

while true; do
  /ops/backup.sh || true
  sleep "$INTERVAL"
done
