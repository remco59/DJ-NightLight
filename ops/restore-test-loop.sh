#!/bin/sh
set -eu

START_DELAY="${RESTORE_TEST_START_DELAY_SECONDS:-600}"
INTERVAL="${RESTORE_TEST_INTERVAL_SECONDS:-604800}"

sleep "$START_DELAY"
while true; do
  /ops/restore-test.sh || true
  sleep "$INTERVAL"
done
