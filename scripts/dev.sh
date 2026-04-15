#!/usr/bin/env bash
# Start Go API + Next.js for local development. Intended for: make dev
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

echo "🎯 DerivArena development stack"
echo ""

# Optional project .env (shell-compatible KEY=value lines)
set -a
if [[ -f "$ROOT/.env" ]]; then
  # shellcheck disable=SC1091
  source "$ROOT/.env"
fi
set +a

: "${DATABASE_URL:=postgresql://derivarena:derivarena@localhost:5432/derivarena}"
: "${PORT:=8090}"
: "${SHARE_BASE_URL:=http://localhost:3000}"
export DATABASE_URL PORT SHARE_BASE_URL

if [[ "${SKIP_DB:-}" != "1" ]]; then
  echo "Starting PostgreSQL and migrations..."
  make -C "$ROOT" db-up
  sleep 2
  make -C "$ROOT" db-migrate
fi

echo "Cleaning up old listeners on 8090 / 3000..."
lsof -ti:8090 2>/dev/null | xargs kill -9 2>/dev/null || true
lsof -ti:3000 2>/dev/null | xargs kill -9 2>/dev/null || true
rm -rf "$ROOT/frontend/.next/dev/lock" 2>/dev/null || true

echo ""
echo "📦 Go modules (cached after first run)..."
(cd "$ROOT/backend" && go mod download)

echo ""
echo "🚀 Starting backend on http://localhost:${PORT}/ ..."
cd "$ROOT/backend"
go run cmd/server/main.go > /tmp/derivarena-backend.log 2>&1 &
BACKEND_PID=$!
cd "$ROOT"

HEALTH_URL="http://localhost:${PORT}/health"
echo "   Waiting for /health (first compile can take 1–3 minutes)..."
backend_ok=
for _ in $(seq 1 180); do
  if curl -sf "$HEALTH_URL" > /dev/null; then
    backend_ok=1
    break
  fi
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo "❌ Backend exited before listening. Log:"
    tail -n 40 /tmp/derivarena-backend.log
    exit 1
  fi
  sleep 1
done

if [[ -n "$backend_ok" ]]; then
  echo "✅ Backend running (PID: $BACKEND_PID)"
else
  echo "❌ Backend did not respond on $HEALTH_URL in time. See: tail -f /tmp/derivarena-backend.log"
  kill "$BACKEND_PID" 2>/dev/null || true
  exit 1
fi

if [[ ! -d "$ROOT/frontend/node_modules" ]]; then
  echo ""
  echo "📦 Installing frontend dependencies..."
  (cd "$ROOT/frontend" && npm install --silent)
fi

echo ""
echo "🌐 Starting frontend on http://localhost:3000..."
cd "$ROOT/frontend"
export NEXT_PUBLIC_API_URL="http://localhost:${PORT}"
npm run dev -- -p 3000 > /tmp/derivarena-frontend.log 2>&1 &
FRONTEND_PID=$!
cd "$ROOT"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ DerivArena is running"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Frontend:  http://localhost:3000"
echo "  Backend:   http://localhost:${PORT}"
echo "  Health:    http://localhost:${PORT}/health"
echo ""
echo "  Logs:      tail -f /tmp/derivarena-backend.log"
echo "             tail -f /tmp/derivarena-frontend.log"
echo ""
echo "  Stop:      make stop   (or Ctrl+C here)"
echo ""

cleanup() {
  echo ""
  echo "Stopping services..."
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
  echo "Stopped."
  exit 0
}

trap cleanup INT TERM

wait
