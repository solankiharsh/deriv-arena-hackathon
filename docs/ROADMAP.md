---
name: DerivArena Hackathon Plan (REVISED - Conversion Engine)
overview: "DerivArena — a gamified trading competition platform on Deriv API V2 that converts demo traders into depositors. Partners run branded competitions, traders compete using exotic contracts, winners get contextual nudges to open real accounts. Attacks Deriv's #1 growth problem: 4% signup-to-deposit conversion. Built with Deriv MCP + LLMs.txt. 3 days remaining."
status: REVISED - CONVERSION ENGINE FOCUS
judging_pillars:
  innovation: "Solves real Deriv business problem (4% conversion), not just cool tech"
  ux: "Clean, intuitive, mobile-ready. Partners can create comps in 30 seconds."
  technical: "Deep API V2 usage: OAuth PKCE, 22 WS endpoints, exotic contracts, Sortino leaderboard"
---

> **Working copy** — This file lives in the DerivArena repository. Update checkboxes, dates, and notes here as you implement; it was imported from the original planning document.

> **Humans + agents:** The repo already includes a browser **swarm / paper lab** (`frontend/lib/agents/`). For ranked competitions, both humans and bots must record trades through the **Go competition API** — see [HUMANS_AND_AGENTS.md](./HUMANS_AND_AGENTS.md) and Phase **2b** in [PHASE_CHECKLIST.md](./PHASE_CHECKLIST.md).

# DerivArena: Trading Competition Platform on Deriv API V2

## What This Is (30 Seconds)

**DerivArena** is a gamified trading competition platform where **partners create branded competitions** for their referrals, **traders compete on Deriv's demo accounts** using exotic contracts (Accumulators, Multipliers, Digits), and **winners get contextual nudges** to open real accounts — directly attacking Deriv's #1 growth problem: the **4% signup-to-deposit conversion rate**.

It's not a trading bot. It's a **conversion engine disguised as a game**.

---

## The Five Deriv Business Problems This Solves

Intelligence gathered from Deriv's internal Slack channels (#project_event360, #experiment_whatsapp-acquisition, #team_partner_education, #project_deriv_api_v2, #war_room_v2_user_signup_fix):

### Problem 1: Signup-to-Deposit Conversion = 4% (Target: >10%)

**Evidence:** Event360 team reported (April 10, 2026) that V2 conversion was 1% early-2026, improved to 4% in January via PostHog friction analysis, target is >10%. Deposit reminder nudges show **3x conversion lift** (26% vs 8%).

**How DerivArena fixes it:** Gamified competitions create **emotional investment** in demo trading before asking for a deposit. Conversion nudges at peak engagement moments (top 25% finish, 3-comp winning streak, Accumulator mastery) = higher conversion than cold email.

### Problem 2: WhatsApp Acquisition — 0 Deposits from 16 Real Accounts

**Evidence:** Live experiment (April 13, 2026) produced 48 demo accounts, 16 real accounts, **0 deposits**. Root cause: "lack of timely nudges during onboarding."

**How DerivArena fixes it:** Telegram bot integration (Tier 2) means competitions can run entirely through WhatsApp/Telegram with AI-timed nudges at the right moments.

### Problem 3: Partner Activation — Stalled Partners Have Nothing to Do

**Evidence:** Partner Education team (April 10, 2026) creating content for "stalled partners" who signed up but haven't earned first commission. Need concrete tools to activate referrals.

**How DerivArena fixes it:** Partners get a **competition creator tool** — "Run a 24h Accumulator challenge for your referrals" is actionable, sharable, trackable. Partners go from passive link-posters to active community builders.

### Problem 4: API V2 Developer Onboarding — Devs ARE Partners

**Evidence:** API V2 project update (April 8, 2026): all API developers onboarded as Partners under DCI, commission via `app_id`, one Partners Wallet per developer.

**How DerivArena demonstrates it:** Every trade through DerivArena generates commission for the developer (you) via the embedded `app_id`. The hackathon entry IS the proof-of-concept for the developer-as-partner model.

### Problem 5: Fraud & Bot Abuse — 18,915 Fake Accounts in 64 Hours

