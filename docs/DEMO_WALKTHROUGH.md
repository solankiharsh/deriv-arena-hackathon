# DerivArena — Live Demo Walkthrough & Preparation

This doc is your **pre-flight checklist + step-by-step runbook** for demoing
DerivArena to judges, partners, or investors. Pair it with
[`YOUTUBE_VIDEO_SCRIPT.md`](./YOUTUBE_VIDEO_SCRIPT.md) — the script is the
narrative, this is the reality check.

Target demo length: **8–10 minutes live**, **~12 minutes with Q&A buffer**.

---

## 1. The night before

Nothing kills a demo faster than a last-minute outage. Run this 12 hours ahead.

### 1a. Infra health

```bash
# Backend
curl -s https://deriv-arena-hackathon-production.up.railway.app/health | jq

# Frontend
open https://deriv-arena-hackathon-beta.vercel.app

# Deriv public WebSocket reachability
node scripts/verify-deriv-public-ws.mjs
```

All three must succeed. Expected:

- Backend `/health` → `{"status":"ok","service":"derivarena", ...}`
- Frontend loads home page without a console error.
- WS verify script prints tick frames for at least one symbol.

### 1b. Environment variables

| Variable on Vercel               | Expected                                                  |
| -------------------------------- | --------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL`            | `https://deriv-arena-hackathon-production.up.railway.app` |
| `NEXT_PUBLIC_BASE_URL`           | Your canonical frontend URL (e.g. `https://arena.solharsh.com` or the `*.vercel.app` host) |
| `NEXT_PUBLIC_DERIV_APP_ID`       | Set (OAuth client id)                                     |
| `NEXT_PUBLIC_DERIV_LEGACY_WS_APP_ID` | Numeric app id (fallback) — set if yours is alphanumeric  |
| `DATABASE_URL`                   | Railway Postgres                                          |
| `JWT_SECRET`                     | Set                                                       |
| `OPENAI_API_KEY`                 | Set (Copilot)                                             |

| Variable on Railway (`deriv-arena-hackathon`) | Expected                                                       |
| --------------------------------------------- | -------------------------------------------------------------- |
| `CORS_ORIGINS`                                | Includes both the Vercel prod domain **and** your local dev    |
| `DATABASE_URL`                                | Railway Postgres                                               |
| `DERIV_APP_ID`                                | Set                                                            |
| `DERIV_PAT`                                   | Set                                                            |

If anything is missing, fix **before** demo day — the
`CORS_ORIGINS` one in particular produces the silent "balance shows 0" bug.

### 1c. Data sanity

Run from the repo root:

```bash
# Confirm catalog prices are the tuned ones (300 / 700 / 1100 / 1500)
DATABASE_URL='<railway public url>' DATABASE_SSL_UNVERIFIED=1 \
  node -e "import('pg').then(async(m)=>{const{Pool}=m.default;const p=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}});const r=await p.query(\"SELECT id, miles_cost FROM deriv_miles_catalog WHERE id IN('ai_chart_analyst_5','pro_trading_signals','ai_chart_analyst_20','premium_trading_copilot') ORDER BY miles_cost\");console.log(r.rows);await p.end();});"
```

If prices are wrong, re-run:

```bash
cd frontend
DATABASE_URL='<railway public url>' DATABASE_SSL_UNVERIFIED=1 \
  node scripts/seed-marketplace-catalog.mjs
```

### 1d. Demo accounts

Prepare **three accounts** and be logged into them in three different browser
profiles:

| Profile          | Role     | Purpose in the demo                       |
| ---------------- | -------- | ----------------------------------------- |
| `partner-demo`   | partner  | Create competition + share modal + partner tracking |
| `player-fresh`   | player   | Brand-new player — to show first-time Miles lighting up |
| `player-leader`  | player   | Has 100k+ Miles — for Marketplace redemption flow |

Getting the **fresh** account to zero before demo:

```bash
DATABASE_URL='<railway public url>' DATABASE_SSL_UNVERIFIED=1 \
  node -e "/* zero out via psql or migrate a throwaway email */"
```

Simplest approach: use a new Deriv OAuth sign-in with an email you've never
used on DerivArena before; it'll auto-create a fresh `arena_users` row.

### 1e. Miles top-up for the leader account

So you can actually redeem something on camera:

```bash
cd frontend
DATABASE_URL='<railway public url>' DATABASE_SSL_UNVERIFIED=1 \
  node scripts/grant-deriv-miles.mjs <leader-user-uuid> 100000
```

