# DerivArena

🎯 A gamified trading competition platform for Deriv API Grand Prix 2026

Converts demo traders into depositors through competitive Sortino-ranked leaderboards, AI coaching, and strategic conversion nudges.

## Docs & roadmap

| Doc | Purpose |
| --- | ------- |
| [docs/DEMO_WALKTHROUGH.md](docs/DEMO_WALKTHROUGH.md) | **Live demo** — pre-flight checklist, scene-by-scene walkthrough, Q&A cheat sheet, fallbacks |
| [docs/YOUTUBE_VIDEO_SCRIPT.md](docs/YOUTUBE_VIDEO_SCRIPT.md) | **Recorded pitch** — shot list, full narration script, B-roll, thumbnails |
| [docs/DERIV_MILES_README.md](docs/DERIV_MILES_README.md) | Deriv Miles system (schema, APIs, redemption) |
| [docs/DERIV_MILES_QUICKSTART.md](docs/DERIV_MILES_QUICKSTART.md) | Miles quick start |
| [docs/TEAM_GIT_BRANCHING.md](docs/TEAM_GIT_BRANCHING.md) | Branching / PR conventions for collaborators |
| [docs/VIBE_CODING_DOCS.md](docs/VIBE_CODING_DOCS.md) | Internal build notes |

The phased delivery narrative lives in **What's Next — Phased Delivery** below. Additional long-form roadmap files may be added under `docs/` as the repo evolves.

### Pull requests (GitHub)