**Evidence:** Fraud analysis (April 13, 2026): 18,915 accounts in 64 hours, median 7.9s gap between signups, 99.99% VPN traffic, zero deposits.

**How DerivArena addresses it:** Sortino ranking penalizes reckless bot-like trading. Policy governance (Swiftward) prevents exploitation. Governance isn't just a feature — it's anti-fraud infrastructure.

---

## The Conversion Loop (Core Mechanic)

```
┌──────────────────────────────────────────────────────────────────┐
│              THE DERIVARENA CONVERSION LOOP                      │
│                                                                  │
│  ┌──────────┐   ┌───────────┐   ┌──────────┐   ┌────────────┐  │
│  │ 1. JOIN  │──▶│ 2. TRADE  │──▶│ 3. RANK  │──▶│ 4. CONVERT │  │
│  │ Free     │   │ On Deriv  │   │ Sortino  │   │ Demo→Real  │  │
│  │ Demo     │   │ Exotic    │   │ Leader-  │   │ Deposit    │  │
│  │ Comp     │   │ Contracts │   │ board    │   │ Nudge      │  │
│  └──────────┘   └───────────┘   └──────────┘   └────────────┘  │
│       ▲                                              │           │
│       │          ┌───────────┐                       │           │
│       └──────────│ 5. RETURN │◀──────────────────────┘           │
│                  │ Re-engage │                                    │
│                  │ New Comp  │                                    │
│                  └───────────┘                                    │
└──────────────────────────────────────────────────────────────────┘
```

**Step 1 — JOIN:** User joins a competition (partner-created or platform). No deposit — uses Deriv demo account. Competition has duration (1hr, 1 day, 1 week), contract types allowed, starting balance.

**Step 2 — TRADE:** Trader executes trades via Deriv API V2. AI Strategy Coach provides real-time tips. All trades logged for Sortino calculation.

**Step 3 — RANK:** Real-time Sortino-ranked leaderboard (risk-adjusted, not raw P&L). Top performers get XP and achievements.

**Step 4 — CONVERT:** At peak engagement moments, personalized nudges appear: "You're top 10%! Trade with real money." Deep link to Deriv real account creation with partner's referral ID embedded via `app_id`.

**Step 5 — RETURN:** After conversion (or not), trader returns for next competition. Seasonal structure keeps engagement high.

---

## Technical Architecture

Built on Deriv API V2 throughout. No legacy V1 endpoints.

### Core Stack
- **Backend:** Go (adapt swiftward trading server), PostgreSQL, Railway/Fly.io
- **Frontend:** React + Tailwind (port supermolt-mono arena UI), Vercel
- **Deriv Integration:** API V2 REST + WebSocket
- **AI:** Claude/OpenAI with Deriv LLMs.txt as system prompt context
- **Real-time:** SSE for leaderboard updates, direct WS to Deriv public endpoint for ticks

### Deriv API V2 Integration Points

| Category | Endpoints Used | Purpose |
|----------|---------------|---------|
| **Account Management** | POST /trading/v1/options/accounts (create demo), POST .../reset-demo-balance (reset between comps) | Competition lifecycle |
| **Auth** | OAuth PKCE flow (auth.deriv.com/oauth2/auth + token), POST .../otp (get WS URL) | Authenticated trading |
| **Market Data** (public) | active_symbols, ticks, ticks_history, contracts_for | Tick charts, symbol discovery |
| **Trading** (authenticated) | proposal → buy → proposal_open_contract → sell, contract_update | Full trade lifecycle |
| **Portfolio** | balance, portfolio, profit_table, statement | Position monitoring, P&L for Sortino |

### Component Sourcing (From Existing Repos)

