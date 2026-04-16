#!/bin/bash
set -e

echo "🎯 DerivArena Quick Start"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
echo "Checking prerequisites..."

if ! command -v go &> /dev/null; then
    echo -e "${RED}❌ Go not found. Install from https://go.dev/dl/${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Go $(go version | awk '{print $3}')${NC}"

if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found. Install from https://nodejs.org/${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Node $(node --version)${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker not found. Install Colima or Docker Desktop${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Docker available${NC}"

echo ""
echo "Starting DerivArena..."
echo ""

# Start PostgreSQL
echo "1️⃣  Starting PostgreSQL on port 5436..."
if docker ps -a | grep -q derivarena-postgres; then
    docker start derivarena-postgres 2>/dev/null || true
else
    docker run -d --name derivarena-postgres \
        -e POSTGRES_USER=derivarena \
        -e POSTGRES_PASSWORD=derivarena \
        -e POSTGRES_DB=derivarena \
        -p 5436:5432 \
        postgres:16-alpine > /dev/null
fi
sleep 2
echo -e "${GREEN}✅ PostgreSQL running${NC}"

# Run migrations
echo ""
echo "2️⃣  Running database migrations..."
docker exec derivarena-postgres psql -U derivarena -d derivarena -tc "SELECT to_regclass('public.competitions')" | grep -q competitions || \
    docker exec -i derivarena-postgres psql -U derivarena -d derivarena < backend/migrations/010_competitions.up.sql > /dev/null
docker exec -i derivarena-postgres psql -U derivarena -d derivarena < backend/migrations/011_participant_kind.up.sql > /dev/null
echo -e "${GREEN}✅ Migrations complete (010 + 011)${NC}"

# Install frontend deps
echo ""
echo "3️⃣  Installing frontend dependencies..."
if [ ! -d "frontend/node_modules" ]; then
    cd frontend && npm install --silent && cd ..
    echo -e "${GREEN}✅ Frontend dependencies installed${NC}"
else
    echo -e "${YELLOW}⚠️  Frontend dependencies already installed${NC}"
fi

# Download Go deps
echo ""
echo "4️⃣  Downloading Go dependencies..."
cd backend && go mod download > /dev/null 2>&1 && cd ..
echo -e "${GREEN}✅ Go dependencies ready${NC}"

# Start backend
echo ""
echo "5️⃣  Starting backend on http://localhost:8090..."
cd backend
DATABASE_URL=postgresql://derivarena:derivarena@localhost:5436/derivarena \
PORT=8090 \
BASE_URL=http://localhost:8090 \
go run cmd/server/main.go > /tmp/derivarena-backend.log 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > /tmp/derivarena-backend.pid
cd ..

sleep 2

# Test backend
if curl -s http://localhost:8090/health > /dev/null; then
    echo -e "${GREEN}✅ Backend running (PID: $BACKEND_PID)${NC}"
else
    echo -e "${RED}❌ Backend failed to start. Check /tmp/derivarena-backend.log${NC}"
    exit 1
fi

# Start frontend
echo ""
echo "6️⃣  Starting frontend on http://localhost:3000..."
cd frontend
NEXT_PUBLIC_API_URL=http://localhost:8090 npm run dev > /tmp/derivarena-frontend.log 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID > /tmp/derivarena-frontend.pid
cd ..

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ DerivArena is running!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "🌐 Frontend:  http://localhost:3000"
echo "🔧 Backend:   http://localhost:8090"
echo "💚 Health:    http://localhost:8090/health"
echo ""
echo "📊 Test API:"
echo "   curl http://localhost:8090/api/competitions"
echo ""
echo "🛑 To stop:"
echo "   kill $BACKEND_PID $FRONTEND_PID"
echo "   docker stop derivarena-postgres"
echo ""
echo "📝 Logs:"
echo "   Backend:  tail -f /tmp/derivarena-backend.log"
echo "   Frontend: tail -f /tmp/derivarena-frontend.log"
echo ""
echo "Press Ctrl+C to stop all services..."

# Wait for Ctrl+C
trap "echo ''; echo 'Stopping...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; docker stop derivarena-postgres > /dev/null 2>&1; echo 'Stopped.'; exit" INT
wait
