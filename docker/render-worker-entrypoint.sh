#!/bin/sh
# Starts as root only to find which group owns the GPU render nodes, then drops
# to the unprivileged nightlight user with those groups so VAAPI works on any
# host without configuring a GID. Without a GPU it simply drops privileges.
set -eu

groups=""
for device in /dev/dri/renderD*; do
  [ -e "$device" ] || continue
  gid=$(stat -c '%g' "$device")
  case ",$groups," in
    *",$gid,"*) ;;
    *) groups="${groups:+$groups,}$gid" ;;
  esac
done

if [ "$(id -u)" != "0" ]; then
  exec "$@"
fi

if [ -n "$groups" ]; then
  exec setpriv --reuid=nightlight --regid=nightlight --groups="$groups" --inh-caps=-all --bounding-set=-all --no-new-privs "$@"
fi
exec setpriv --reuid=nightlight --regid=nightlight --clear-groups --inh-caps=-all --bounding-set=-all --no-new-privs "$@"
