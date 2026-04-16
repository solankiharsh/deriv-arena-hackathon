# Satori-X → DerivArena crosswalk

**Satori-X** lives at `~/Developer/satori-x` (Traders View): Next.js + FastAPI, symbol registry, OHLC → indicators → optional pattern detect → **structured LLM signal**, economic calendar, news, and client-side confidence breakdown. **DerivArena** is a Go competition API + Next.js arena with a browser **paper / swarm lab** (`frontend/lib/agents`).

This doc maps **patterns** (not a line-for-line port) so you can reuse ideas safely for **Deriv API Grand Prix**: Deriv remains the **source of truth for execution**; external market APIs are optional enrichments only.

---

## 1. Intelligence layers

| Satori-X | Location (satori-x) | DerivArena use |
|----------|---------------------|----------------|
| **Timeframe-aware signal** | `GET /api/analysis/signal/{symbol}`, `useSignal` | **Slow path only:** server builds `MarketSnapshot` (ticks/OHLC from Deriv + optional calendar flag) → optional coach / regime JSON → **cache with TTL**. Never block the tick loop on LLM. |
| **Confidence breakdown** (e.g. pattern / trend / confluence) | `frontend/lib/signal-scoring.ts`, AI analysis panel | Arena **“pre-trade brief”** or extra **swarm weights** with the same *interpretable* buckets so humans and agents see **why** a score moved. |
| **Structured JSON from LLM** | `llm_service`, PRODUCT §5 | Same contract for **coach** endpoints: schema-validated output, **temperature ≤ 0.3**, server-side keys. |
| **Pattern recognition** | `POST /api/patterns/detect`, `pattern_recognition.py` | Optional **server feature** for competitions that allow chart-based rules; feed **boolean / enum** features into `MarketSnapshot`, not raw pattern names to the client as authority. |
| **Technical indicators** | `technical-indicators.ts`, backend OHLC pipeline | Reuse **math** in Go next to `marketdata` or as WASM from TS — one **normalization** path per symbol family (see [HUMANS_AND_AGENTS.md](./HUMANS_AND_AGENTS.md)). |
| **Economic calendar** | `economic-calendar.md`, FMP, `use-calendar` | **Event gate:** `high_impact_window` (bool) or `minutes_to_next_high` on snapshot — shared by **human UI and agent worker** for sizing / skip rules. |
| **News** | `use-news`, newsroom | Optional **batched** sentiment or headline count per symbol; refresh on interval, **not** per tick. |

---

## 2. Product / UX patterns

| Satori-X | DerivArena |
|----------|------------|
| **Symbol registry** (`symbol-registry.ts`) | Align with `backend/internal/derivcontract` + a single FE registry: `derivSymbol`, decimals, WS vs poll. |
| **Market detail two-column** (chart + agent panel) | Competition **arena** page: chart / snapshot strip + **fused swarm or coach** in the sidebar. |
| **Risk/reward bar, trade levels** | Log **intent** (levels JSON) on agent trade POST for audit; show humans the same **risk geometry** before submit. |
| **Telegram / cron jobs** | Same tier as **conversion nudges** or “rank changed” alerts — not core matching engine. |

---

## 3. Security & ops (copy as-is)

- **API keys** (FMP, OpenAI, EODHD): **server env only** — Satori’s `secrets` pattern matches DerivArena’s requirement for Deriv tokens and any coach provider.
- **CORS / deployment** | Satori `DEPLOYMENT_ISSUE_CORS.md` | Keep **Next → Go** origin allowlist explicit for production.

---

## 4. What not to copy

- **Primary execution and fills** must stay **Deriv** for the hackathon story; do not depend on EODHD/FMP for prices that settle real/demo competition trades.
- **Do not** ship full Satori dashboard scope in MVP; ship **one** competition context strip + optional drill-down.
- **Design tokens**: Satori has both Deriv-branded and Claude-style docs — pick **one** voice for DerivArena UI.

---

## 5. Implementation order in this repo

1. **Participant model** — `participant_kind` + `metadata` (DB + join API) — *shipped in same change set as this doc’s “start implementation”.*
2. **Single trade POST** — humans and workers → `RecordTrade` (see [HUMANS_AND_AGENTS.md](./HUMANS_AND_AGENTS.md) Phase 2b).
3. **Snapshot + coach** — one Go (or BFF) route shaped like Satori’s signal endpoint, fed from `marketdata`.
4. **Calendar flag** — small column or sidecar table keyed by time; merged into snapshot builder.

---

## 6. References

- Satori product write-up: `satori-x/docs/PRODUCT_AND_ENGINEERING.md`
- DerivArena dual participants: [HUMANS_AND_AGENTS.md](./HUMANS_AND_AGENTS.md)
- Checklist: [PHASE_CHECKLIST.md](./PHASE_CHECKLIST.md) Phase **2b**