| Component | Source Repo | File | Adaptation |
|-----------|------------|------|------------|
| **Arena Leaderboard UI** | supermolt-mono | web/components/arena/ArenaLeaderboard.tsx | Replace `useLeaderboard()` hook to call DerivArena API |
| **Live Activity Ticker** | supermolt-mono | web/components/arena/LiveActivityTicker.tsx | Replace Socket.IO with SSE from DerivArena backend |
| **XP Progress Bar** | supermolt-mono | web/components/arena/XPProgressBar.tsx | Use as-is |
| **Portfolio Panel** | supermolt-mono | web/components/arena/PortfolioPanel.tsx | Wire to Deriv portfolio WS |
| **Agent Profile Modal** | supermolt-mono | web/components/arena/AgentProfileModal.tsx | Repurpose as trader profile |
| **Tailwind Theme** | supermolt-mono | web/tailwind.config.js + globals.css | Colosseum dark palette as-is |
| **Sortino Calculation** | supermolt-mono | backend/src/services/sortino.service.ts | Port formula to Go |
| **Exchange Interface** | swiftward | golang/internal/exchange/client.go | Implement for Deriv V2 |
| **Policy Engine** (Tier 2) | swiftward | Swiftward Docker image | Add competition-specific rules |

---

## Tier 1 — MUST SHIP (This Wins the Hackathon)

### 1. Competition Engine (Backend - Go)

**New files:**
- `golang/internal/competition/engine.go`
- `golang/internal/competition/types.go`
- `golang/internal/competition/store.go` (PostgreSQL)

**Schema:**
```sql
CREATE TABLE competitions (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  partner_id TEXT,
  partner_name TEXT,
  app_id TEXT, -- for referral attribution
  duration_hours INT NOT NULL,
  contract_types TEXT[], -- CALL/PUT, ACCU, MULTUP, etc.
  starting_balance DECIMAL NOT NULL,
  status TEXT, -- pending, active, ended
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  share_url TEXT,
  created_at TIMESTAMP
);

CREATE TABLE participants (
  id UUID PRIMARY KEY,
  competition_id UUID REFERENCES competitions(id),
  trader_id TEXT NOT NULL,
  trader_name TEXT,
  deriv_account_id TEXT, -- demo account created via API V2
  joined_at TIMESTAMP
);

CREATE TABLE competition_trades (
  id UUID PRIMARY KEY,
  competition_id UUID REFERENCES competitions(id),
  participant_id UUID REFERENCES participants(id),
  contract_type TEXT,
  symbol TEXT,
  stake DECIMAL,
  payout DECIMAL,
  pnl DECIMAL,
  executed_at TIMESTAMP
);
```

**API:**
- `POST /api/competitions` -- create comp (partner provides name, duration, contract types, app_id)
- `GET /api/competitions/:id` -- comp details + current leaderboard
- `POST /api/competitions/:id/join` -- join comp (creates demo account via Deriv V2)
- `GET /api/competitions` -- list active/upcoming comps

### 2. Deriv V2 Exchange Adapter (Backend - Go)

**Reference for implementers:** [docs/DERIV_V2_API_IMPLEMENTATION.md](./DERIV_V2_API_IMPLEMENTATION.md) describes the verified REST + WebSocket sequence, environment variables, and the runnable probe `scripts/explore-deriv-v2-api.mjs`. Use it to validate PAT, App ID, and message shapes before wiring the Go adapter.

#### Implementations in this repo (market data + adapter)

| Module | Path | Role |
|--------|------|------|
| **Symbol / proposal validation** | [backend/internal/derivcontract/](../backend/internal/derivcontract/) | Canonical `VOL*-USD` ↔ Deriv `1HZ*V`, allowlisted `contract_type`, normalized proposal params |
| **Canonical snapshots** | [backend/internal/marketdata/](../backend/internal/marketdata/) | `MarketSnapshot`, `SourceMeta`, phased `Collector`, `BackgroundRunner` |
| **Deriv public WS adapter** | [backend/internal/marketdata/deriv/](../backend/internal/marketdata/deriv/) | Public ticks / `ticks_history` / `active_symbols`, reconnect + subscription replay |
| **Authenticated trading WS** | [backend/internal/exchange/deriv_client.go](../backend/internal/exchange/deriv_client.go) | OTP URL, proposal → buy, `context`-bound requests, read-loop reconnect |
| **Post-ingest fan-out** | [backend/internal/actionbus/](../backend/internal/actionbus/) | `ActionRouter` + `SignalMarketSnapshot` for leaderboard / nudges / coach (handlers grow here) |
| **Process wiring** | [backend/cmd/server/main.go](../backend/cmd/server/main.go) | Optional pipeline when `MARKETDATA_ENABLED=1`; `/health` exposes last collect metadata |

