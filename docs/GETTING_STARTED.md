# Getting Started with DerivArena

## Prerequisites

- Go 1.21+
- Node.js 18+ (use **Node 21+** if you run `scripts/explore-deriv-v2-api.mjs`, which needs global `WebSocket`)
- Docker (via Colima on macOS)
- Make

## Deriv API V2 (for integrators)

If you are implementing trading or market data against Deriv API V2, read **[DERIV_V2_API_IMPLEMENTATION.md](./DERIV_V2_API_IMPLEMENTATION.md)**. It links the official docs, explains PAT vs OAuth, documents the OTP WebSocket URL flow, and points to:

- `scripts/explore-deriv-v2-api.mjs` — full REST + public + authenticated WebSocket probe (requires `DERIV_PAT` and optionally `DERIV_APP_ID` in the environment; never commit tokens)
- `scripts/verify-deriv-public-ws.mjs` — short public WebSocket-only check

## Installation

### 1. Verify Setup

```bash
# Check tools
go version        # Should be 1.21+
node --version    # Should be 18+
docker ps         # Should show running containers
```

### 2. Start Development

```bash
cd /Users/harshsolanki/Developer/own_github/derivarena

# This will:
# - Start PostgreSQL on port 5436
# - Run database migrations
# - Install frontend dependencies
# - Start backend on :8090
# - Start frontend on :3000
make dev
```

### 3. Verify It Works

Open three terminals:

**Terminal 1 - Backend health:**
```bash
curl http://localhost:8090/health
# Expected: {"status":"ok","service":"derivarena"}
```

**Terminal 2 - Create test competition:**
```bash
curl -X POST http://localhost:8090/api/competitions \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Competition",
    "duration_hours": 24,
    "contract_types": ["CALL", "PUT"],
    "starting_balance": "1000"
  }'
# Expected: JSON with competition details
```

**Terminal 3 - Frontend:**
```bash
open http://localhost:3000
```

## Manual Setup (If `make dev` Fails)

### Start PostgreSQL
```bash
docker run -d --name derivarena-postgres \
  -e POSTGRES_USER=derivarena \
  -e POSTGRES_PASSWORD=derivarena \
  -e POSTGRES_DB=derivarena \
  -p 5436:5432 \
  postgres:16-alpine
```

### Run Migrations
```bash
docker exec -i derivarena-postgres psql -U derivarena -d derivarena < backend/migrations/010_competitions.up.sql
```

### Start Backend
```bash
cd backend
DATABASE_URL=postgresql://derivarena:derivarena@localhost:5436/derivarena \
PORT=8090 \
BASE_URL=http://localhost:8090 \
go run cmd/server/main.go
```

### Start Frontend
```bash
cd frontend
npm install
NEXT_PUBLIC_API_URL=http://localhost:8090 npm run dev
```

## Common Issues

### Port 5436 Already in Use
```bash
# Stop existing container
docker stop derivarena-postgres
docker rm derivarena-postgres

# Or use a different port
docker run -d --name derivarena-postgres \
  -e POSTGRES_USER=derivarena \
  -e POSTGRES_PASSWORD=derivarena \
  -e POSTGRES_DB=derivarena \
  -p 5437:5432 \
  postgres:16-alpine

# Update .env accordingly
DATABASE_URL=postgresql://derivarena:derivarena@localhost:5437/derivarena
```

### Backend Won't Start
```bash
# Check logs
tail -f /tmp/derivarena-backend.log

# Kill any orphaned processes
lsof -ti:8090 | xargs kill -9
```

### Frontend Build Errors
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

### Database Migration Errors
```bash
# Check tables
docker exec derivarena-postgres psql -U derivarena -d derivarena -c "\dt"

# Rollback and retry
make db-rollback
make db-migrate
```

## Next Steps

Once everything is running:

1. **Test the backend API** - See `README.md` for curl examples
2. **Wire the frontend** - Create `frontend/lib/api.ts` to connect components
3. **Build pages** - Create landing page, arena view, competition creator
4. **Add Deriv integration** - Implement OAuth PKCE flow

## Development Workflow

```bash
# Terminal 1: Backend logs
cd backend
DATABASE_URL=postgresql://derivarena:derivarena@localhost:5436/derivarena \
go run cmd/server/main.go

# Terminal 2: Frontend dev server
cd frontend
npm run dev

# Terminal 3: Testing
curl http://localhost:8090/api/competitions
```

## Need Help?

Check:
- `README.md` - Full documentation
- `backend/cmd/server/main.go` - Backend entry point
- `backend/internal/competition/service.go` - API endpoints
- `frontend/components/arena/` - UI components
