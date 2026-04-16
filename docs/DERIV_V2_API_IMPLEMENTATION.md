# Deriv API V2 — implementation guide for builders

This document is for anyone (including automated agents) implementing Deriv API V2 in DerivArena. It ties together the **reference script**, **verified behaviour**, and **what product code should do next**.

## Before you write integration code

1. **Official sources of truth:** [Deriv API docs](https://developers.deriv.com/docs/), [WebSocket playground](https://developers.deriv.com/playground), and [LLMs.txt](https://developers.deriv.com/llms.txt). Do not invent request shapes.
2. **Secrets:** A Personal Access Token (PAT) and App ID belong in **environment variables or a secret manager only**. Never commit them, log them in full, or embed them in frontend bundles. Production flows should use **OAuth PKCE** for end users; PAT is acceptable for **server-side** exploration and partner automation only.
3. **V2 only:** Use `https://api.derivws.com` and the trading options paths documented for V2. Do not fall back to legacy V1 URLs for new work.

## Reference script (run this first)

**Path:** `scripts/explore-deriv-v2-api.mjs`

**Requirements:** Node.js **21+** (global `WebSocket` + `fetch`). Node 22 LTS is a safe baseline.

**Run from repo root** (replace placeholders; never paste real tokens into committed files):

```bash
export DERIV_PAT='your_personal_access_token'
export DERIV_APP_ID='your_deriv_app_id'   # optional; defaults to 1089 if unset

node scripts/explore-deriv-v2-api.mjs
```

**What it exercises end-to-end**

| Layer | Action |
|-------|--------|
| REST | `GET /v1/health` |
| REST | `GET /trading/v1/options/accounts` (Bearer PAT + `Deriv-App-ID` header) |
| REST | `POST /trading/v1/options/accounts` with body `{ currency, group, account_type }` when no accounts exist |
| REST | `POST /trading/v1/options/accounts/{accountId}/otp` → JSON `data.url` is the **authenticated WebSocket URL** (OTP in query string) |
| Public WS | `wss://api.derivws.com/trading/v1/options/ws/public` — ping, time, `active_symbols`, `contracts_list`, `contracts_for`, tick subscribe/unsubscribe, `ticks_history` (response `msg_type: "history"`) |
| Auth WS | Connect to URL from OTP — `balance`, `portfolio`, `profit_table`, `statement`, `proposal` + `forget` (no purchase) |

If REST account calls fail, the script still runs the **public** WebSocket demo so you can debug market data independently of PAT scopes.

## Architecture you should mirror in the app

```
                    ┌─────────────────────────┐
  Browser           │  DerivArena backend     │         Deriv API V2
  (no PAT)          │  (holds PAT / OAuth)    │
      │             │                         │
      │  HTTP/SSE   │  REST: accounts, OTP    │──────► api.derivws.com
      └────────────►│  WS proxy (optional)    │──────► wss://.../public
                    │  or server-driven ticks │        wss://.../demo?otp=...
                    └─────────────────────────┘
```

- **Public ticks and symbols:** May be used from the **browser** with the public WebSocket URL only (no PAT). Validate payloads and handle `error` on every message (see [DERIV_PUBLIC_WEBSOCKET.md](./DERIV_PUBLIC_WEBSOCKET.md)).
- **Accounts, OTP, balance, proposal, buy:** Require **server-side** credentials. The browser must not receive the PAT.

## Verified behaviour (summary)

These behaviours were confirmed against a live demo account using the reference script; re-run the script after API changes.

- **Health:** `GET /v1/health` may return an empty body with `200`; treat non-200 as failure.
- **Auth headers:** `Authorization: Bearer <PAT>` and `Deriv-App-ID: <app_id>` on REST calls.
- **OTP WebSocket:** The OTP endpoint returns a **full WebSocket URL**; open it with a normal WebSocket client. Do not hand-roll a separate `otp` frame unless current docs require it for your flow.
- **Ping response:** Server answers `ping` with `msg_type: "ping"` and `ping: "pong"` (match on `msg_type` / echo pattern as in the script).
- **Tick stream:** Subscribe with `ticks`, `subscribe: 1`; unsubscribe with `forget` and the subscription `id` from tick messages.
- **History:** Request uses `ticks_history`; response uses **`msg_type: "history"`** and `history.prices` / `history.times` (not `msg_type: "ticks_history"`).
- **Proposal without buy:** `proposal` then `forget` on the proposal id is valid for pricing UI without opening a position.

## What to build next (maps to checklist)

Cross-check [PHASE_CHECKLIST.md](./PHASE_CHECKLIST.md) Phase 2.

1. **Backend:** Store `deriv_app_id` / partner metadata on competitions; implement server-side REST client for accounts + OTP; optionally a small WS worker or per-session proxy for authenticated streams.
2. **Frontend:** Public `SyntheticTicker` / symbol lists using **only** the public WebSocket; competition rules that allowlist `underlying_symbol` values from `active_symbols` (or a cached subset).
3. **Trading path:** Implement `proposal` → `buy` → monitor (e.g. `proposal_open_contract` subscription) per official docs; persist each closed trade to the competition store for Sortino (see backend `sortino.go`).

## Related docs

| Doc | Use |
|-----|-----|
| [DERIV_PUBLIC_WEBSOCKET.md](./DERIV_PUBLIC_WEBSOCKET.md) | Public URL, validation errors, minimal JS examples |
| [ROADMAP.md](./ROADMAP.md) | Product scope, OAuth PKCE outline, proposal/buy pseudocode |
| [PHASE_CHECKLIST.md](./PHASE_CHECKLIST.md) | Ordered delivery tasks |

## Lightweight public WS smoke test

For a **short** connectivity check without a PAT:

```bash
node scripts/verify-deriv-public-ws.mjs
```

Use the full explorer script when you need REST + authenticated WebSocket verification.