**Optional env (public market data pipeline):** `MARKETDATA_ENABLED=1`, `MARKETDATA_INTERVAL_SEC` (default 15, min 2), `MARKETDATA_SYMBOLS` (comma-separated canonical pairs, default `VOL100-USD`), `MARKETDATA_CANDLE_LIMIT` (default 60), `MARKETDATA_INCLUDE_MARKETS=1` (heavy: full `active_symbols` each cycle).

**Verification:** `cd backend && go test ./...` (unit tests for `derivcontract` + `marketdata` collector); with `MARKETDATA_ENABLED=1`, confirm `/health` shows `marketdata.success_items` including `tickers` after one interval.

**Primary adapter file:** [backend/internal/exchange/deriv_client.go](../backend/internal/exchange/deriv_client.go)

Implements [backend/internal/exchange/client.go](../backend/internal/exchange/client.go) `Client` interface:

```go
type Client interface {
    SubmitTrade(req *TradeRequest) (*TradeResponse, error)
    GetPrice(pair string) (decimal.Decimal, bool)
    GetPrices() map[string]decimal.Decimal
}
```

**OAuth PKCE flow:**
1. Generate `code_verifier` (64 random chars)
2. Compute `code_challenge` = BASE64URL(SHA256(verifier))
3. Redirect: `https://auth.deriv.com/oauth2/auth?response_type=code&client_id=...&code_challenge=...&code_challenge_method=S256`
4. Exchange code for `access_token`: `POST https://auth.deriv.com/oauth2/token` with `code_verifier`
5. Get OTP: `POST /trading/v1/options/accounts/{accountId}/otp` → returns `wss://...?otp=...`
6. Connect to WS, send proposals/buys

**Trade flow (Deriv V2 proposal → buy):**
```go
// 1. Get proposal
ws.Send(map[string]interface{}{
    "proposal": 1,
    "amount": stake,
    "basis": "stake",
    "contract_type": "ACCU", // or CALL, MULTUP, etc.
    "currency": "USD",
    "duration": 5,
    "duration_unit": "t",
    "underlying_symbol": "1HZ100V",
    "growth_rate": 0.03, // for ACCU
    "req_id": 1,
})

// 2. Buy with proposal ID
ws.Send(map[string]interface{}{
    "buy": proposalID,
    "price": maxPrice,
    "req_id": 2,
})

// 3. Monitor via subscription
ws.Send(map[string]interface{}{
    "proposal_open_contract": 1,
    "contract_id": contractID,
    "subscribe": 1,
    "req_id": 3,
})
```

**Symbol mapping:** `VOL100` → `1HZ100V`, `VOL75` → `1HZ75V`, etc. (centralized in `derivcontract`, used by both public market data and `DerivClient`.)

Wire authenticated `DerivClient` from application bootstrap when OAuth + account are available; enable the **public** collector in [backend/cmd/server/main.go](../backend/cmd/server/main.go) with `MARKETDATA_ENABLED=1` for ticks/candles without trader tokens.

### 3. Sortino Leaderboard (Backend - Go)

**New file:** `golang/internal/leaderboard/sortino.go`

Port formula from [supermolt-mono/backend/src/services/sortino.service.ts](supermolt-mono/backend/src/services/sortino.service.ts):

```
Sortino Ratio = (Mean Return - Risk-Free Rate) / Downside Deviation

Where:
- Mean Return = average P&L per trade
- Risk-Free Rate = 0 for competitions
- Downside Deviation = sqrt(mean(negative returns^2))
```

Calculate on trade close. Store per participant per competition.

**API:**
- `GET /api/competitions/:id/leaderboard` -- Sortino-ranked participants with live SSE updates
- `GET /api/leaderboard/global` -- All-time rankings across competitions

### 4. Live Arena Dashboard (Frontend - React)

**Port from supermolt-mono:**

