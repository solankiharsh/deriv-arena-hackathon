#!/usr/bin/env bash
# Apply the same schema + seeds as local `make db-migrate` to a remote Postgres (e.g. Railway).
# Runs: 010 competitions (if needed), 020 Deriv Miles (if needed), Trading Copilot catalog seed.
# Requires: psql locally, and DATABASE_URL with network access to the DB.
#
# Usage:
#   export DATABASE_URL='postgresql://...'   # Railway → Postgres → Connect → URI
#   ./scripts/migrate-railway.sh
#   # or: make db-migrate-railway
#
set -euo pipefail
if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Set DATABASE_URL to your Railway Postgres connection string, then re-run." >&2
  echo "Railway: Project → your Postgres service → Connect → copy URI" >&2
  exit 1
fi
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "$SCRIPT_DIR/db-migrate.sh"