Open PRs with **base `newaddons`**, not `main`, unless you have realigned `main` with this codebase. On this fork, `main` can be a **separate root** (unrelated commit history), so GitHub shows *“There isn’t anything to compare”* / *entirely different commit histories* when you compare `main` ↔ feature branches that grew from `newaddons` (or the same arena lineage).

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
- **Frontend:** Next.js 16 + React + Tailwind CSS (port 3000)
- **Database:** PostgreSQL 16 (default **5432** in `Makefile`; use **5436** or another port if you prefer — keep `DATABASE_URL` aligned everywhere, see [Configuration](#configuration))

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

## What's Next — Phased Delivery

DerivArena was not built as one drop. It shipped in deliberate phases so each
layer was validated in production before the next one started. Each phase lists
its focus, deliverables, and why that work had to come first.

### Phase 0 — Foundation — Shipped
- **Focus:** a reproducible dev environment and a safe schema we would not
  have to re-migrate.
- **Deliverables:**
  - [x] `make dev` end-to-end bring-up (Postgres + Go API + Next.js)
  - [x] Versioned SQL migrations + idempotent bootstrap in `backend/cmd/server/main.go`
  - [x] Lint / typecheck / build in CI for both services
- **Why first:** every later phase assumes a clean local loop and a stable
  schema. Cutting corners here costs weeks later.

### Phase 1 — Core Arena MVP — Shipped
- **Focus:** prove the thesis that Sortino-ranked, real-time competition is
  more engaging than solo demo trading.
- **Deliverables:**
  - [x] Typed arena API client (`frontend/lib/arena-api.ts`)
  - [x] Competition CRUD + join flow
  - [x] Sortino-based scoring (`backend/internal/competition/sortino.go`)
  - [x] SSE leaderboard stream (`/api/competitions/:id/leaderboard/stream`)
- **Why this phase:** no gamification lands unless the core loop —
  join → trade → rank — feels real-time and fair.

### Phase 2 — Gamified Modes — Shipped
- **Focus:** turn the single "trade and rank" loop into a family of modes so
  different trader archetypes stay engaged.
- **Deliverables:**
  - [x] Classic Arena, Boxing Ring, War Room
  - [x] Phantom League (five simulated archetypes)
  - [x] Anti-You (decoy trades, behavioral mirror)
  - [x] Behavioral X-Ray (tilt scoring, rule-break detection)
- **Why this phase:** retention beyond day-1 needs variety. One mode is a
  feature, six modes is a platform.

### Phase 3 — Conversion Engine — Shipped
- **Focus:** monetize engagement without poisoning the UX — the hackathon
  thesis was "demo → deposit conversion", not "show more ads".
- **Deliverables:**
  - [x] Percentile threshold nudges (one per tier per session, idempotent)
  - [x] AI coach + branched counterfactual timelines
  - [x] XP and rank progression
  - [x] Live activity ticker + portfolio panel
- **Why this phase:** the business case lives or dies here. Conversion prompts
  that interrupt flow would kill retention.

### Phase 4 — Partner & Admin tooling — Shipped
- **Focus:** let partners and internal admins operate the platform without
  engineering in the loop.
- **Deliverables:**
  - [x] Partner competition creator
  - [x] Referral attribution + conversion events schema
  - [x] Funnel analytics dashboard (`/admin/funnel`)
  - [x] Template authoring UI for arena modes
- **Why this phase:** every hour spent hand-holding a partner is an hour not
  spent on product. Self-serve tooling compounds.

### Phase 5 — Deriv V2 live trading — Shipped
- **Focus:** graduate the winning simulated traders into real-money accounts
  with the same UX surface.
- **Deliverables:**
  - [x] OAuth PKCE flow UI
  - [x] OTP verification
  - [x] Authenticated Deriv WebSocket session management
  - [x] Real-money contract execution with idempotency + audit log
- **Why this phase:** we deliberately proved engagement and conversion before
  touching real money. Shipping live trading earlier would have mixed product
  risk with regulatory risk.

### Phase 6 — Post-launch ops — Planned
- **Focus:** make DerivArena boring to run.
- **Deliverables:**
  - [ ] Observability (structured logs, traces, RED metrics per endpoint)
  - [ ] Rate limiting on arena + auth endpoints
  - [ ] Dependency + CVE scanning in CI
  - [ ] SLO dashboards + alerting for SSE fan-out and DB saturation
- **Why this phase:** the job after "it ships" is "it stays shipped".

## Configuration

Copy the templates and fill in values (never commit real secrets):

| File | Purpose |
|------|---------|
| [`.env.example`](.env.example) | Root template for Postgres URL, Go API, JWT, Deriv IDs |
| [`frontend/.env.example`](frontend/.env.example) | Next.js: `DATABASE_URL`, `OPENAI_API_KEY`, auth, public URLs |

Minimal root `.env` for local `make dev`:

```bash
# Database — must match frontend/.env.local DATABASE_URL when using Trading Copilot
DATABASE_URL=postgresql://derivarena:derivarena@localhost:5432/derivarena

# Backend
PORT=8090
BASE_URL=http://localhost:8090

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8090

# Deriv API V2 (optional)
DERIV_APP_ID=
DERIV_ACCESS_TOKEN=
DERIV_ACCOUNT_ID=

# JWT for session cookies (required for signed-in flows)
JWT_SECRET=change-me-in-development-only
```

### Trading Copilot (OpenAI + entitlements)

1. **Redeem** “Trading Copilot” (or a bundle that grants credits) in **Marketplace** so Postgres has a row in `deriv_trading_copilot_entitlements`.
2. In **`frontend/.env.local`** (copy from `frontend/.env.example`):
   - **`OPENAI_API_KEY`** — required; without it the chat API returns 503 with a clear message.
   - **`DATABASE_URL`** — same database URL you use for `make db-migrate` / `make db-seed-trading-copilot` so credit decrement and entitlement checks hit the same instance.
   - Optional: **`TRADING_COPILOT_MODEL`** (defaults to `gpt-4o-mini`).
3. Restart **`npm run dev`** after changing env vars.

Migrations and catalog seed use **`scripts/load-db-env.sh`**: they load the repo root `.env` and run `psql` with `DATABASE_URL`, matching `scripts/dev.sh` so you do not seed one Postgres while the app reads another.

### Required vs optional (local dev)

| Variable | Where | Required for |
|----------|--------|----------------|
| `DATABASE_URL` | root `.env` + `frontend/.env.local` | Miles, marketplace redemption metadata, **Trading Copilot entitlements** |
| `OPENAI_API_KEY` | `frontend/.env.local` | **Trading Copilot** chat streaming |
| `JWT_SECRET` | `frontend/.env.local` (and root if tooling signs cookies) | Signed session / auth |
| `DERIV_APP_ID` / tokens | optional until OAuth/live trading | Deriv OAuth flows |
| `PRIVY_*` | optional | Privy auth when enabled |

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

## Hackathon submission — collaborator checklist

Use this **before** you freeze the repo for the Deriv API Grand Prix submission.
Primary references: [docs/DEMO_WALKTHROUGH.md](docs/DEMO_WALKTHROUGH.md) and
[docs/YOUTUBE_VIDEO_SCRIPT.md](docs/YOUTUBE_VIDEO_SCRIPT.md).

### Everyone (shared)

- [ ] **Prod smoke test** — `https://deriv-arena-hackathon-beta.vercel.app` loads; sign in with Deriv OAuth; no `login?error=` in the URL after a clean flow.
- [ ] **Backend health** — `https://deriv-arena-hackathon-production.up.railway.app/health` returns `"status":"ok"`.
- [ ] **Deriv stream pill** — bottom-right shows **Deriv Live** (green) when logged in; if amber, re-login and confirm `NEXT_PUBLIC_DERIV_LEGACY_WS_APP_ID` if needed.
- [ ] **Miles + Marketplace** — `/miles` shows balance; `/marketplace` prices match DB (run `frontend/scripts/seed-marketplace-catalog.mjs` against prod DB if catalog rows are missing).
- [ ] **CORS** — Railway `CORS_ORIGINS` includes the Vercel production hostname (otherwise Marketplace balance stays `0` in the browser).
- [ ] **Secrets** — no `.env`, tokens, or `DATABASE_URL` in screen recordings or public README edits.
- [ ] **Submission package** — submission form link, demo URL, repo URL, and one-line pitch are copied into a single doc or Slack pin.

### Random task assignment (for collaborators)

1. **List everyone** who is responsible for pre-submission work (first names or GitHub handles). Example: `Alice Bob Carol Dave`.
2. **Copy the task pool** from the table below (one line per task).
3. **Shuffle and assign** from your repo root (macOS/Linux — requires `bash`):

```bash
# Edit NAMES and TASKS, then run:
NAMES=(Alice Bob Carol Dave)
TASKS=(
  "Infra: verify Railway + Vercel env vars + health endpoints"
  "Infra: run marketplace catalog seed on prod DB if needed"
  "QA: full DEMO_WALKTHROUGH Scene 1–4 (home → arena → trade)"
  "QA: full DEMO_WALKTHROUGH Scene 5–8 (dashboard → copilot → miles → modal)"
  "QA: OAuth clean sign-in + session cookies (no state_mismatch)"
  "Video: record B-roll pack (YOUTUBE_VIDEO_SCRIPT B-roll section)"
  "Video: record main narration OR assemble cut from script"
  "Docs: proofread README + submission links; fix any broken doc links"
  "MCP: verify Telegram/OpenClaw demo still answers miles/catalog questions"
  "Git: clean working tree; meaningful commit message; tag release candidate"
  "Submission: fill hackathon form + attach video + repo + demo URL"
  "Backup: export last 1h Railway logs after final demo run"
)

paste <(printf '%s\n' "${TASKS[@]}" | shuf) <(while true; do for n in "${NAMES[@]}"; do echo "$n"; done; done | head -n "${#TASKS[@]}") | column -t -s $'\t'
```

Each row pairs **one shuffled task** with **one rotating assignee**. Re-run the
command if two people get the same heavy block back-to-back and you want a
fairer split.

### Task pool (copy into `TASKS=( ... )` above)

| # | Task |
| - | ---- |
| 1 | **Infra** — Confirm Vercel env: `NEXT_PUBLIC_BASE_URL`, `NEXT_PUBLIC_API_URL`, `DATABASE_URL`, `JWT_SECRET`, `OPENAI_API_KEY`, Deriv app IDs. |
| 2 | **Infra** — Confirm Railway: `CORS_ORIGINS`, `DATABASE_URL`, `DERIV_APP_ID`; redeploy backend after env edits. |
| 3 | **DB** — Run `frontend/scripts/seed-marketplace-catalog.mjs` on production Postgres if marketplace SKUs are missing or prices drift. |
| 4 | **QA** — Walk [docs/DEMO_WALKTHROUGH.md](docs/DEMO_WALKTHROUGH.md) Scenes 1–4 on production. |
| 5 | **QA** — Walk DEMO_WALKTHROUGH Scenes 5–8 + MCP/Telegram scene. |
| 6 | **QA** — Fresh-account path: new OAuth user earns Quick Wins on `/miles` after join + live-score + finalize + share. |
| 7 | **Auth** — One cold-browser OAuth run; confirm cookies set on `/api/auth/deriv` redirect; no `session_expired` / `state_mismatch`. |
| 8 | **Video** — Capture B-roll list from [docs/YOUTUBE_VIDEO_SCRIPT.md](docs/YOUTUBE_VIDEO_SCRIPT.md) (B-roll section). |
| 9 | **Video** — Record or edit the main story using sections 3–4 of the script; export 1080p + captions. |
| 10 | **Docs** — README + `docs/` links accurate; add team names to **Team** section if required by rules. |
| 11 | **MCP** — `mcp-client` smoke: list tools + one natural-language miles query against prod API URL. |
| 12 | **Git** — `main` (or agreed release branch) builds: `cd frontend && npm run build`; `cd backend && go build ./...`. |
| 13 | **Submission** — Hackathon portal: demo URL, repo, video link, 3-bullet feature list, contact email. |
| 14 | **Post-demo** — Save Railway logs slice; rotate any token accidentally shown on stream. |

### Sign-off (one person owns the merge)

- [ ] All **Everyone** boxes checked.
- [ ] Every row in the **Task pool** has a name next to it (from the shuffle output or a manual stand-up assignment).
- [ ] Final commit tagged (e.g. `hackathon-submit-2026`) and pushed to the submission branch.

---

## Team

Built for Deriv API Grand Prix 2026 by "It works, don't ask how"

## License

MIT
