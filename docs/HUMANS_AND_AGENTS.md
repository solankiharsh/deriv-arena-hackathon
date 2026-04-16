# Humans + agents in the same competition

This document fixes the earlier ideation gap: **the platform already has two halves** — a Go **competition engine** (participants, trades, Sortino, SSE) and a Next.js **strategy lab** (`frontend/lib/agents`, paper ledger, `/dashboard/paper-agent`). The product story you want is **one arena** where both **people** and **deployed agents** participate under the **same rules** and **comparable stats**.

---

## 1. Where things live today (source of truth)

| Capability | Location | Notes |
|------------|----------|--------|
| Competitions, join, leaderboard, Sortino | `backend/internal/competition/` | `Participant`, `Trade`, `Stats`, `LeaderboardEntry` |
| Market snapshots (server) | `backend/internal/marketdata/` | Public ingest + `MarketSnapshot` pattern |
| Swarm, analyzers, fuse, policy → knobs | `frontend/lib/agents/` | Runs in the browser today |
| Paper PnL / step simulator | `frontend/lib/paper/` | Local storage; **not** the competition DB until trades are posted |
| Public ticks (browser) | `frontend/lib/deriv/publicTickFeed.ts`, `useDerivPublicTicks` | Good for lab UI; agents in production should prefer **server-fed** snapshots to avoid dual truth |

**Important:** Leaderboard truth for the hackathon demo should be **trades recorded in PostgreSQL** for each `participant_id`. Anything that only exists in `localStorage` is **lab**, not a ranked competitor.

---

## 2. What you want (requirements in one list)

1. **Humans and agents both compete** in the same `competition_id`.
2. **Same tools / info** where fair: allowed symbols, contract types, snapshots, optional coach, rules sheet.
3. **Deploy an agent** for demo: a second participant row that places trades (or posts recorded fills) through the **same API path** as humans.
4. **You trade manually** as another participant and see **you vs bot**: wins, losses, PnL, Sortino.

---

## 3. How to address the architecture gap (concrete steps)

### Step A — One participant model, two kinds

Extend the domain (migration + types) so rows are explicit:

- `participant_kind`: `human` | `agent` (string enum).
- `trader_id`: stable unique key, e.g. `human:{oauth_sub_or_stable_id}` and `agent:{deployment_uuid}`.
- Optional `metadata` JSONB on `participants`: `{ "policy_version": "...", "repo": "...", "notes": "..." }` for judges — no secrets in DB.

**Join API:** allow join with `trader_name` like `VolScalper-Bot-01` and `participant_kind=agent` so the leaderboard reads naturally.

**Anti-abuse:** rate limits per `participant_id` on trade recording; optional max agents per competition.

### Step B — One trade path (non-negotiable)

Both humans and agents must hit the **same** server flow:

1. Authenticated identity resolves to `participant_id` + `competition_id`.
2. Deriv **proposal → buy** (and later settle) runs in **one** place: browser for humans (Phase 2), or **worker** for agents.
3. On each closed trade (or on fill, depending on product), server calls existing **`RecordTrade`** / stats update so **Sortino and win/loss counts** stay consistent.

Avoid: agent trades only in browser memory while humans use DB — that breaks comparison.

### Step C — “Deploy agent” = register + runner

**Minimum demo (fast):**

1. `POST .../join` → get `participant_id` for the bot.
2. Small **Go worker** or **Node script** (same repo as `scripts/`) with env: `API_URL`, `COMPETITION_ID`, `PARTICIPANT_ID`, `DERIV_TOKEN` (server-side secret), loop: fetch snapshot → run policy (port TS logic to Go **or** call a tiny sidecar) → execute on Deriv → `POST` trade result to API.

**Better UX:**

- UI: **“Register bot in this competition”** → creates participant + shows one-time **ingest token** for the worker (scoped JWT), not a full user password.

### Step D — Human manual trading

- Same join flow with OAuth-linked `trader_id`.
- Arena page: trade ticket → Deriv WS → on settlement, **POST trade** (or backend listens to your app’s event bus — see `actionbus`).

### Step E — Compare wins vs losses

Use **`trades`** as source of truth:

- **Wins / losses:** count rows where `pnl > 0` / `pnl < 0` (define scratch band if needed, e.g. `|pnl| < ε`).
- **Expose:** extend `GET /api/competitions/{id}/participants/{participantId}/stats` (or add) with `win_count`, `loss_count`, `avg_win`, `avg_loss`, alongside existing `total_pnl`, `sortino_ratio`, `profitable_trades` from `Stats` in `types.go`.

**UI:** competition detail → “Compare” table: columns = participant, kind, W/L, total PnL, Sortino, last trade time.

---

## 4. “Tools and info” for edge (platform responsibilities)

| Tool | Human | Agent | Implementation hint |
|------|-------|-------|---------------------|
| Live prices | Yes | Yes | Server snapshot SSE or poll; same payload to both |
| Rules + allowlist | Yes | Yes | From `competition.contract_types` + `derivcontract` map |
| Risk / Sortino explain | Yes | Yes | Static copy + link to `docs/` Sortino definition |
| Policy lab | Yes (tune) | Yes (author) | Keep `/dashboard/paper-agent`; “export policy JSON” for bot |
| LLM coach | Optional | Optional | **Never on tick path**; cache tips every N seconds or on user click (see ROADMAP Phase 5) |

---

## 5. LLM and latency (explicit rule)

- **Slow path only:** regime labels, coach tips, narrative summaries — computed on a **timer or event**, cached with `valid_until`.
- **Tick path:** deterministic features only (what `marketdata` + analyzers already approximate).

Stale labels are OK if gates treat them as **“context aged > X → ignore for entry”**.

---

## 6. Cross-instrument normalization (when you leave pure `R_*` / `1HZ*`)

Document per **symbol family** in config:

- Short-window σ or ATR% as **risk unit**.
- Analyzer inputs expressed in **multiples of that unit** so BTC vs `R_100` are comparable **within** leaderboards that allow mixed symbols — or **easier for MVP:** one symbol family per competition so judges are not confused.

---

## 7. Phased delivery (aligned with Grand Prix)

| Phase | Outcome | Judging value |
|-------|---------|----------------|
| **P0** | Human join + manual trade + trade rows + leaderboard | Core demo |
| **P1** | Agent participant + worker posts same trade API | “Human vs AI” story |
| **P2** | Compare panel + W/L + policy export from lab | Shows edge + rigor |
| **P3** | Optional: agent uses server `MarketSnapshot` only | Single market truth |

Do **not** block P0 on full Supermolt-style detect/deploy/learn — ship the **spine** first, then deepen.

---

## 8. README / critique alignment

Earlier external critique claimed **“no analyzers in repo”** — that is **out of date**: analyzers exist under `frontend/lib/agents/`. The accurate critique is: **they are not yet competition participants wired to Go `RecordTrade`**. This doc is the bridge.

---

## 9. Related docs

- [SATORI_X_CROSSWALK.md](./SATORI_X_CROSSWALK.md) — Traders View (Satori-X) patterns mapped to DerivArena (signals, calendar, symbol registry).
- [ROADMAP.md](./ROADMAP.md) — Tier 2 “AI Agent Competitors” (archetypes).
- [PHASE_CHECKLIST.md](./PHASE_CHECKLIST.md) — Phase 2b checklist for dual participants.
- [DERIV_V2_API_IMPLEMENTATION.md](./DERIV_V2_API_IMPLEMENTATION.md) — Auth + trade sequence for humans and workers.
