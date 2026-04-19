#!/bin/bash
# Parler a Alfred depuis le terminal
# Usage: ./alfred.sh "ton message"
# Le message est injecte dans la DB comme si tu l'avais envoye sur WhatsApp

DB="$HOME/nanoclaw/store/messages.db"
JID=$(sqlite3 "$DB" "SELECT jid FROM registered_groups WHERE is_main = 1 LIMIT 1;")
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")
MSG_ID="terminal-$(date +%s)-$RANDOM"

if [ -z "$1" ]; then
  echo "Usage: ./alfred.sh \"ton message\""
  exit 1
fi

# Inserer le message dans la table messages
sqlite3 "$DB" "INSERT INTO messages (id, chat_jid, sender_jid, text, timestamp, is_from_me) VALUES ('$MSG_ID', '$JID', 'terminal', '$1', '$TIMESTAMP', 1);"

echo "Message envoye a Alfred : $1"
echo "Verifie les logs : tail -f ~/nanoclaw/logs/nanoclaw.log"
