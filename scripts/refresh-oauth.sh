#!/bin/bash
# Refresh CLAUDE_CODE_OAUTH_TOKEN.
# 1) Si le token keychain est encore valide (> 30 min restantes), on copie juste vers .env
# 2) Sinon, on appelle l'endpoint OAuth refresh d'Anthropic, on met a jour keychain ET .env
# Puis restart NanoClaw si .env a change.

set -euo pipefail

ENV_FILE="$(cd "$(dirname "$0")/.." && pwd)/.env"
KEYCHAIN_SERVICE="Claude Code-credentials"
CLIENT_ID="9d1c250a-e61b-44d9-88ed-5944d1962f5e"
REFRESH_THRESHOLD_SECONDS=1800   # refresh si < 30 min restantes

read_keychain() {
  security find-generic-password -s "$KEYCHAIN_SERVICE" -w 2>/dev/null
}

write_keychain() {
  local payload="$1"
  # -U updates the existing item; -s sets service name, -a sets account (kept identical to existing one).
  local account
  account=$(security find-generic-password -s "$KEYCHAIN_SERVICE" -g 2>&1 | awk -F'"' '/"acct"<blob>/ {print $4; exit}')
  security add-generic-password -U -s "$KEYCHAIN_SERVICE" -a "${account:-${USER}}" -w "$payload"
}

CREDS=$(read_keychain) || { echo "[refresh-oauth] No credentials in Keychain" >&2; exit 1; }

NEED_REFRESH=$(echo "$CREDS" | python3 -c "
import json, sys, time
d = json.load(sys.stdin)['claudeAiOauth']
exp_ms = d.get('expiresAt', 0)
exp_s = exp_ms / 1000 if exp_ms > 1e12 else exp_ms
remaining = exp_s - time.time()
print('yes' if remaining < $REFRESH_THRESHOLD_SECONDS else 'no')
")

if [ "$NEED_REFRESH" = "yes" ]; then
  echo "[refresh-oauth] Token expiring soon, calling Anthropic refresh endpoint..."
  REFRESH_TOKEN=$(echo "$CREDS" | python3 -c "import json,sys; print(json.load(sys.stdin)['claudeAiOauth']['refreshToken'])")
  PAYLOAD=$(printf '{"grant_type":"refresh_token","refresh_token":"%s","client_id":"%s"}' "$REFRESH_TOKEN" "$CLIENT_ID")

  # Retry 3x avec backoff exponentiel pour tolerer les coupures reseau transitoires.
  STATUS=""
  BODY=""
  for attempt in 1 2 3; do
    RESP=$(curl -sS --max-time 15 -w "\nHTTP_STATUS:%{http_code}" \
      "https://api.anthropic.com/v1/oauth/token" \
      -H "Content-Type: application/json" \
      -d "$PAYLOAD" 2>&1) || true
    STATUS=$(echo "$RESP" | grep -oE 'HTTP_STATUS:[0-9]+' | cut -d: -f2)
    BODY=$(echo "$RESP" | sed '/^HTTP_STATUS:/d')
    if [ "$STATUS" = "200" ]; then
      break
    fi
    # Ne pas retry sur erreurs client (4xx != 429) : refresh_token invalide
    if [ -n "$STATUS" ] && [ "$STATUS" -ge 400 ] && [ "$STATUS" -lt 500 ] && [ "$STATUS" != "429" ]; then
      echo "[refresh-oauth] Refresh rejected by server (HTTP $STATUS): $BODY" >&2
      echo "[refresh-oauth] Refresh token may be revoked. Manual re-login via Claude Code CLI required." >&2
      exit 1
    fi
    WAIT=$((2 ** attempt))
    echo "[refresh-oauth] Attempt $attempt failed (HTTP ${STATUS:-timeout}), retrying in ${WAIT}s..." >&2
    sleep $WAIT
  done
  if [ "$STATUS" != "200" ]; then
    echo "[refresh-oauth] Refresh failed after 3 attempts (HTTP ${STATUS:-no-response}): $BODY" >&2
    exit 1
  fi
  # Reconstruire le JSON keychain en preservant les champs non-token (scopes, subscriptionType, ...)
  NEW_CREDS=$(echo "$CREDS" | python3 -c "
import json, sys, time
existing = json.load(sys.stdin)
resp = json.loads('''$BODY''')
oauth = existing.get('claudeAiOauth', {})
oauth['accessToken'] = resp['access_token']
oauth['refreshToken'] = resp.get('refresh_token', oauth.get('refreshToken'))
oauth['expiresAt'] = int((time.time() + resp.get('expires_in', 28800)) * 1000)
existing['claudeAiOauth'] = oauth
print(json.dumps(existing))
")
  write_keychain "$NEW_CREDS" >/dev/null 2>&1
  CREDS="$NEW_CREDS"
  echo "[refresh-oauth] Keychain updated (new accessToken: $(echo "$NEW_CREDS" | python3 -c "import json,sys; print(json.load(sys.stdin)['claudeAiOauth']['accessToken'][:20])")...)"
fi

# Sync .env depuis le keychain (token courant)
TOKEN=$(echo "$CREDS" | python3 -c "import json,sys; print(json.load(sys.stdin)['claudeAiOauth']['accessToken'])")
CURRENT=$(grep "^CLAUDE_CODE_OAUTH_TOKEN=" "$ENV_FILE" 2>/dev/null | cut -d= -f2 || true)
if [ "$CURRENT" = "$TOKEN" ]; then
  echo "[refresh-oauth] Token unchanged, skipping restart"
  exit 0
fi
if grep -q "^CLAUDE_CODE_OAUTH_TOKEN=" "$ENV_FILE" 2>/dev/null; then
  sed -i '' "s|^CLAUDE_CODE_OAUTH_TOKEN=.*|CLAUDE_CODE_OAUTH_TOKEN=${TOKEN}|" "$ENV_FILE"
else
  echo "CLAUDE_CODE_OAUTH_TOKEN=${TOKEN}" >> "$ENV_FILE"
fi
echo "[refresh-oauth] Token changed, restarting NanoClaw..."
if ! launchctl kickstart -k "gui/$(id -u)/com.nanoclaw" 2>&1; then
  echo "[refresh-oauth] ERROR: launchctl kickstart failed. Service state:" >&2
  launchctl print "gui/$(id -u)/com.nanoclaw" 2>&1 | head -20 >&2 || \
    echo "[refresh-oauth] Service not loaded. Load via: launchctl bootstrap gui/\$(id -u) ~/Library/LaunchAgents/com.nanoclaw.plist" >&2
  exit 1
fi
# Verify the daemon actually respawned with the new token
sleep 3
if ! pgrep -f "nanoclaw/dist/index.js" >/dev/null; then
  echo "[refresh-oauth] ERROR: NanoClaw not running 3s after kickstart" >&2
  exit 1
fi
echo "[refresh-oauth] Done (${TOKEN:0:20}...)"