| Component | Source | Adaptation |
|-----------|--------|------------|
| ArenaLeaderboard | [supermolt-mono/web/components/arena/ArenaLeaderboard.tsx](supermolt-mono/web/components/arena/ArenaLeaderboard.tsx) | Replace `useLeaderboard()` hook → `useSWR('/api/competitions/:id/leaderboard')` |
| LiveActivityTicker | [supermolt-mono/web/components/arena/LiveActivityTicker.tsx](supermolt-mono/web/components/arena/LiveActivityTicker.tsx) | Replace Socket.IO → SSE from `/api/competitions/:id/events` |
| PortfolioPanel | [supermolt-mono/web/components/arena/PortfolioPanel.tsx](supermolt-mono/web/components/arena/PortfolioPanel.tsx) | Wire to Deriv `portfolio` + `profit_table` WS |
| XPProgressBar | [supermolt-mono/web/components/arena/XPProgressBar.tsx](supermolt-mono/web/components/arena/XPProgressBar.tsx) | Use as-is (levels 0-2000 XP) |
| Tailwind theme | [supermolt-mono/web/tailwind.config.js](supermolt-mono/web/tailwind.config.js) + globals.css | Use Colosseum dark palette as-is |

**New Deriv-specific components:**
- `SyntheticTicker.tsx` -- Direct Deriv public WS: `wss://api.derivws.com/trading/v1/options/ws/public` → `ticks` subscription → live chart
- `ContractPayoff.tsx` -- Payoff diagrams for exotic contracts (ACCU, MULTUP/DOWN, DIGIT*)
- `CompetitionCreator.tsx` -- Form: name, duration, contract types, referral ID → `POST /api/competitions`
- `ConversionNudge.tsx` -- Banner/modal with personalized message + CTA button → deep link

**Pages:**

| Route | Content | Priority |
|-------|---------|----------|
| `/` | Landing: "Create or join trading competitions on Deriv. Win on demo, trade for real." + featured comps | T1 |
| `/arena/:id` | Live comp dashboard: leaderboard, ticker, tick chart, portfolio, AI coach chat | T1 |
| `/compete/:id` | Trading interface: place trades, see positions, real-time balance | T1 |
| `/create` | Partner comp creator: rules form, preview, generate share link | T1 |
| `/leaderboard` | Global Sortino rankings + XP | T1 |
| `/profile/:id` | Trader stats, comp history, achievements | T2 |

### 5. AI Strategy Coach (Backend + Frontend)

**Backend:** `golang/internal/coach/strategy_coach.go`

System prompt includes Deriv LLMs.txt (1300 lines from `docs/deriv/llms.txt`) + competition context.

**Prompt template:**
```
You are an AI trading coach for Deriv competitions. Context:
- Deriv API docs: [LLMs.txt content]
- Trader's competition: [comp rules, contract types, duration]
- Trader's performance: [last 10 trades, current Sortino, rank, P&L]
- Current market: [latest ticks for active symbols]

Provide ONE actionable tip to improve their strategy. Be specific. Mention Deriv contract features.
```

**API:** `POST /api/coach/tip` -- body: `competition_id`, `trader_id` → response: personalized tip

**Frontend:** `StrategyCoach.tsx` -- Chat-like panel, "Get Tip" button, displays coach response with Deriv contract context

### 6. Conversion Nudge System (Backend)

**New file:** `golang/internal/competition/nudge.go`

Triggers:

| Trigger | Nudge | Deep Link |
|---------|-------|-----------|
| Trader finishes top 25% | "You outperformed 75% of traders! Ready for real stakes?" | `https://app.deriv.com/signup?app_id={PARTNER_APP_ID}` |
| 3-competition win streak | "3-win streak! Your strategy works. Try it with real money." | Same, track via cookie/localStorage |
| Profitable Accumulator trade | "You've mastered Accumulators — Deriv's unique product. Trade for real." | Deep link to Deriv deposit page |
| Competition winner | Winner celebration + "Claim your achievement: trade with real money" | Deep link with bonus code if available |

**Implementation:** Check trigger conditions on trade close + competition end. Emit nudge event to frontend via SSE or polling.

