#!/usr/bin/env bash
# Apply backend/migrations/020_deriv_miles.up.sql once when deriv_miles_catalog is missing.
# Uses DATABASE_URL (from repo .env if present) — same connection as scripts/dev.sh / Go API.
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

exists="$("$PSQL_BIN" "$DATABASE_URL" -tAc \
  "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'deriv_miles_catalog'" \
  2>/dev/null | tr -d '[:space:]' || true)"

if [[ "$exists" == "1" ]]; then
  echo "✅ deriv_miles_catalog already exists"
  exit 0
fi

echo "📦 Applying backend/migrations/020_deriv_miles.up.sql (first-time miles schema)…"
"$PSQL_BIN" "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f "$ROOT/backend/migrations/020_deriv_miles.up.sql"
echo "✅ Deriv Miles schema (020) applied"
