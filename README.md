# DerivArena

🎯 A gamified trading competition platform for Deriv API Grand Prix 2026

Converts demo traders into depositors through competitive Sortino-ranked leaderboards, AI coaching, and strategic conversion nudges.

## Roadmap

- Plan and technical narrative: [docs/ROADMAP.md](docs/ROADMAP.md)
- **Humans + agents in the same competition** (integration plan, W/L compare, deploy path): [docs/HUMANS_AND_AGENTS.md](docs/HUMANS_AND_AGENTS.md)
- Master delivery checklist (all phases): [docs/PHASE_CHECKLIST.md](docs/PHASE_CHECKLIST.md)
- **Deriv V2 integration (agents / implementers):** [docs/DERIV_V2_API_IMPLEMENTATION.md](docs/DERIV_V2_API_IMPLEMENTATION.md)
- Deriv public WebSocket notes: [docs/DERIV_PUBLIC_WEBSOCKET.md](docs/DERIV_PUBLIC_WEBSOCKET.md)

## Quick Start

```bash
# Clone and setup
cd /Users/harshsolanki/Developer/own_github/derivarena

# Start everything (auto-installs deps)
make dev
```

Visit:
- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8090
- **Health Check:** http://localhost:8090/health (includes `marketdata` when `MARKETDATA_ENABLED=1`)

## Stack

- **Backend:** Go + Chi + PostgreSQL (port 8090)
- **Frontend:** Next.js 14 + React + Tailwind CSS (port 3000)
- **Database:** PostgreSQL 16 (port 5436, via Colima/Docker)

## Architecture

```
derivarena/
├── backend/
│   ├── cmd/server/main.go              # Entry point (+ optional MARKETDATA_* pipeline)
│   ├── internal/competition/           # Competition engine
│   │   ├── types.go                    # Domain models
│   │   ├── store.go                    # PostgreSQL layer
│   │   ├── service.go                  # HTTP API
│   │   └── sortino.go                  # Sortino calculation
│   ├── internal/derivcontract/         # Symbol map + proposal validation
│   ├── internal/marketdata/            # Collector, snapshots, phased ingest
│   ├── internal/marketdata/deriv/      # Deriv public WebSocket source
│   ├── internal/actionbus/             # Post-snapshot dispatch hooks
│   ├── internal/exchange/              # DerivClient (auth WS), sim stub
│   └── migrations/                     # DB schema
├── frontend/
│   ├── app/                            # Next.js pages (+ `/dashboard/paper-agent` lab)
│   ├── components/arena/               # Arena UI components
│   │   ├── ArenaLeaderboard.tsx
│   │   ├── LiveActivityTicker.tsx
│   │   ├── PortfolioPanel.tsx
│   │   └── XPProgressBar.tsx
│   ├── lib/agents/                     # Swarm + policy (ranked comps: POST trades via Go API)
│   ├── lib/paper/                      # Paper ledger (local until wired to competition)
│   └── lib/                            # Shared utilities and API helpers
└── Makefile
```

## API Endpoints

All endpoints prefixed with `/api/competitions`:

```bash
# Create competition
curl -X POST http://localhost:8090/api/competitions \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Weekend Challenge",
    "duration_hours": 48,
    "contract_types": ["CALL", "PUT"],
    "starting_balance": "10000"
  }'

# List competitions
curl http://localhost:8090/api/competitions

# Get competition details
curl http://localhost:8090/api/competitions/{id}

# Join competition
curl -X POST http://localhost:8090/api/competitions/{id}/join \
  -H "Content-Type: application/json" \
  -d '{
    "trader_id": "user123",
    "trader_name": "John Doe"
  }'

# Start competition
curl -X POST http://localhost:8090/api/competitions/{id}/start

# Get leaderboard (real-time SSE stream)
curl http://localhost:8090/api/competitions/{id}/leaderboard/stream

# End competition
curl -X POST http://localhost:8090/api/competitions/{id}/end
```

## Development

**Optional — public Deriv market data pipeline** (no OAuth required): set when running the API server:

| Variable | Default | Purpose |
|----------|---------|---------|
| `MARKETDATA_ENABLED` | off | Set `1` or `true` to start public WS collector + action bus |
| `MARKETDATA_INTERVAL_SEC` | `15` | Seconds between collection rounds (min `2`) |
| `MARKETDATA_SYMBOLS` | `VOL100-USD` | Comma-separated canonical pairs |
| `MARKETDATA_CANDLE_LIMIT` | `60` | Candles per round for the first symbol (max `1000`) |
| `MARKETDATA_INCLUDE_MARKETS` | off | Set `1` to fetch full `active_symbols` each round (heavy) |

