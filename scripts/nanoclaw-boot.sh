#!/bin/bash
# Wrapper de demarrage NanoClaw pour launchd.
# Poll docker info avant de lancer node pour eviter crash-loop
# quand Docker Desktop n'est pas encore pret (reboot Mac).
# Voir plan : ~/.claude/plans/2026-04-16-215535-nanoclaw-resilience-post-docker.md

set -euo pipefail

MAX_WAIT=120
ELAPSED=0
INTERVAL=5
LOG_PREFIX="[nanoclaw-boot]"

while ! /usr/local/bin/docker info > /dev/null 2>&1; do
  if [ $ELAPSED -ge $MAX_WAIT ]; then
    echo "${LOG_PREFIX} Docker not ready after ${MAX_WAIT}s, aborting" >&2
    exit 1
  fi
  echo "${LOG_PREFIX} Waiting for Docker... (${ELAPSED}s)"
  sleep $INTERVAL
  ELAPSED=$((ELAPSED + INTERVAL))
done

echo "${LOG_PREFIX} Docker ready after ${ELAPSED}s, launching NanoClaw"
exec /opt/homebrew/bin/node /Users/lucas/nanoclaw/dist/index.js
