#!/usr/bin/env bash
# analyze-meeting.sh - Option 2 : analyse auto d'un meeting Fathom via claude -p headless.
# Appele par ~/nanoclaw/src/webhooks/fathom.ts apres fenetre grace 30s sans claim skill.
# Usage : analyze-meeting.sh {recording_id} {slug}

set -euo pipefail

RECORDING_ID="${1:-}"
SLUG="${2:-}"

if [[ -z "$RECORDING_ID" || -z "$SLUG" ]]; then
  echo "Usage: $0 {recording_id} {slug}" >&2
  exit 1
fi

EVENTS_DIR="$HOME/nanoclaw/data/fathom-events"
LOGS_DIR="$HOME/nanoclaw/logs/fathom-analyze"
mkdir -p "$LOGS_DIR"

ANALYZED_MARKER="$EVENTS_DIR/${RECORDING_ID}.analyzed"
CLAIMED_MARKER="$EVENTS_DIR/${RECORDING_ID}.claimed"
LOG_FILE="$LOGS_DIR/${RECORDING_ID}.log"

# Double garde : si deja claim ou analyse, stop
if [[ -f "$CLAIMED_MARKER" ]]; then
  echo "$(date -u +%FT%TZ) Claimed by skill, skip" >> "$LOG_FILE"
  exit 0
fi
if [[ -f "$ANALYZED_MARKER" ]]; then
  echo "$(date -u +%FT%TZ) Already analyzed, skip" >> "$LOG_FILE"
  exit 0
fi

# Marqueur atomique pour eviter double spawn
touch "$ANALYZED_MARKER"

echo "$(date -u +%FT%TZ) Auto-analyze start recording=$RECORDING_ID slug=$SLUG" >> "$LOG_FILE"

PROMPT="Tu es en mode analyse auto post-call Fathom (Option 2 catch-up passif).

Contexte :
- Recording Fathom : $RECORDING_ID
- Client slug : $SLUG
- Source de verite client : ~/.claude/client-registry.md
- Regles : R2 isolation client, R6 copy integrite, R8 zone conditionnelle (propositions flaggees)

Mission :
1. Via MCP Fathom : recupere get_summary + get_transcript pour recording_id $RECORDING_ID
2. Lis ~/agency-os/clients/$SLUG/client.md + memory.md + projects/*/project.md (selon structure)
3. Produis synthese structuree :
   - 3 points cles
   - Decisions actees
   - Next steps (avec owner si mentionne)
   - Risques / points d attention
   - [PROPOSITION] 1 a 3 actions suggerees (zone conditionnelle R8)
4. Append dans ~/agency-os/clients/$SLUG/memory.md sous section ## Journal meetings Fathom :
   ### YYYY-MM-DD - {titre meeting}
   [synthese ci-dessus]
   Tag : [fathom] [meeting-auto]
5. Si pertinent : update section journal du project.md actif (derniere entree)
6. Retourne en sortie stdout une synthese compacte (200 mots max) pour log

Contraintes :
- Ne jamais modifier copy valide (R6)
- Propositions = [PROPOSITION - validation requise] jamais appliquees
- Isolation R2 : ne touche pas a d autres clients
- Si ambigu ou doute : skip write + log warning, notif uniquement

Demarre directement, pas de confirmation."

# Spawn claude -p headless avec watchdog 10 min (macOS compatible, pas de `timeout` BSD)
# --permission-mode bypassPermissions : script 100 % scripted, contraintes R2/R6/R8 dans le prompt
TIMEOUT_SEC=600
claude -p --permission-mode bypassPermissions "$PROMPT" >> "$LOG_FILE" 2>&1 &
CLAUDE_PID=$!
( sleep "$TIMEOUT_SEC" && kill -TERM "$CLAUDE_PID" 2>/dev/null ) &
WATCHDOG_PID=$!
wait "$CLAUDE_PID"
EXIT=$?
kill "$WATCHDOG_PID" 2>/dev/null || true
if [[ "$EXIT" -ne 0 ]]; then
  echo "$(date -u +%FT%TZ) Auto-analyze failed exit=$EXIT" >> "$LOG_FILE"
  rm -f "$ANALYZED_MARKER"
  exit "$EXIT"
fi

echo "$(date -u +%FT%TZ) Auto-analyze done recording=$RECORDING_ID" >> "$LOG_FILE"

# Notif Telegram via IPC (main group)
MAIN_JID=$(sqlite3 "$HOME/nanoclaw/store/messages.db" \
  "SELECT jid FROM registered_groups WHERE folder='telegram_main' AND is_main=1 LIMIT 1" 2>/dev/null || true)

if [[ -n "$MAIN_JID" ]]; then
  TS_MS=$(($(date +%s%N) / 1000000))
  RAND=$(openssl rand -hex 3)
  IPC_DIR="$HOME/nanoclaw/data/ipc/telegram_main/messages"
  mkdir -p "$IPC_DIR"
  IPC_FILE="$IPC_DIR/${TS_MS}-${RAND}.json"
  cat > "${IPC_FILE}.tmp" <<EOF
{
  "type": "message",
  "chatJid": "$MAIN_JID",
  "text": "Fathom analyse auto terminee\n\nClient : $SLUG\nRecording : $RECORDING_ID\n\nSynthese dans : ~/agency-os/clients/$SLUG/memory.md",
  "sender": "fathom-auto-analyze",
  "groupFolder": "telegram_main",
  "timestamp": "$(date -u +%FT%TZ)"
}
EOF
  mv "${IPC_FILE}.tmp" "$IPC_FILE"
fi

exit 0