### 1f. MCP / OpenClaw side prep

Only needed if you're showing the MCP scene.

```bash
cd mcp-client
DERIVARENA_API_URL=https://deriv-arena-hackathon-production.up.railway.app \
  node src/index.js --list-tools
```

Should print ≥ 11 tools including `arena_list_competitions`,
`arena_miles_balance`, `arena_redeem_miles`, etc. If you're demoing on Telegram
specifically, confirm the bot token is set and the bot responds with `/start`.

---

## 2. Demo day — 30 minutes before

- [ ] Close Slack / mail / notifications. Enable Do Not Disturb.
- [ ] Empty Desktop, clean Dock, neutral wallpaper.
- [ ] Browser: quit and reopen fresh. Sign in to the **partner-demo** account.
- [ ] Open these tabs in this exact order (left → right):
  1. `/` — home
  2. `/arena`
  3. `/create`
  4. `/trading-copilot`
  5. `/miles`
  6. `/marketplace`
  7. `/dashboard`
  8. Telegram (for MCP scene)
- [ ] Verify the `DerivStreamStatus` pill reads **Deriv Live** (green) on the
      home page. If amber/red, sign out and back in, then refresh.
- [ ] Ensure there is **at least one live/waiting competition instance** you
      can join for the live-trading scene. If not, start one yourself from
      `/create` and leave it on "waiting".
- [ ] Pre-load the Copilot prompt you plan to send so you can paste it cleanly.
- [ ] Zoom camera to 1x, 1080p; audio check with a 5-second test recording.

---

## 3. The live walkthrough — 8 scenes, ~9 minutes

> Target: show the user story, not every feature. Narrate in the voice of the
> script but pause for natural interaction — live demos live and die on
> confidence.

### Scene 1 — Frame the problem (1 min)

- Open `/`. Scroll **slowly** down to the "Solving Real Deriv Problems"
  section. Read the three metrics out loud.
- Key line: *"Four percent signup-to-deposit. Zero warm WhatsApp
  conversions. 18,900 fake accounts in 64 hours. These are Deriv's own
  numbers."*

### Scene 2 — Show the loop (1 min)

- Scroll to the **"DerivArena Loop"** section on `/`.
- Let the animation run for 3–5 seconds in silence.
- Walk left-to-right across the top row, then down through core, then
  bottom row. Say each pillar in one sentence.

### Scene 3 — Play & Compete (1.5 min)

- Click **Enter the Arena**. Pick any waiting competition.
- Click the expanded `DerivStreamStatus` pill; point at
  **`trading/v1 (new)`**. Say: *"Every tick on this page is coming from
  Deriv's v2 API — not a mock."*
- Place at least one trade. Narrate: *"Sortino-ranked — this isn't about
  who made the most, it's about who risked the smartest."*

### Scene 4 — Deploy an AI Agent (1 min)

- Switch to `/dashboard`. Let the Command Center pulse animation run.
- Click the **Deriv Ticks** feed card → side sheet opens.
- Key line: *"The agent doesn't just guess. Four live feeds, every
  decision audit-logged."*

### Scene 5 — Learn with Copilot (1 min)

- Switch to `/trading-copilot`.
- Paste: *"Explain the risk of a 10% accumulator growth rate on VOL100
  right now."*
- Let the streaming response start. Don't wait for completion — cut as
  soon as a structured widget renders.

### Scene 6 — Miles & Marketplace (1.5 min)

- Switch to `/miles`. Show the **Quick Wins** card — the earned badges
  should be lighting up from the trade you just placed in Scene 3.
- Switch to `/marketplace`. Click **Redeem** on *AI Chart Analyst — 5
  credits* (300 Miles). Confirm the modal. Show the success toast.
- Key line: *"Earn with skill, spend on tools that make you better.
  Deriv Miles is the bank; Marketplace is the credit-card rewards
  catalog."*

### Scene 7 — Go Real on Deriv (1 min)

- If you have a rigged instance where your percentile > 85, open that
  results screen now — the modal fires automatically.
- Otherwise, show the `Percentile85Modal` as a prepared screenshot /
  video clip. Don't fake the flow live if it isn't live.
- Key line: *"A contextual deposit prompt the moment the numbers say
  you're ready. Not a spammy banner — a graduation moment."*

### Scene 8 — Share & MCP (1 min)

- Switch to `/create`. Pick a template. Click **Share**.
- Show the affiliate pill, the three share buttons, the +100 / +250
  Miles footer.
