# DerivArena — delivery checklist (all phases)

Use this as the master execution list. Check items as you ship. Details and context live in [ROADMAP.md](./ROADMAP.md).

**Rules for this repo**

- Prefer official Deriv sources for API shapes (docs, playground, LLMs.txt).
- Keep new documentation under **`docs/`** only.

---

## Phase 0 — Repository & runtime baseline

- [x] `.env` / `.env.example` documented for local API URL, database URL, ports (see repo root `.env.example`, `README.md`, `Makefile`)
- [x] `make dev` (or equivalent) starts API + UI + database without manual fixes (`go run ./cmd/server`, `next.config.js` env load)
- [x] Health endpoint reachable (`/health`)
- [x] Database migrations applied on clean install (`make db-up` / `make db-migrate` from `scripts/dev.sh` and Makefile)

---

## Phase 1 — Competition core (API + minimal UI) ✅ partial

**Backend**

- [x] Competition CRUD: create, list, get
- [x] Join participant endpoint
- [x] Start / end competition lifecycle
- [x] Leaderboard snapshot endpoint
- [x] Leaderboard SSE stream endpoint
- [x] Record trades: `POST /api/competitions/{id}/trade` (closed PnL + `trader_id`; Sortino refreshed; UI on competition detail)
- [x] Conversion event logging: `POST /api/competitions/{id}/conversion-events`
- [x] Participant stats: `GET /api/competitions/{id}/participants/{participantId}/stats`

**Frontend**

- [x] Typed HTTP client for competitions (`/api/competitions`)
- [x] `/competitions` list page
- [x] `/create` form (create competition)
- [x] `/join/{id}` join flow from share URL (`frontend/app/join/[id]/page.tsx`)
- [x] Competition detail page: metadata + CTA to join (`frontend/app/competitions/[id]/page.tsx`)
- [x] Per-competition live leaderboard: `CompetitionLeaderboard` + `useCompetitionLeaderboardStream` (SSE) on competition detail
- [ ] Global `/arena` page: `ArenaLeaderboard` still uses legacy mock data (`useArenaData`) — replace when `/arena/[competitionId]` (Phase 3) or agreed routing exists

---

## Phase 2 — Deriv API V2 integration (trading + data)

**Agent / implementer note:** Read [DERIV_V2_API_IMPLEMENTATION.md](./DERIV_V2_API_IMPLEMENTATION.md) first. It documents the canonical flow (REST accounts → OTP URL → authenticated WS), the reference script `scripts/explore-deriv-v2-api.mjs`, and how that maps to backend vs browser responsibilities. Re-run that script when validating API changes.

**Account & auth**

- [ ] OAuth 2.0 PKCE against Deriv auth endpoints
- [ ] Demo account lifecycle (create / reset where required by rules)
- [ ] Obtain WebSocket session (e.g. OTP / session URL per current V2 docs — follow LLMs.txt, not guesses)

**Market data**

- [x] Proof public WS delivers symbols, ticks, history (see [DERIV_PUBLIC_WEBSOCKET.md](./DERIV_PUBLIC_WEBSOCKET.md))
- [ ] In-app synthetic ticker component subscribed to public WS
- [ ] Symbol picker / validation against `active_symbols` (or cached allowlist)

**Trading**

- [ ] Proposal → buy → monitor → sell (or settle) for allowed contract types in competition rules
- [ ] Map UI / competition symbols to Deriv `underlying_symbol` naming
- [ ] Log each fill to competition store for Sortino / PnL

---

## Phase 2b — Humans + agents on one leaderboard (dual participants)

**Narrative:** Same competition, same Sortino rules; humans trade manually, agents run from a **worker** that records trades with their `participant_id`. Strategy lab (`/dashboard/paper-agent`) stays the **offline** place to tune policy before “deploy”.

**Schema / API**

- [x] `participants.participant_kind` (`human` | `agent`) + optional `metadata` JSONB (migration `011_participant_kind`, join API)
- [ ] Join request validates max agents per comp (optional product rule)
- [x] `POST /api/competitions/{id}/trade` → `RecordTrade` + stats + Sortino (demo: `trader_id` must match join; **auth hardening / OAuth next**)

**Agent deploy (demo)**

- [ ] “Register bot” flow: creates participant row, shows ingest token / env vars for worker
- [ ] Reference worker script or `pkg/agent` loop: snapshot → decision → Deriv execute → POST trade close to API
- [ ] Rate limits per participant on trade POST

**Compare results**

- [x] Leaderboard payload includes **loss_trades** (count `pnl < 0`) + UI column `W / L / trades` on `CompetitionLeaderboard`
- [ ] Dedicated “Compare” table / participant drill-down (PnL, Sortino side-by-side)

**Single source of market context (stretch)**

- [ ] Agent runner consumes same `MarketSnapshot` / SSE the arena would use — avoid browser-only tick state for ranked bots

**See:** [HUMANS_AND_AGENTS.md](./HUMANS_AND_AGENTS.md)

---

## Phase 3 — Arena experience (live competition)

- [ ] Route `/arena/[competitionId]` (or agreed path) with live leaderboard
- [ ] Live activity feed (SSE and/or WS) aligned with backend events
- [ ] Portfolio / positions view for active competition (from Deriv streams + local state)
- [ ] XP bar wired to backend totals (when XP schema exists)

---

## Phase 4 — Partner & growth mechanics

- [ ] `app_id` / referral parameters preserved on join and conversion links
- [ ] Partner-branded competition metadata (name, logo slot if required)
- [ ] Share links and QR (if in scope) tested end-to-end
- [ ] Conversion nudge rules implemented server-side
- [ ] Nudge UI (dismissible, analytics-friendly)

---

## Phase 5 — AI strategy coach

- [ ] Cache or pin [LLMs.txt](https://developers.deriv.com/llms.txt) for prompt context (respect license / freshness policy)
- [ ] Coach API: competition + trader context in, short actionable tip out
- [ ] UI panel on arena: “Get tip”, rate limits, error handling (no model vendor leakage in UI copy if undesired)
- [ ] Avoid browser-blocked LLM endpoints (known CORS constraints); use server-side proxy to your chosen model API

---

## Phase 6 — Anti-abuse & quality bar

- [ ] Rate limits on public HTTP routes
- [ ] Competition rules enforced (contract allowlist, max entries, cooldowns)
- [ ] Sortino ranking documented for judges (“why not raw PnL”)
- [ ] Optional policy / guardrails for reckless sizing (if product requires it)

---

## Phase 7 — Secondary channels (post–MVP if needed)

- [ ] Messaging bot: join, standings, coach tip (Telegram or WhatsApp — pick one for demo depth)
- [ ] Scheduled nudges aligned with competition milestones

---

## Phase 8 — Deploy & submission

- [ ] Production API URL + DB secrets configured on host
- [ ] Production UI build with `NEXT_PUBLIC_API_URL` pointed at API
- [ ] CORS allowlist matches real web origin(s)
- [ ] Smoke test script or runbook in `docs/` (deployment checklist)
- [ ] Demo script: 60–90s path for judges
- [ ] Screenshots / short screen recording for submission packet

---

## Phase 9 — “Nice to have” (only if time remains)

- [ ] Extra visualizations (e.g. war room–style canvas) purely additive
- [ ] Strategy marketplace or credits (only if aligned with judging story)
- [ ] Global all-time leaderboard across competitions (if not in MVP)

---

## Sign-off

When **Phases 0–2** and **Phase 8** are done, you have a credible hackathon vertical slice. Phases **3–6** make it competitive for UX and business narrative. Phases **7** and **9** are optional polish.
