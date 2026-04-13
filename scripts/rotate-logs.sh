#!/bin/bash
# Rotation des logs NanoClaw.
# Strategy : copy-truncate pour preserver l'inode (pino continue d'ecrire sans SIGHUP).
# Garde les 3 dernieres rotations, compressees en gzip.
# Seuil de taille configurable (defaut 50 MB).

set -euo pipefail

LOGS_DIR="$(cd "$(dirname "$0")/.." && pwd)/logs"
MAX_SIZE_BYTES=$((50 * 1024 * 1024))   # 50 MB
KEEP=3

rotate_one() {
  local file="$1"
  [ -f "$file" ] || return 0
  local size
  size=$(stat -f "%z" "$file")
  if [ "$size" -lt "$MAX_SIZE_BYTES" ]; then
    return 0
  fi
  echo "[rotate-logs] Rotating $file ($((size / 1024 / 1024)) MB)"
  # Shift anciennes rotations : .2.gz -> .3.gz, .1.gz -> .2.gz
  local i=$((KEEP - 1))
  while [ $i -ge 1 ]; do
    if [ -f "${file}.${i}.gz" ]; then
      mv "${file}.${i}.gz" "${file}.$((i + 1)).gz"
    fi
    i=$((i - 1))
  done
  # Copy + truncate (preserve inode, pino keeps writing)
  cp "$file" "${file}.1"
  : > "$file"
  gzip "${file}.1"
  # Expire la plus vieille
  [ -f "${file}.$((KEEP + 1)).gz" ] && rm "${file}.$((KEEP + 1)).gz"
}

# Logs principaux
for log in "$LOGS_DIR/nanoclaw.log" "$LOGS_DIR/nanoclaw.error.log" \
           "$LOGS_DIR/oauth-refresh.log"; do
  rotate_one "$log"
done

# Group logs (WhatsApp, Telegram containers)
if [ -d "$LOGS_DIR/../groups" ]; then
  find "$LOGS_DIR/../groups" -name "container-*.log" -size +10M 2>/dev/null | while read -r f; do
    rotate_one "$f"
  done
  # Purge containers logs > 30 days
  find "$LOGS_DIR/../groups" -name "container-*.log*" -mtime +30 -delete 2>/dev/null || true
fi

echo "[rotate-logs] Done"
