# DerivArena

🎯 A gamified trading competition platform for Deriv API Grand Prix 2026

Converts demo traders into depositors through competitive Sortino-ranked leaderboards, AI coaching, and strategic conversion nudges.

## AI agents: OpenClaw, MCP & Telegram

DerivArena ships an MCP stdio server (`mcp-client/derivarena-agent.js`) and an OpenClaw skill (`skills/derivarena-openclaw/SKILL.md`): agents discover data via tools, preview costs, ask the user to confirm, then execute side effects (Miles redemption or on-chain USDC) with explicit caps.

### Features

**OpenClaw skill (Telegram or any gateway-connected agent)**  
Install the `derivarena-openclaw` skill and register the MCP server in OpenClaw (see below). The agent can:

| Step | Miles catalog (in-app) | Competitions | On-chain (optional) |
|------|------------------------|--------------|---------------------|
| **Search** | e.g. "Find AI coaching in the catalog" → `arena_search_miles_catalog` | "Search competitions for weekend" → `arena_search_competitions` | — |
| **Preview** | `arena_preview_miles_redemption` — name, tier-adjusted miles cost, balance | `arena_get_competition` — details, `share_url` | — |
| **Confirm** | Ask: "Redeem **Advanced AI Coaching Session** for **200 miles**?" and wait for yes | Ask before `arena_join_competition` | Ask before `arena_onchain_send_usdc` |
| **Pay** | `arena_redeem_miles` with **`confirm: true`** only (honours `MAX_AUTO_MILES_REDEEM`) | Join is not a payment; still confirm with the user | USDC transfer only after confirmation (`MAX_AUTO_USDC_SEND` cap unless override) |
| **Deliver** | API returns redemption / fulfillment payload from `/api/miles/redeem` | Returns participant record and join context | Returns `txHash` + explorer link |

**In-app "wallet"**  
`arena_miles_balance` with a stable `user_id` is the analogue of "check my balance" for Deriv Miles (not ETH/USDC).

### CLI (`exec` / scripts)

From `mcp-client/` after `npm install`:

| Command | Maps to tool | Description |
|---------|----------------|-------------|
| `list-competitions` | `arena_list_competitions` | List competitions (optional `status`) |
| `search-competitions` | `arena_search_competitions` | Search by name keyword |
| `get-competition` | `arena_get_competition` | Get one competition by UUID |
| `join-competition` | `arena_join_competition` | Join as `trader_id` (POST) |
| `list-catalog` | `arena_list_miles_catalog` | Catalog with prices in miles (`user_id` optional for tier pricing) |
| `search-catalog` | `arena_search_miles_catalog` | Search catalog by keyword |
| `miles-balance` | `arena_miles_balance` | Miles balance + tier for `user_id` |
| `preview-redeem` | `arena_preview_miles_redemption` | Cost and affordability, no spend |
| `redeem` | `arena_redeem_miles` | Redeem only with `confirm: true` in JSON |
| `onchain-wallet` | `arena_onchain_wallet` | ETH + USDC (needs `WALLET_PRIVATE_KEY`) |
| `send-usdc` | `arena_onchain_send_usdc` | Send USDC with amount caps |

```bash
cd mcp-client && npm install
DERIVARENA_API_URL=http://localhost:8090 node derivarena-agent.js list-catalog '{}'
DERIVARENA_API_URL=http://localhost:8090 node derivarena-agent.js search-catalog '{"query":"AI"}'
```

Run `node derivarena-agent.js --help` for the full list.

### MCP server (Claude Desktop and other MCP hosts)

**11 tools** over Model Context Protocol (stdio):

| Tool | Description |
|------|-------------|
| `arena_list_competitions` | List trading competitions (status filter optional) |
| `arena_search_competitions` | Search competitions by name |
| `arena_get_competition` | Get competition by id (includes `share_url`) |
| `arena_join_competition` | Join a competition (`trader_id`, optional `trader_name`) |
| `arena_list_miles_catalog` | List redeemable catalog items and miles prices |
| `arena_search_miles_catalog` | Search catalog by keyword |
| `arena_miles_balance` | Miles balance and tier for `user_id` |
| `arena_preview_miles_redemption` | Preview miles cost and affordability |
| `arena_redeem_miles` | Redeem after user confirmation (`confirm: true`) |
| `arena_onchain_wallet` | ETH + configured ERC20 balance (e.g. USDC) |
| `arena_onchain_send_usdc` | Send USDC to an address (with caps) |

### OpenClaw setup (Telegram agent)

