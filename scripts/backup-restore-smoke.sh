#!/bin/sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${RESTORE_DATABASE_URL:?RESTORE_DATABASE_URL is required}"

tmp="$(mktemp -d)"
trap 'rm -rf "${tmp}"' EXIT

export BACKUP_ROOT="${tmp}/backups"
export UPLOADS_ROOT="${tmp}/uploads"
export GENERATED_ROOT="${tmp}/generated"
export CONFIG_ROOT="${tmp}/config"
mkdir -p "${UPLOADS_ROOT}" "${GENERATED_ROOT}" "${CONFIG_ROOT}"
printf 'media' > "${UPLOADS_ROOT}/proof.txt"
printf 'generated' > "${GENERATED_ROOT}/proof.txt"
printf 'config' > "${CONFIG_ROOT}/proof.txt"

psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -c "CREATE TABLE IF NOT EXISTS backup_restore_probe (id integer primary key, value text not null); INSERT INTO backup_restore_probe (id, value) VALUES (1, 'nightlight') ON CONFLICT (id) DO UPDATE SET value = excluded.value;"

sh scripts/backup.sh
backup="$(find "${BACKUP_ROOT}" -mindepth 1 -maxdepth 1 -type d -name 'nightlight-*' | head -n 1)"
test -n "${backup}"

DATABASE_URL="${RESTORE_DATABASE_URL}" sh scripts/restore.sh "${backup}"

result="$(psql "${RESTORE_DATABASE_URL}" -Atc "select value from backup_restore_probe where id=1")"
test "${result}" = "nightlight"
test -f "${UPLOADS_ROOT}/proof.txt"
test -f "${GENERATED_ROOT}/proof.txt"
test -f "${CONFIG_ROOT}/proof.txt"

echo "Backup/restore smoke test passed"
