#!/bin/sh
set -eu

if [ "${CONFIRM_RESTORE:-}" != "YES" ]; then
  echo "Refusing destructive restore. Set CONFIRM_RESTORE=YES after stopping NightLight web/migrate/backup services." >&2
  exit 2
fi

BACKUP_DIR="${1:-}"
if [ -z "$BACKUP_DIR" ] || [ ! -f "$BACKUP_DIR/database.dump" ]; then
  echo "Usage: CONFIRM_RESTORE=YES /ops/restore.sh /backups/nightlight_YYYYMMDD_HHMMSS" >&2
  exit 2
fi

(
  cd "$BACKUP_DIR"
  sha256sum -c SHA256SUMS
)

dropdb --if-exists "$PGDATABASE"
createdb "$PGDATABASE"
pg_restore --no-owner --no-acl --exit-on-error --dbname="$PGDATABASE" "$BACKUP_DIR/database.dump"

if [ "${RESTORE_MEDIA:-true}" = "true" ]; then
  rm -rf /restore-target/uploads /restore-target/generated
  mkdir -p /restore-target
  tar -xzf "$BACKUP_DIR/media.tar.gz" -C /restore-target
fi

echo "Restore completed. Start NightLight and verify /api/ready plus critical workflows."