1. Copy the skill into your OpenClaw skills directory:

```bash
mkdir -p ~/.openclaw/skills/derivarena-openclaw
cp -r /path/to/derivarena/skills/derivarena-openclaw/* ~/.openclaw/skills/derivarena-openclaw/
```

2. Merge `mcpServers` from `openclaw-example.json` into your OpenClaw config. Use an **absolute** path in `args` to `derivarena-agent.js`.

3. Set `DERIVARENA_API_URL` to your API base (e.g. `http://localhost:8090`). Optionally set `WALLET_PRIVATE_KEY`, `X402_CHAIN`, `X402_CURRENCY`, `MAX_AUTO_MILES_REDEEM`, `MAX_AUTO_USDC_SEND`.

4. Start the gateway, for example:

```bash
openclaw gateway
```

5. Message the Telegram bot that is wired to that gateway (configure your own bot in OpenClaw; the handle is not defined by this repository).

More detail: `skills/derivarena-openclaw/SKILL.md`.

### Claude Desktop setup

Add an MCP server entry to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS). Adjust the path to match your clone:

```json
{
  "mcpServers": {
    "derivarena": {
      "command": "node",
      "args": ["/absolute/path/to/derivarena/mcp-client/derivarena-agent.js"],
      "env": {
        "DERIVARENA_API_URL": "http://localhost:8090",
        "WALLET_PRIVATE_KEY": "0x...",
        "X402_CHAIN": "base-sepolia",
        "X402_CURRENCY": "USDC",
        "MAX_AUTO_MILES_REDEEM": "5000",
        "MAX_AUTO_USDC_SEND": "10.00"
      }
    }
  }
}
```

Never commit real private keys; use local env or a secret store.

### Demo prompts

**Telegram / OpenClaw (natural language)**  
- "What's in the Miles catalog?" → lists catalog items with `final_cost` in miles.  
- "Search the catalog for AI" → `arena_search_miles_catalog`.  
- "Redeem Basic AI Trade Analysis for my user `trader-123`" → preview, then confirm, then `arena_redeem_miles` with `confirm: true`.  
- "What competitions are live or pending?" → `arena_list_competitions`.  
- "Check my on-chain wallet" → `arena_onchain_wallet` (requires key in MCP env).  
- "How many Miles does `trader-123` have?" → `arena_miles_balance`.

**Claude Desktop (MCP)**  
- "List all Miles catalog items from DerivArena" → `arena_list_miles_catalog`.  
- "Preview redeeming `ai_analysis_advanced` for user X" → `arena_preview_miles_redemption`.  
- "What's my configured wallet balance?" → `arena_onchain_wallet`.

## Roadmap

- Plan and technical narrative: [docs/ROADMAP.md](docs/ROADMAP.md)
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
│   ├── app/                            # Next.js pages
│   ├── components/arena/               # Arena UI components
│   │   ├── ArenaLeaderboard.tsx
│   │   ├── LiveActivityTicker.tsx
│   │   ├── PortfolioPanel.tsx
│   │   └── XPProgressBar.tsx
│   └── lib/                            # Shared utilities and API helpers
├── mcp-client/                         # MCP + CLI (OpenClaw / Claude Desktop)
├── skills/derivarena-openclaw/       # OpenClaw SKILL.md
├── openclaw-example.json               # Sample OpenClaw mcpServers block
└── Makefile
```

## API Endpoints

**Competitions** — base path `/api/competitions`:

**Deriv Miles** — base path `/api/miles` (balance, catalog, redeem, redemptions, and related routes). See `backend/internal/derivmiles/service.go` for the full list.

Competition examples:

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
- ✅ MCP + OpenClaw agent integration (`mcp-client/`, `skills/derivarena-openclaw/`, `openclaw-example.json`) — competitions, Miles catalog, redemption, optional on-chain wallet
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

## What's Next 🚀

### Phase 1: Wire Frontend (Priority 1)
- [x] Typed client: `frontend/lib/derivarena-api.ts` → `GET/POST /api/competitions`
- [x] List competitions: `/competitions`
- [x] Create competition form: `/create`
- [ ] Wire ArenaLeaderboard to SSE stream (`/api/competitions/:id/leaderboard/stream`)
- [ ] Join flow + Deriv V2 trading path
- [ ] Create partner competition creator

### Phase 2: Missing Backend Features
- [ ] Trade execution endpoint (`POST /api/competitions/:id/trade`)
- [ ] Participant stats endpoint
- [ ] Mock Deriv integration for demo

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
