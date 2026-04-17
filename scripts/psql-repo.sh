#!/usr/bin/env bash
# Run psql against DATABASE_URL (from repo .env if present). Matches backend / dev.sh connection.
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

exec "$PSQL_BIN" "$DATABASE_URL" -v ON_ERROR_STOP=1 "$@"
