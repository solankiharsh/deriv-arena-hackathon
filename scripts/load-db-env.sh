#!/usr/bin/env bash
# Shared by psql-repo.sh, db-migrate.sh, ensure-020-deriv-miles.sh — same defaults as scripts/dev.sh.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
set -a
if [[ -f "$ROOT/.env" ]]; then
  # shellcheck disable=SC1091
  source "$ROOT/.env"
fi
set +a
: "${DATABASE_URL:=postgresql://derivarena:derivarena@localhost:5432/derivarena}"
export DATABASE_URL
