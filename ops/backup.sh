#!/bin/sh
set -eu

BACKUP_ROOT="${BACKUP_ROOT:-/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
STAMP="$(date -u +%Y%m%d_%H%M%S)"
DEST="${BACKUP_ROOT}/nightlight_${STAMP}"
APP_VERSION="${NUXT_APP_VERSION:-unknown}"

log_event() {
  kind="$1"
  status="$2"
  message="$3"
  psql -d "${PGDATABASE}" -v ON_ERROR_STOP=1     -v kind="$kind" -v status="$status" -v message="$message"     -c "INSERT INTO operations_events (kind, status, message) VALUES (:'kind', :'status', :'message');" >/dev/null 2>&1 || true
}

fail() {
  code=$?
  log_event "backup" "failed" "Backup failed with exit code ${code}"
  exit "$code"
}
trap fail INT TERM HUP EXIT

mkdir -p "$DEST"

pg_dump --format=custom --no-owner --no-acl --file="$DEST/database.dump" "$PGDATABASE"

tar -czf "$DEST/media.tar.gz" -C /source uploads generated

cat > "$DEST/manifest.txt" <<EOF
created_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
app_version=$APP_VERSION
postgres_database=$PGDATABASE
contents=database.dump,media.tar.gz
secrets_included=false
EOF

(
  cd "$DEST"
  sha256sum database.dump media.tar.gz manifest.txt > SHA256SUMS
)

if [ "${BACKUP_SECONDARY_ENABLED:-false}" = "true" ]; then
  mkdir -p /secondary
  rm -rf "/secondary/$(basename "$DEST")"
  cp -R "$DEST" /secondary/
fi

find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -name 'nightlight_*' -mtime "+$RETENTION_DAYS" -exec rm -rf {} + || true

trap - INT TERM HUP EXIT
log_event "backup" "success" "Backup $(basename "$DEST") completed"
printf '%s\n' "$DEST"