**Frontend:** `ConversionNudge.tsx` -- Renders as slide-in banner or modal overlay, dismissible, tracks shown/clicked for analytics.

### 7. Partner Competition Creator (Frontend)

**Component:** `CompetitionCreator.tsx`

**Form fields:**
- Competition name (text)
- Duration (dropdown: 1hr, 6hr, 24hr, 3 days, 1 week)
- Contract types (multi-select: CALL/PUT, ACCU, MULTUP/DOWN, DIGIT*)
- Starting balance (slider: $100 - $10,000)
- Partner name (text)
- Partner `app_id` (text, for referral attribution)

**Submit:** `POST /api/competitions` → returns competition ID + share URL

**Share URL:** `https://derivarena.vercel.app/join/{compID}` -- opens join flow with partner branding

### 8. Deriv MCP + LLMs.txt Setup (Dev Tooling)

**Tasks:**
1. Add to `.cursor/mcp.json`:
```json
"deriv api": {
  "url": "https://mcp-api.deriv.com/mcp",
  "name": "Deriv API"
}
```
2. Cache LLMs.txt: `curl https://developers.deriv.com/llms.txt > docs/deriv/llms.txt`
3. Verify: ask AI "What endpoints are available for buying contracts?" -- confirm live data
4. Inject LLMs.txt into AI Strategy Coach system prompt

---

## Tier 2 — SHOULD SHIP (If Time Permits)

### 9. AI Agent Competitors (2-3 Archetypes)

Adapt swiftward agents to compete alongside humans in competitions (see **[HUMANS_AND_AGENTS.md](./HUMANS_AND_AGENTS.md)** for participant model, single trade path, and demo worker pattern):

**Volatility Scalper:**
- CALL/PUT on Vol 100, 5-tick duration, high frequency
- Demonstrates basic contract usage

**Accumulator Hunter:**
- ACCU with growth_rate, waits for low-vol windows
- Demonstrates exotic contract mastery

**Digit Oracle:**
- DIGITEVEN/ODD/MATCH -- statistical digit analysis
- Demonstrates Deriv's unique products

Agents join competitions like humans. Appear on leaderboard. Serve as educational examples and competition participants when human count is low.

### 10. XP & Achievement System

**Schema:**
```sql
CREATE TABLE trader_xp (
  trader_id TEXT PRIMARY KEY,
  xp INT DEFAULT 0,
  level INT DEFAULT 1,
  achievements JSONB
);
```

**XP sources:**
- First trade: 100 XP
- Profitable trade: 50 XP
- Exotic contract profit: 75 XP
- Top 25% finish: 150 XP
- Competition win: 300 XP

**Levels:**
- Level 1 (0 XP): Recruit
- Level 2 (100 XP): Scout
- Level 3 (300 XP): Analyst
- Level 4 (600 XP): Strategist
- Level 5 (1000 XP): Commander
- Level 6 (2000 XP): Legend

**UI:** XPProgressBar component already exists. Wire to backend XP values.

### 11. Telegram Bot (Competition Notifications)

Telegram bot using Telegraf or similar:
- `/join {compID}` -- join competition via Telegram
- `/standings {compID}` -- current leaderboard
- `/coach` -- get AI Strategy Coach tip
- Auto-notifications when comp starts, when you're overtaken, when comp ends

Pattern from superpage `@HeySuperioBot` or agentforge skill docs.

---

## Tier 3 — NICE TO HAVE (Demo Day Polish)

- PixiJS War Room (port from supermolt-mono `WarRoomCanvas.tsx`)
- Strategy marketplace with x402 payments
- Full credit scoring system
- All 7 Pleiadesian AI coworkers
- Agent bank loans (rsoft)

---

## 3-Day Build Schedule (Realistic)

### Day 1 (April 14) — Core Infrastructure
- [ ] Set up Deriv MCP + cache LLMs.txt
- [ ] Build Deriv V2 exchange adapter (OAuth, OTP, proposal/buy/sell)
- [ ] Build Deriv market data source (public WS ticks)
- [ ] PostgreSQL schema for competitions + participants + trades
- [ ] Competition CRUD API (create, join, get)
- [ ] Deploy skeleton frontend to Vercel

