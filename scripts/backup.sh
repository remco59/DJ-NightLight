#!/bin/sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_ROOT:=/backups}"
: "${UPLOADS_ROOT:=/uploads}"
: "${GENERATED_ROOT:=/generated}"
: "${CONFIG_ROOT:=/config}"
: "${BACKUP_RETENTION_DAYS:=14}"
: "${BACKUP_SECONDARY_ROOT:=}"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
work="${BACKUP_ROOT}/.tmp-${timestamp}"
final="${BACKUP_ROOT}/nightlight-${timestamp}"

mkdir -p "${BACKUP_ROOT}" "${work}"

cleanup() {
  rm -rf "${work}"
}
trap cleanup EXIT INT TERM

echo "Creating PostgreSQL backup..."
pg_dump --format=custom --no-owner --no-privileges "${DATABASE_URL}" > "${work}/database.dump"

echo "Archiving uploads/generated/config..."
tar -czf "${work}/files.tar.gz" \
  -C / \
  "${UPLOADS_ROOT#/}" \
  "${GENERATED_ROOT#/}" \
  "${CONFIG_ROOT#/}"

cat > "${work}/manifest.txt" <<EOF
created_at=${timestamp}
database_format=postgres-custom
retention_days=${BACKUP_RETENTION_DAYS}
EOF

mv "${work}" "${final}"
trap - EXIT INT TERM

find "${BACKUP_ROOT}" -mindepth 1 -maxdepth 1 -type d -name 'nightlight-*' -mtime "+${BACKUP_RETENTION_DAYS}" -exec rm -rf {} \;

if [ -n "${BACKUP_SECONDARY_ROOT}" ]; then
  mkdir -p "${BACKUP_SECONDARY_ROOT}"
  cp -a "${final}" "${BACKUP_SECONDARY_ROOT}/"
fi

echo "Backup completed: ${final}"
