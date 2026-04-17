#!/usr/bin/env bash
# Apply 010 (if needed), 020 miles schema (if needed), Copilot catalog seed — using DATABASE_URL like dev.sh.
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/load-db-env.sh"

PSQL_BIN="${PSQL:-}"
if [[ -z "$PSQL_BIN" || ! -x "$PSQL_BIN" ]]; then
  if [[ -x /opt/homebrew/opt/postgresql@16/bin/psql ]]; then
    PSQL_BIN=/opt/homebrew/opt/postgresql@16/bin/psql
  elif command -v psql >/dev/null 2>&1; then
    PSQL_BIN="$(command -v psql)"
  else
    echo "❌ psql not found. Set PSQL= to your psql binary." >&2
    exit 1
  fi
fi

has_comp="$("$PSQL_BIN" "$DATABASE_URL" -tAc \
  "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'competitions' LIMIT 1" \
  2>/dev/null | tr -d '[:space:]' || true)"

if [[ "$has_comp" == "1" ]]; then
  echo "✅ Database already migrated (competitions table present)"
else
  echo "📦 Applying 010_competitions.up.sql…"
  "$PSQL_BIN" "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$ROOT/backend/migrations/010_competitions.up.sql"
  echo "✅ Migrations complete"
fi

bash "$ROOT/scripts/ensure-020-deriv-miles.sh"

echo "📎 Applying Trading Copilot / marketplace miles catalog seed (idempotent)…"
"$PSQL_BIN" "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$ROOT/scripts/seed-trading-copilot-catalog.sql"
echo "✅ Miles catalog seed OK"
