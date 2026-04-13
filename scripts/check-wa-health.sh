#!/bin/bash
# Monitor WhatsApp session health. Detecte les floods d'erreurs "Bad MAC" libsignal
# qui indiquent des sessions chiffrees corrompues (messages perdus silencieusement).
# Envoie une notification Telegram via Alfred si threshold depasse.
#
# Decision deliberee : on NE fait PAS d'auto-reset des sessions (risque de casser
# l'appairage WhatsApp et forcer un re-scan QR). Ce script alerte, Lucas decide.

set -euo pipefail

LOG="$(cd "$(dirname "$0")/.." && pwd)/logs/nanoclaw.error.log"
THRESHOLD=500    # alerte si > 500 Bad MAC dans la derniere heure

[ -f "$LOG" ] || exit 0

# Compte les "Bad MAC" dans la derniere heure (approximation : derniers 50000 lignes)
COUNT=$(tail -n 50000 "$LOG" 2>/dev/null | grep -c "Bad MAC" || true)

if [ "$COUNT" -gt "$THRESHOLD" ]; then
  MSG="WhatsApp session health: $COUNT erreurs Bad MAC recentes. Sessions libsignal possiblement corrompues, messages peuvent etre perdus. Considerer /setup pour re-linker."
  echo "[wa-health] ALERT: $MSG"
  # Injection via IPC vers Alfred (NanoClaw poll le fichier)
  IPC_DIR="$(cd "$(dirname "$0")/.." && pwd)/ipc/inbox/alfred"
  mkdir -p "$IPC_DIR"
  cat > "$IPC_DIR/wa-health-$(date +%s).json" <<EOF
{
  "type": "notification",
  "source": "wa-health-check",
  "severity": "warning",
  "message": "$MSG"
}
EOF
else
  echo "[wa-health] OK ($COUNT Bad MAC errors, threshold $THRESHOLD)"
fi
