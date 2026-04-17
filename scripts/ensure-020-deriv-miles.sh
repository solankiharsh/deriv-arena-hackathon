#!/usr/bin/env bash
# Apply backend/migrations/020_deriv_miles.up.sql once when deriv_miles_catalog is missing.
# Uses same defaults as the Makefile (override with DB_HOST, DB_PORT, DB_USER, DB_NAME, PSQL).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PSQL="${PSQL:-}"
if [[ -z "$PSQL" || ! -x "$PSQL" ]]; then
  if [[ -x /opt/homebrew/opt/postgresql@16/bin/psql ]]; then
    PSQL=/opt/homebrew/opt/postgresql@16/bin/psql
  elif command -v psql >/dev/null 2>&1; then
    PSQL="$(command -v psql)"
  else
    echo "❌ psql not found. Set PSQL= to your psql binary." >&2
    exit 1
  fi
fi
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-derivarena}"
DB_NAME="${DB_NAME:-derivarena}"

exists="$("$PSQL" -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc \
  "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'deriv_miles_catalog'" \
  2>/dev/null | tr -d '[:space:]' || true)"

if [[ "$exists" == "1" ]]; then
  echo "✅ deriv_miles_catalog already exists"
  exit 0
fi

echo "📦 Applying backend/migrations/020_deriv_miles.up.sql (first-time miles schema)…"
"$PSQL" -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 \
  -f "$ROOT/backend/migrations/020_deriv_miles.up.sql"
echo "✅ Deriv Miles schema (020) applied"
