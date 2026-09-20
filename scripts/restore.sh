#!/bin/sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"

backup_dir="${1:-}"
if [ -z "${backup_dir}" ] || [ ! -d "${backup_dir}" ]; then
  echo "Usage: restore.sh /path/to/nightlight-YYYYMMDDTHHMMSSZ" >&2
  exit 2
fi

if [ ! -f "${backup_dir}/database.dump" ] || [ ! -f "${backup_dir}/files.tar.gz" ]; then
  echo "Backup is incomplete" >&2
  exit 2
fi

: "${UPLOADS_ROOT:=/uploads}"
: "${GENERATED_ROOT:=/generated}"
: "${CONFIG_ROOT:=/config}"

echo "Restoring PostgreSQL..."
pg_restore --clean --if-exists --no-owner --no-privileges --dbname "${DATABASE_URL}" "${backup_dir}/database.dump"

echo "Restoring files..."
mkdir -p "${UPLOADS_ROOT}" "${GENERATED_ROOT}" "${CONFIG_ROOT}"
tar -xzf "${backup_dir}/files.tar.gz" -C /

echo "Restore completed from ${backup_dir}"
