#!/bin/bash
# Health check cascade NanoClaw.
# Verifie chaque couche de la stack dans l'ordre : Docker -> Process -> IPC -> DB -> Fraicheur.
# Codes retour types pour integration /jarvis et diagnostics rapides.
#
# Exit codes:
# 0 = tout OK
# 1 = Docker daemon down (NanoClaw a besoin de Docker pour lancer des agents)
# 2 = Process NanoClaw (node) down
# 3 = IPC absent ou non-writable
# 4 = DB inaccessible ou corrompue
# 5 = Socket WA stale (creds.json non rotate depuis > 24h -> session probablement morte)
#
# Note : NanoClaw cree des containers dynamiques (nanoclaw-*) a la demande,
# pas de container permanent a verifier. Docker doit juste etre pret.
# Compatible macOS (pas de coreutils timeout).
#
# Historique : le check 5 initialement base sur "dernier message stocke < 24h"
# produisait des faux positifs (Lucas passe un week-end sans pinger Alfred = canal
# flaggue "dormant" a tort). Remplace par mtime creds.json qui reflete la rotation
# Baileys a chaque handshake/creds.update, vrai signal de sante socket WA.
# Fix 2026-04-16 post smoke-test T6.

set +e

NC_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DB_PATH="${NC_DIR}/store/messages.db"
IPC_DIR="${NC_DIR}/data/ipc"
WA_CREDS="${NC_DIR}/store/auth/creds.json"

# 1. Docker daemon up (prerequis pour lancer des agents containerises)
/usr/local/bin/docker info > /dev/null 2>&1 || exit 1

# 2. Process NanoClaw (node dist/index.js) actif
pgrep -f "nanoclaw/dist/index.js" > /dev/null 2>&1 || exit 2

# 3. IPC accessible (dossier data/ipc existe et writable)
[ -d "$IPC_DIR" ] && [ -w "$IPC_DIR" ] || exit 3

# 4. DB accessible (store/messages.db = source verite messages)
sqlite3 "$DB_PATH" "SELECT 1" > /dev/null 2>&1 || exit 4

# 5. Socket WA vivant (creds.json rotate < 24h)
# Baileys met a jour creds.json a chaque handshake/creds.update event.
# mtime frais = socket actif, rotation en cours. mtime > 24h = session probablement morte.
# Skip silencieux si WA non configure (pas de creds.json = pas de canal WA a monitorer).
if [ -f "$WA_CREDS" ]; then
  CREDS_EPOCH=$(stat -f %m "$WA_CREDS" 2>/dev/null)
  if [ -n "$CREDS_EPOCH" ]; then
    NOW=$(date +%s)
    AGE=$((NOW - CREDS_EPOCH))
    [ $AGE -lt 86400 ] || exit 5
  fi
fi

exit 0
