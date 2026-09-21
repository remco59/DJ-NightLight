#!/bin/sh
set -eu

uid="${NIGHTLIGHT_UID:-10001}"
gid="${NIGHTLIGHT_GID:-10001}"

case "$uid" in
  ''|*[!0-9]*)
    echo "NIGHTLIGHT_UID must be a numeric UID" >&2
    exit 1
    ;;
esac

case "$gid" in
  ''|*[!0-9]*)
    echo "NIGHTLIGHT_GID must be a numeric GID" >&2
    exit 1
    ;;
esac

for directory in /storage/uploads /storage/generated; do
  mkdir -p "$directory"
  chown -R "$uid:$gid" "$directory"
  chmod -R u+rwX,g+rwX "$directory"
done

echo "NightLight storage initialized for UID:GID $uid:$gid"