```bash
# Backend only
make backend

# Frontend only (after backend is running)
make frontend

# Database management
make db-up        # Start PostgreSQL
make db-down      # Stop PostgreSQL
make db-migrate   # Run migrations
make db-rollback  # Rollback migrations

# Clean
make clean        # Remove build artifacts
```

## What's Implemented ✅

### Backend (100% Complete)
- ✅ Deriv market data ingestion layer (`derivcontract`, `marketdata`, `marketdata/deriv`, `actionbus`) — enable with `MARKETDATA_ENABLED=1`
- ✅ Competition CRUD (create, list, get, start, end)
- ✅ Participant management (join, list)
- ✅ Sortino ratio calculation
- ✅ Real-time leaderboard with SSE streaming
- ✅ PostgreSQL schema (5 tables: competitions, participants, trades, stats, conversion_events)
- ✅ Auto-end expired competitions
- ✅ Trade recording and P&L tracking
- ✅ Conversion event tracking

### Frontend
- ✅ Arena UI components
- ✅ Leaderboard component
- ✅ Portfolio panel
- ✅ XP progress bar
- ✅ Live activity ticker
- ✅ Tailwind theme
- ✅ Paper swarm lab: policy wizard, live public ticks, `lib/agents` + `lib/paper` (see [docs/HUMANS_AND_AGENTS.md](docs/HUMANS_AND_AGENTS.md) to wire bots into competitions)

## What's Next 🚀

### Phase 1: Wire Frontend (Priority 1)
- [x] Typed client: `frontend/lib/derivarena-api.ts` → `GET/POST /api/competitions`
- [x] List competitions: `/competitions`
- [x] Create competition form: `/create`
- [ ] Wire ArenaLeaderboard to SSE stream (`/api/competitions/:id/leaderboard/stream`)
- [ ] Join flow + Deriv V2 trading path
- [ ] Create partner competition creator

### Phase 2: Missing Backend Features
- [ ] Trade execution endpoint (`POST /api/competitions/:id/trade`) — shared by humans and agent workers
- [ ] Participant stats endpoint (+ win/loss breakdown for compare UI)
- [ ] Mock Deriv integration for demo
- [ ] Dual participants: `participant_kind`, bot join + worker ingest token — [docs/HUMANS_AND_AGENTS.md](docs/HUMANS_AND_AGENTS.md)

### Phase 3: Deriv V2 Integration
- [ ] OAuth PKCE flow UI
- [ ] OTP verification
- [ ] WebSocket management
- [ ] Real Deriv API trading

## Configuration

Edit `.env`:

```bash
# Database (using port 5436 to avoid conflicts)
DATABASE_URL=postgresql://derivarena:derivarena@localhost:5436/derivarena

# Backend
PORT=8090
BASE_URL=http://localhost:8090

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8090

# Deriv API V2 (optional)
DERIV_APP_ID=
DERIV_ACCESS_TOKEN=
DERIV_ACCOUNT_ID=
```

## Testing

```bash
# Test backend compilation
cd backend && go build cmd/server/main.go

# Test frontend build
cd frontend && npm run build

# Run unit tests
make test
```

## Deployment

### Backend → Railway/Fly.io
```bash
cd backend
fly launch
fly deploy
```

### Frontend → Vercel
```bash
cd frontend
vercel
```

## Business Model (From Hackathon Plan)

DerivArena solves 5 validated Deriv business problems:

1. **Signup→Deposit conversion** (currently 4%, target >10%)
2. **WhatsApp acquisition** (0 deposits from 16 real accounts)
3. **Partner activation** (stalled partners need activation tools)
4. **API V2 adoption** (developer-as-partner model)
5. **Fraud prevention** (18,915 fake accounts in 64 hours)

The conversion loop:
1. **JOIN** - Free demo competition
2. **TRADE** - Deriv exotic contracts
3. **RANK** - Sortino leaderboard
4. **CONVERT** - Demo→Real nudge at peak engagement
5. **RETURN** - New competitions

## License

MIT

## Team

Built for Deriv API Grand Prix 2026 by "It works, don't ask how"