### Day 2 (April 15) — Arena + Leaderboard
- [ ] Competition start/end lifecycle
- [ ] Sortino calculation + leaderboard API with SSE
- [ ] Port ArenaLeaderboard UI from supermolt-mono
- [ ] Port LiveActivityTicker from supermolt-mono
- [ ] Build SyntheticTicker (Deriv public WS)
- [ ] Build CompetitionCreator form
- [ ] Trade execution within competition context

### Day 3 (April 16) — AI + Conversion + Deploy
- [ ] AI Strategy Coach (LLMs.txt system prompt + trader context)
- [ ] Conversion nudge triggers + nudge UI
- [ ] Partner referral ID deep links
- [ ] Mobile responsiveness pass
- [ ] Final deploy to Vercel + Railway
- [ ] Vibe-coding docs (AI prompts, architecture, troubleshooting)
- [ ] Demo script + walkthrough video

### Day 4 (April 17) — Submission Day
- [ ] GitHub repo cleanup
- [ ] README with screenshots
- [ ] Submit to hackathon portal

---

## Critical Reminders for Implementation

1. **API V2 ONLY** -- Do not use legacy V1 endpoints. Reference LLMs.txt for correct paths.
2. **litellm.deriv.ai CORS issues** -- Use own LLM endpoint (OpenAI/Anthropic key) or mock for demo
3. **Demo mode essential** -- Competition trades go through Deriv demo accounts, not real money
4. **Partner attribution** -- Every conversion link includes `app_id={PARTNER_APP_ID}` for commission tracking
5. **Mobile-first** -- 46.4% of developers.deriv.com traffic is mobile
6. **Sortino > raw P&L** -- This is the differentiator. Rank by risk-adjusted performance.
7. **Conversion nudges at peak engagement** -- Not random banners. Trigger on top-25%, streaks, exotic mastery.

---

## What This Wins On (Judging Pillars)

### Innovation
- Solves a REAL business problem (4% conversion) validated by Deriv's internal teams
- Not "another trading bot" — it's a partner activation tool + conversion engine
- Fresh approach: gamified competition as demo-to-deposit bridge

### User Experience
- Clean, intuitive, mobile-ready (supermolt-mono Colosseum theme is polished)
- Partners create competitions in 30 seconds
- Traders see live leaderboards, AI coaching, personalized nudges
- 24/7 on synthetic markets — always live when judges check

### Technical Execution
- Deep API V2 integration: OAuth PKCE, 22 WS endpoints, exotic contracts (ACCU, MULTUP/DOWN, DIGIT*)
- Built WITH Deriv's tools (MCP server, LLMs.txt) not just against their API
- Sortino ranking shows sophisticated understanding of trading performance metrics
- Component composition from battle-tested repos (swiftward, supermolt-mono) not hackathon spaghetti

---

## References

**Deriv Developer Resources:**
- MCP Server: https://mcp-api.deriv.com/mcp
- LLMs.txt: https://developers.deriv.com/llms.txt
- API Docs: https://developers.deriv.com/docs/
- Playground: https://developers.deriv.com/playground

**Slack Evidence:**
- #project_event360 (April 10): conversion rates, nudge effectiveness
- #experiment_whatsapp-acquisition (April 13): 0 deposits from WhatsApp funnel
- #team_partner_education (April 10): stalled partner problem
- #project_deriv_api_v2 (April 8): developer-as-partner model
- #war_room_v2_user_signup_fix (April 13): fraud analysis

**Organizer Inspiration:**
- daccu.vercel.app -- gamified Accumulator app
- tradewaverider.app -- gamified trading interface

**Source Repos:**
- swiftward-ai-trading-agents (exchange abstraction, policy engine)
- supermolt-mono (arena UI, Sortino formula, Tailwind theme)
- agentforge (x402 pattern for Tier 3)
- pleiadesian (AI personas for Tier 3)
- rsoft-agentic-bank (bank pattern for Tier 3)
- superpage (marketplace pattern for Tier 3)
- RIDHWAN (credit scoring for Tier 3)