- Click Telegram → system share opens, then dismiss.
- Switch the picture-in-picture to Telegram. Ask the MCP agent:
  *"How many Miles do I have, and what can I redeem right now?"*
- Agent replies with a real balance + catalog suggestion.

---

## 4. Q&A cheat sheet

Expected questions & one-liner answers:

| Question                                           | Answer                                                                                                               |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| *Is this real Deriv data?*                         | Yes. OTP-signed v2 WebSocket for authenticated sessions; legacy v3 only as fallback. The pill in the corner shows which is live. |
| *How do you prevent Miles abuse?*                  | Every `awardXP` call is idempotent on `(source_type, source_id)`. First-time rewards use a stable per-user source id. |
| *Can partners really earn commission?*             | Yes — `ShareGameModal` embeds their `app_id` via `buildPartnerTrackingUrl`; every trade is attributed.               |
| *How is ranking gamed-resistant?*                  | Sortino ratio + policy engine. Reckless bots with high raw P&L get penalized by negative-return standard deviation.  |
| *What about regulatory / responsible gambling?*    | Demo-first. Real deposits gated behind the 85th-percentile prompt. Partner-branded so disclosures carry through.     |
| *Could I run this as an AI agent only?*            | Yes — the MCP server exposes 11 tools covering competitions, Miles, and redemptions. Claude Desktop and OpenClaw work out of the box. |
| *Where's the code?*                                | GitHub repo `solankiharsh/deriv-arena-hackathon`. Architecture in `README.md` and `docs/ROADMAP.md`.                 |
| *What's your stack?*                               | Go + Chi + Postgres on Railway; Next.js 16 + Tailwind on Vercel; Deriv API V2.                                       |
| *How long did this take?*                          | (Be honest — hackathon timeframe. Emphasize the conversion-loop design, not just the code volume.)                   |

---

## 5. Fallbacks & contingencies

Prep these clips in a slide deck before the demo so you can cut to them if a
scene fails live:

| Scene | Fallback artifact                                          |
| ----- | ---------------------------------------------------------- |
| 3     | Pre-recorded 30s of live trading on `/compete/[id]`       |
| 4     | 10s loop of the Command Center pulse animation             |
| 5     | Screenshot of a complete Copilot response with a widget    |
| 6     | Screenshot of the Marketplace redemption success modal     |
| 7     | Screenshot/video of the `Percentile85Modal` firing         |
| 8     | Screenshot of the MCP agent's Telegram response            |

Common failure modes and 10-second fixes:

- **`Deriv Offline` pill** → sign out and back in; OTP token expired.
- **Marketplace shows 0 miles** → Railway `CORS_ORIGINS` regressed; edit via
  the Railway API and redeploy the backend service.
- **Copilot hangs** → check `OPENAI_API_KEY` on Vercel; skip to widget
  screenshot.
- **OAuth bounces to `?error=session_expired`** → cookies TTL'd out; click
  "Continue with Deriv" again in a fresh tab.
- **Share modal partner ID blank** → you're not logged in as a partner
  account. Switch profile.

---

## 6. What to **not** show

Be deliberate about the surface area. These pages exist but don't add demo
value and can sidetrack the story:

- `/arena/map`, `/arena/predictions` — half-finished experiments.
- `/treasury-flow`, `/war-room`, `/phantom-ledger` — internal dashboards.
- `/votes`, `/competitions/[id]` deep links — wordy.
- The admin routes — not for judges.

If a judge asks about them, the answer is *"adjacent surface area; the loop
is the product."*

---

## 7. Immediate post-demo

- [ ] Grab the Railway backend logs while the demo is fresh:
      `railway logs --service deriv-arena-hackathon --last 30m`.
- [ ] Export a fresh Miles transaction dump for any judge account you
      granted Miles to (for auditability).
- [ ] Rotate the Vercel / Railway tokens if you showed any secrets on
      camera. Double-check the recording for tokens before publishing.
- [ ] Note every question you couldn't answer in the Q&A — update this
      document and `YOUTUBE_VIDEO_SCRIPT.md` accordingly.

---

## 8. One-liner for intros

> *"DerivArena is a gamified trading platform built on Deriv's v2 API.
> Play exotic contract competitions, deploy AI agents to trade for you,
> learn with a Deriv-grounded Copilot, earn Miles for every skilled move,
> redeem them in a real Marketplace, and — when you're good enough — get
> contextually nudged to open a real Deriv account. Same platform,
> reachable via MCP for any AI agent. Built for Deriv API Grand Prix 2026."*

Say that in 22 seconds and you've landed the elevator pitch.
