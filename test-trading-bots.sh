#!/usr/bin/env bash
# End-to-end smoke test for the AI Auto-Trading Bot Command Center.
#
# Requirements:
#   - Backend running on $API (default http://localhost:8090)
#   - jq installed
#
# Usage: ./test-trading-bots.sh

set -euo pipefail

API="${API:-http://localhost:8090}"
USER_ID="${USER_ID:-test-user-bots}"

say() { printf "\n\033[1;33m▶ %s\033[0m\n" "$*"; }
ok()  { printf "\033[1;32m✓ %s\033[0m\n" "$*"; }
fail() { printf "\033[1;31m✗ %s\033[0m\n" "$*"; exit 1; }

command -v jq >/dev/null 2>&1 || fail "jq is required"

say "1. Create bot"
CREATE_BODY=$(cat <<JSON
{
  "user_id": "${USER_ID}",
  "name": "Smoke Test Bot",
  "execution_mode": "paper",
  "config": {
    "riskProfile": "moderate",
    "marketSelection": ["VOL100-USD"],
    "contractTypes": ["CALL","PUT"],
    "indicators": { "technical": ["rsi","macd"], "aiPatterns": false, "newsWeight": 0.2 },
    "execution": { "stakeAmount": 10, "maxDailyTrades": 5, "stopLossPercent": 5, "takeProfitPercent": 10 },
    "newsFilters": [],
    "timeRestrictions": { "enabled": false, "startHour": 9, "endHour": 17 },
    "enabledFeeds": { "deriv_ticks": true, "sentiment": true, "pattern": true, "partner": true }
  }
}
JSON
)

CREATE_RESP=$(curl -sS -X POST "${API}/api/bots/" \
  -H 'Content-Type: application/json' \
  -d "${CREATE_BODY}")
echo "$CREATE_RESP" | jq .

BOT_ID=$(echo "$CREATE_RESP" | jq -r '.data.id // .id // empty')
[[ -n "$BOT_ID" && "$BOT_ID" != "null" ]] || fail "Could not extract bot id"
ok "Created bot $BOT_ID"

say "2. List bots"
curl -sS "${API}/api/bots/?user_id=${USER_ID}" | jq '.data // .' | head -50
ok "Listed bots"

say "3. Start bot"
curl -sS -X POST "${API}/api/bots/${BOT_ID}/start?user_id=${USER_ID}" | jq .
ok "Started bot"

say "4. Wait 8 seconds for simulated trades to occur..."
sleep 8

say "5. Fetch analytics"
curl -sS "${API}/api/bots/${BOT_ID}/analytics?user_id=${USER_ID}" | jq .

say "6. Fetch trades"
curl -sS "${API}/api/bots/${BOT_ID}/trades?user_id=${USER_ID}&limit=10" | jq '.data // .'

say "7. Fetch signals"
curl -sS "${API}/api/bots/${BOT_ID}/signals?user_id=${USER_ID}&limit=5" | jq '.data // .'

say "8. Pause bot"
curl -sS -X POST "${API}/api/bots/${BOT_ID}/pause?user_id=${USER_ID}" | jq .
ok "Paused bot"

say "9. Resume bot"
curl -sS -X POST "${API}/api/bots/${BOT_ID}/resume?user_id=${USER_ID}" | jq .
ok "Resumed bot"

say "10. Stop bot"
curl -sS -X POST "${API}/api/bots/${BOT_ID}/stop?user_id=${USER_ID}" | jq .
ok "Stopped bot"

say "11. Toggle feed off/on"
curl -sS -X POST "${API}/api/bots/${BOT_ID}/feed/sentiment/toggle?user_id=${USER_ID}" \
  -H 'Content-Type: application/json' -d '{"enabled":false}' | jq .
curl -sS -X POST "${API}/api/bots/${BOT_ID}/feed/sentiment/toggle?user_id=${USER_ID}" \
  -H 'Content-Type: application/json' -d '{"enabled":true}' | jq .

say "12. Delete bot"
curl -sS -X DELETE "${API}/api/bots/${BOT_ID}?user_id=${USER_ID}" | jq .
ok "Deleted bot"

printf "\n\033[1;32mAll trading-bot smoke tests passed.\033[0m\n"
