#!/bin/bash
set -e

echo "🎯 DerivArena Development Server"
echo ""

# Load environment
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    exit 1
fi

export $(cat .env | grep -v '^#' | xargs)

# Check PostgreSQL
if ! docker ps | grep -q derivarena-postgres; then
    echo "Starting PostgreSQL..."
    make db-up
    sleep 2
    make db-migrate
fi

# Kill any existing processes
echo "Cleaning up old processes..."
lsof -ti:8090 2>/dev/null | xargs kill -9 2>/dev/null || true
lsof -ti:3000 2>/dev/null | xargs kill -9 2>/dev/null || true
rm -rf frontend/.next/dev/lock 2>/dev/null || true

# Start backend
echo ""
echo "🚀 Starting backend on http://localhost:8090..."
cd backend
go run cmd/server/main.go > /tmp/derivarena-backend.log 2>&1 &
BACKEND_PID=$!
cd ..
sleep 2

# Test backend
if curl -s http://localhost:8090/health > /dev/null; then
    echo "✅ Backend running (PID: $BACKEND_PID)"
else
    echo "❌ Backend failed to start. Check /tmp/derivarena-backend.log"
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
fi

# Install frontend deps if needed
if [ ! -d "frontend/node_modules" ]; then
    echo ""
    echo "📦 Installing frontend dependencies..."
    cd frontend && npm install --silent && cd ..
fi

# Start frontend
echo ""
echo "🌐 Starting frontend on http://localhost:3000..."
cd frontend
export NEXT_PUBLIC_API_URL=http://localhost:8090
npm run dev -- -p 3000 > /tmp/derivarena-frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ DerivArena is running!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🌐 Frontend:  http://localhost:3000"
echo "🔧 Backend:   http://localhost:8090"
echo "💚 Health:    http://localhost:8090/health"
echo ""
echo "📝 Logs:"
echo "   Backend:  tail -f /tmp/derivarena-backend.log"
echo "   Frontend: tail -f /tmp/derivarena-frontend.log"
echo ""
echo "🛑 To stop:"
echo "   kill $BACKEND_PID $FRONTEND_PID"
echo "   Or just close this terminal"
echo ""
echo "Press Ctrl+C to stop all services..."

# Cleanup on exit
cleanup() {
    echo ""
    echo "Stopping services..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
    echo "Stopped."
    exit 0
}

trap cleanup INT TERM

# Keep running
wait
