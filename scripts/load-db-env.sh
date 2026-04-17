#!/usr/bin/env bash
# Shared by psql-repo.sh, db-migrate.sh, ensure-020-deriv-miles.sh — same defaults as scripts/dev.sh.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
# If the caller already set DATABASE_URL (e.g. Railway / CI), do not let repo `.env` override it.
if [[ -n "${DATABASE_URL:-}" ]]; then
  _CALLER_DATABASE_URL="$DATABASE_URL"
fi
set -a
if [[ -f "$ROOT/.env" ]]; then
  # shellcheck disable=SC1091
  source "$ROOT/.env"
fi
set +a
if [[ -n "${_CALLER_DATABASE_URL:-}" ]]; then
  export DATABASE_URL="$_CALLER_DATABASE_URL"
  unset _CALLER_DATABASE_URL
else
  : "${DATABASE_URL:=postgresql://derivarena:derivarena@localhost:5432/derivarena}"
  export DATABASE_URL
fi
