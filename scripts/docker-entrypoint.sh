#!/bin/sh
set -e

# Runtime UID/GID adjustment for the 'node' user.
# Set PUID/PGID in docker-compose.yml to match host volume ownership.
# If running as root, adjusts the node user and drops privileges via gosu.
# If already non-root (e.g., compose `user:` directive), just execs the command.

if [ "$(id -u)" = "0" ]; then
  PUID="${PUID:-1000}"
  PGID="${PGID:-1000}"

  if [ "$(id -g node)" != "$PGID" ]; then
    groupmod -g "$PGID" node
  fi
  if [ "$(id -u node)" != "$PUID" ]; then
    usermod -u "$PUID" -g "$PGID" node
  fi

  chown node:node /home/node
  mkdir -p /home/node/.crocbot
  chown node:node /home/node/.crocbot

  exec gosu node "$@"
fi

exec "$@"
