#!/bin/sh
set -eu

BACKUP_ROOT="${BACKUP_ROOT:-/backups}"
LATEST="$(find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -name 'nightlight_*' | sort | tail -n 1)"
TEST_DB="nightlight_restore_test_$(date -u +%Y%m%d%H%M%S)"

log_event() {
  kind="$1"
  status="$2"
  message="$3"
  psql -d "${PGDATABASE}" -v ON_ERROR_STOP=1     -v kind="$kind" -v status="$status" -v message="$message"     -c "INSERT INTO operations_events (kind, status, message) VALUES (:'kind', :'status', :'message');" >/dev/null 2>&1 || true
}

cleanup() {
  dropdb --if-exists "$TEST_DB" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

if [ -z "$LATEST" ] || [ ! -f "$LATEST/database.dump" ]; then
  log_event "restore_test" "failed" "No backup available for restore test"
  exit 1
fi

(
  cd "$LATEST"
  sha256sum -c SHA256SUMS >/dev/null
)

createdb "$TEST_DB"
pg_restore --no-owner --no-acl --exit-on-error --dbname="$TEST_DB" "$LATEST/database.dump"

TABLE_COUNT="$(psql -d "$TEST_DB" -Atc "select count(*) from information_schema.tables where table_schema = 'public';")"
if [ "${TABLE_COUNT:-0}" -lt 10 ]; then
  log_event "restore_test" "failed" "Restore test produced only ${TABLE_COUNT:-0} public tables"
  exit 1
fi

psql -d "$TEST_DB" -Atc "select count(*) from users;" >/dev/null
psql -d "$TEST_DB" -Atc "select count(*) from gigs;" >/dev/null

log_event "restore_test" "success" "Restore test passed for $(basename "$LATEST") with ${TABLE_COUNT} public tables"
