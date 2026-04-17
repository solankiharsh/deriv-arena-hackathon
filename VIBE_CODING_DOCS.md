# Vibe-Coding Documentation: DerivArena

**Project:** DerivArena — Gamified Trading Competition Platform  
**Hackathon:** Deriv API Grand Prix 2026  
**Team:** "It works, don't ask how"  
**AI Tools Used:** Cursor IDE with Claude (Opus 4.6), subagent orchestration  

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Development Journey — Chronological Timeline](#2-development-journey--chronological-timeline)
3. [AI Prompts Breakdown & Architecture Decisions](#3-ai-prompts-breakdown--architecture-decisions)
   - [Phase 1: Repository Setup & Verification](#phase-1-repository-setup--verification)
   - [Phase 2: Local Development Environment](#phase-2-local-development-environment)
   - [Phase 3: Partner Share Links & Attribution](#phase-3-partner-share-links--attribution)
   - [Phase 4: Auth Debugging & Backend Logging](#phase-4-auth-debugging--backend-logging)
   - [Phase 5: Mobile Responsive Design](#phase-5-mobile-responsive-design)
   - [Phase 6: Analytics, Arena Tabs & Sound Effects](#phase-6-analytics-arena-tabs--sound-effects)
   - [Phase 7: Stability — Hooks & Audio Fixes](#phase-7-stability--hooks--audio-fixes)
   - [Phase 8: Arena UI Cleanup, Command Center Rewire & Deploy Debugging](#phase-8-arena-ui-cleanup-command-center-rewire--deploy-debugging)
4. [Debugging Sessions](#4-debugging-sessions)
5. [How AI Helped Architect the Solution](#5-how-ai-helped-architect-the-solution)
6. [Key Technical Decisions](#6-key-technical-decisions)
7. [Lessons Learned](#7-lessons-learned)

---

## 1. Project Overview

DerivArena is a gamified trading competition platform that converts demo traders into depositors through competitive Sortino-ranked leaderboards, AI coaching, and strategic conversion nudges. The platform addresses five validated Deriv business problems:

- **Signup-to-Deposit conversion** (currently 4%, target >10%)
- **WhatsApp acquisition** (0 deposits from 16 real accounts)
- **Partner activation** (stalled partners need activation tools)
- **API V2 adoption** (developer-as-partner model)
- **Fraud prevention** (18,915 fake accounts in 64 hours)

### Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Go 1.21 + Chi router + PostgreSQL (pgx) |
| **Frontend** | Next.js 16 + React 19 + Tailwind CSS |
| **Database** | PostgreSQL 16 |
| **Auth** | Solana wallet adapters + Deriv OAuth (arena session) |
| **Realtime** | SSE streaming + Socket.io |
| **Charts/3D** | Lightweight Charts, Recharts, Three.js, PixiJS |
| **Audio** | Howler.js |
| **AI** | OpenAI integration for coaching |

---

## 2. Development Journey — Chronological Timeline

```
┌─────────────────────────────────────────────────────────────────────┐
│                    DEVELOPMENT TIMELINE                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Phase 1 ──► Repository Copy & Verification                        │
│       │       ├─ Compare source vs destination trees (552 paths)    │
│       │       ├─ Verify all files transferred correctly             │
│       │       └─ Push to new remote repository                      │
│       │                                                             │
│  Phase 2 ──► Local Dev Environment (Podman → Homebrew)              │
│       │       ├─ Rewrite Makefile for local PostgreSQL              │
│       │       ├─ Fix DATABASE_URL port conflicts (5436 → 5432)      │
│       │       └─ Validate `make dev` full-stack startup             │
│       │                                                             │
│  Phase 3 ──► Partner Share Links & Attribution System               │
│       │       ├─ Design referral URL scheme (?ref=partnerId)        │
│       │       ├─ Build ShareGameModal (WhatsApp/Telegram/X)         │
│       │       ├─ Implement partner attribution tracking             │
│       │       └─ Create partner analytics dashboard                 │
│       │                                                             │
│  Phase 4 ──► Auth Debugging & Backend Logging                       │
│       │       ├─ Debug partner button not triggering response       │
│       │       ├─ Add structured logging to backend                  │
│       │       └─ Investigate high CPU usage (48GB Mac M4 Max)       │
│       │                                                             │
│  Phase 5 ──► Mobile Responsive Design                               │
│       │       ├─ Audit all pages and components                     │
│       │       ├─ Fix overflow, flex layouts, sticky headers         │
│       │       └─ Ensure functionality over design at conflicts      │
│       │                                                             │
│  Phase 6 ──► Analytics Timeline + Arena Tabs + Sound Effects        │
│       │       ├─ Build ReferralJourneyTimeline component            │
│       │       ├─ Port Command Center/Predictions from master        │
│       │       └─ Implement 12-sound SFX system with Howler.js       │
│       │                                                             │
│  Phase 7 ──► Stability & Bug Fixes                                  │
│       │      ├─ Fix React Rules of Hooks violation (GameTimer)      │
│       │      ├─ Debug silent audio (autoplay policy)                │
│       │      └─ Final verification pass                             │
│       │                                                             │
│  Phase 8 ──► Arena UI Cleanup, Command Center, Deploy Debugging     │
│              ├─ Slim top navbar (remove Whitepaper / Docs / X /     │
│              │  Create) and rebuild site-wide footer                │
│              ├─ Remove Leaderboard + Predictions from Arena tabs,   │
│              │  rename Command → Hub                                │
│              ├─ Replace random agent map with real bot nodes +      │
│              │  clickable P&L detail sheet                          │
│              ├─ Command Center: quest-based tasks, bot XP math      │
│              │  mirrored from backend, Activity tab                 │
│              ├─ Fix stat cards stuck at zero on Vercel              │
│              │  (force-dynamic /api/auth/me + refetch on mount)     │
│              ├─ Diagnose "bot stuck / not trading" (signals /       │
│              │  thresholds / in-memory runners lost on restart)     │
│              └─ Diagnose "Failed to fetch" on deployed app          │
│                 (NEXT_PUBLIC_API_URL + Railway CORS_ORIGINS)        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. AI Prompts Breakdown & Architecture Decisions

### Phase 1: Repository Setup & Verification

**Prompt (verbatim):**

> *"is everything there? get this up and working, this was copied from /Users/preethipalanikumar/Superposition/src/deriv-arena-hackathon-main — I need to push this to a different repo. check if everything is there that is needed"*

**What AI Did:**
- Launched **two parallel exploration subagents** — one scanning the destination workspace, another scanning the original Superposition source directory.
- Performed a full directory tree comparison (552+ paths) to verify every file was transferred.
- Checked git status, `.gitignore` configuration, and remote repository settings.
- Confirmed the project was complete and ready for the new remote (`solankiharsh/deriv-arena-hackathon.git` on branch `add/game`).

**Follow-up Prompt:**

> *"which repo is this committing to?"*

**AI Response:** Identified the git remote origin and confirmed branch targeting.

**Architecture Decision:** Keep the codebase as a monorepo with `backend/` (Go) and `frontend/` (Next.js) at the root, managed by a unified `Makefile`.

---

### Phase 2: Local Development Environment

**Prompt (verbatim):**

> *"can you make this run locally and do all the podman changes if needed"*

**Context:** The original setup required Podman/Docker for PostgreSQL. The developer wanted a simpler local setup on macOS.

**What AI Did:**
1. **Rewrote the entire `Makefile`** — replaced all Podman/Docker container commands with Homebrew-native PostgreSQL 16 commands.
2. **Fixed port conflicts** — the `.env.example` referenced port `5436` (Podman mapped), but local PostgreSQL runs on `5432`. Updated `DATABASE_URL` across:
   - Root `.env`
   - `scripts/dev.sh`
   - `Makefile` defaults
3. **Added auto-provisioning** — the `db-up` target now automatically:
   - Starts PostgreSQL via `brew services`
   - Creates the `derivarena` user if missing
   - Creates the `derivarena` database if missing
   - Grants privileges
4. **Added convenience targets** — `make stop`, `make status` for process management.

**Architecture Decision:** Use Homebrew PostgreSQL directly (no container overhead) for local development, while keeping Docker/Podman as an optional path via `scripts/quick-start.sh`.

---

### Phase 3: Partner Share Links & Attribution

**Prompt (verbatim):**

> *"task 1: the partners should be able to share the link of the game session that they create. The partners should be able to send these links across whatsapp, telegram and twitter(optional). create a template for each of them with the information in 2-3 sentences and the link for the users to click and join, the link should be clickable. we will provide an image, append that image with the preview while sending the message. Once the session is created, there should be an option to copy link (this link is the unique link to each of the game session created by the partner). Logic: when a user comes through whatsapp, telegram through this clickable link generated by the partner for one game session, we need to map the game session to the respective partner such that we track how many users came through the partner as well and update the analytics dashboard as well for the partners. The logic to map the game session for the respective partner needs to be decided as well"*

**Follow-up with image:**

> *"use the above image as the template image which will be shared. now build all together. ensure to not increase the complexity. follow the DRY principle. use minimal code to implement the changes."*

**What AI Did:**

This was the most architecturally significant feature. The AI:

1. **Explored the codebase thoroughly** — launched dedicated subagents to understand:
   - Frontend architecture (routes, components, create flow, sharing patterns)
   - Backend Go API (competition creation, `share_url`, DB layer, `partner_id`/`partner_name`)
   - Auth flow (login, session, role management)

2. **Designed the referral URL scheme:**
   ```
   /compete/{slug}?ref={partnerId}&utm_source={whatsapp|telegram|twitter|copy}
   ```
   - `ref` parameter: identifies the referring partner
   - `utm_source` parameter: tracks which channel the user came from
   - `slug`: unique identifier for each game session template

3. **Built `ShareGameModal` component** — a single reusable modal with:
   - Copy-to-clipboard with visual feedback
   - Pre-formatted WhatsApp message with deep link (`https://wa.me/?text=...`)
   - Pre-formatted Telegram share (`https://t.me/share/url?...`)
   - X/Twitter intent with tweet text and URL
   - Each channel generates a unique `utm_source` for attribution

4. **Implemented partner attribution tracking:**
   - `sessionStorage` captures `ref` parameter on landing
   - Join API passes `referred_by` + `partner_referral_clicks`
   - Partner stats API aggregates click and conversion data per source
   - Partner dashboard displays real-time analytics

5. **Added OG image support** — placed the provided image in `public/` for link previews.

**Architecture Decision:** Primary attribution data flows through **Next.js API routes + Postgres** (not the Go backend). The `?ref=` parameter is lightweight and platform-agnostic — no server-side redirects needed. Attribution is stored per-session in the browser and committed on join.

---

### Phase 4: Auth Debugging & Backend Logging

**Prompt (verbatim):**

> *"I currently do not have any logs in my backend but I face an issue where the moment I click the button partners in the signup page it doesn't trigger any response. Figure out the issue and create back-end logs to detect this."*

**Follow-up:**

> *"add logs, make the changes as well as tell me if there is any infinite loop running in the backend such that when the server is running it is consuming a lot of resources that the system fan also starts working. its a 48gb ram mac..m4 max."*

**What AI Did:**

1. **Launched an auth-flow exploration subagent** that traced the entire authentication path:
   - `/login` page → role selection → `/api/auth/role` → session update
   - Discovered there's **no separate signup page** — partner is a role assigned via `/login?step=role`
   - The "Partner" button wasn't broken; it redirected to the role selection step

2. **Added structured logging** throughout the backend Go service using `zap` logger.

3. **Investigated the high CPU usage:**
   - Checked for infinite loops in the Go backend (none found)
   - Identified likely cause: Next.js dev server with hot-reload + TypeScript compilation + the Go backend all running simultaneously
   - The dev server's webpack bundling with a large dependency tree (Three.js, PixiJS, Recharts, etc.) was the primary resource consumer — not a bug

**Architecture Decision:** The auth system uses a single login entry point with role differentiation (Player vs Partner), not separate signup flows. This simplifies the UX and reduces code duplication.

---

### Phase 5: Mobile Responsive Design

**Prompt (verbatim):**

> *"TASK2: I need the entire application in the mobile view. ensure to create a Responsive Design. we dont want trailing or overflowing sentences and other mismatches. neatly handle this requirement without increasing the complexity. ensure to follow DRY. prioritize functionality over design at a point of conflict."*

**What AI Did:**

1. **Launched multiple audit subagents in parallel:**
   - **Subagent 1:** Audited game renderers, play page, and arena components for responsive issues
   - **Subagent 2:** Audited main app pages (landing, arena, login, create, partner, compete, play, competitions, leaderboard)
   - **Subagent 3:** Read full CSS/Tailwind configuration, layout files, and navbar

2. **Created a comprehensive implementation plan** organized by priority:
   - Critical: Global layout + navbar (hamburger menu, sticky headers)
   - High: Landing page hero sections, competition cards, game grids
   - Medium: Arena dashboard, partner analytics, leaderboard tables
   - Low: Decorative elements, 3D effects, advanced animations

3. **Executed systematic fixes** using Tailwind responsive utilities:
   - `flex-row` → `flex-col sm:flex-row` patterns
   - `overflow-hidden` + `truncate` for text overflow
   - `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` for card layouts
   - Touch-friendly tap targets (minimum 44px)
   - Viewport-safe padding and margins

**Key Principle Applied:** "Functionality over design at conflicts" — when a complex visual effect broke on mobile, it was simplified rather than removed.

---

### Phase 6: Analytics, Arena Tabs & Sound Effects

**Prompt (verbatim):**

> *"Task 3: Better analytics on the partners page: It should have the timeline with branches where the branches will indicate the journey of each conversion from the referral link to conversion. Make the diagram in such a way that it starts at one point which is the referral link and ends with multiple points which is each conversion point. Add better visuals for the partner based on the data they get and make it interactive. Match with the current color palette used for the UI."*
>
> *"Task 4: Have a look at the master branch and copy the UI animation which says "deploy your agent" into this branch. copy the entire command center, predictions, map and discussions and add that to the arena in the branch in another tab next to the competition games."*
>
> *"Task 5: Add sound effects to all the games wherever you feel fits and feel free to browse and find appropriate sounds don't over do it."*

**What AI Did:**

This was the largest multi-task prompt. The AI:

1. **Planned first, then executed** — created a structured plan before writing any code, asking clarifying questions about:
   - Color palette (discovered: gold `#E8B45E`, dark backgrounds `#0A0A0F`)
   - Which master-branch components existed vs needed creation
   - Sound effect scope and library choice

2. **Task 3 — Referral Journey Timeline:**
   - Built `ReferralJourneyTimeline` component with:
     - Root node representing the referral link origin
     - Branching paths per source (WhatsApp=green, Telegram=blue, Twitter=white, Copy=gold)
     - 5-stage funnel: Clicks → Sign-ups → Redirects → Registrations → First Trades
     - Interactive tooltips showing drop-off percentages between stages
     - Animated entry with Framer Motion staggered reveals
     - Source filter pills for drilling into specific channels
     - Recent user journeys detail panel
   - Created `/api/partner/referral-journey` API route to serve aggregated data

3. **Task 4 — Arena Tabs from Master:**
   - Launched a branch-comparison subagent to identify which components existed on `master` vs `newfeat`
   - Ported Command Center, Predictions, Map, and Discussions into new arena tabs
   - Integrated alongside existing competition games tab

4. **Task 5 — Sound Effects System:**
   - Built `lib/sounds.ts` — a complete SFX engine:
     - 12 distinct sound effects (trade_place, trade_win, trade_loss, timer_warning, game_start, game_end, ui_click, powerup, chaos_alert, knockout, stage_shift, orb_capture)
     - Lazy-loads Howler.js (no SSR issues)
     - Per-sound volume tuning
     - Respects user's sound preference via settings store
     - Graceful failure (audio errors never break gameplay)
   - Placed `.wav` files in `public/sounds/`
   - Created `useSfx` hook pattern for component integration

**Architecture Decision:** The sound system uses a **singleton pattern with lazy loading** — Howler.js is only imported when the first sound is actually played, keeping the initial bundle small. Sound instances are cached in a Map for reuse.

---

### Phase 7: Stability — Hooks & Audio Fixes

**Prompt (verbatim):**

> *[Pasted full React error stack trace for GameTimer component]*
> *"What are these errors and also test the app and make sure there are no errors"*

**Follow-up:**

> *"The audio is not audible on the site. Why is not audible, check for the possible errors and fix them wherever needed. check if the audio is working as well"*

**What AI Did:**

1. **GameTimer Hooks Fix:**
   - Launched a hooks-audit subagent that scanned all listed files for Rules of Hooks violations
   - Found the bug: `useRef` was called **after** an early `return` statement in `GameTimer`
   - React's Rules of Hooks require all hooks to run in the same order every render
   - Fix: moved all `useRef` and `useState` calls above any conditional `return`

2. **Audio Debugging:**
   - Diagnosed multiple potential causes:
     - **Browser autoplay policy** — modern browsers block audio until user interaction
     - **Volume levels** — some sounds set too low
     - **Howler.js loading** — async import might not resolve before first play attempt
     - **Settings store** — `arenaSoundEnabled` might default to `false`
   - Applied fixes:
     - Ensured sound only triggers after user gesture (click/tap)
     - Verified Howler.js loads before attempting playback
     - Checked default settings store state

---

### Phase 8: Arena UI Cleanup, Command Center Rewire & Deploy Debugging

**Context:** After the initial stack was live, the remaining work was a mix of UI pruning, rewiring the Command Center so the XP bar and tasks reflected real bot activity (not `+0 XP` placeholders), turning the Map into a real bot-centric view, and then chasing down why the deployed Vercel build showed `Failed to fetch` even though everything worked locally.

**Prompt (verbatim) — UI pruning:**

> *"Task 1: I want to remove the whitepaper from the top nav bar and then put down the rest of the footer on the page. And then remove the whitepaper and twitter from the top navbar."*
>
> *"Task 2: Remove the leaderboard from the arena tab as well refer to <image>."*
>
> *"Task 3: the entire top bar is congested make it look proper and neat."*
>
> *"Task 4: those are not working on the deployed app and i dont know why. Find the error and fix that as well it should correctly track how many games played, your rating, win and win rate."*
>
> *"Task 5: remove the predictions tab as well from the arena tab."*

**Follow-up prompts:**

> *"task 1: remove the create from the top navbar but do not remove it the functionality, just remove the name of that tab from the navbar. do not break the code."*
>
> *"task 2: rename the command tab from the arena tab to hub."*
>
> *"Is the deriv fallback icon that is shown a part of the UI or a default thing? if its a part of UI can we remove it? like wherever that is there can we remove it?"* → followed by *"Can u remove that from every where."*

**What AI Did:**

1. **Plan-mode pre-flight.** Before editing anything, the AI switched to Plan mode, asked two disambiguating questions (*"Where should Whitepaper/Twitter live after leaving the navbar?"* and *"Do the stats show dashes or just go stale?"*), then produced a written plan file that enumerated every file and snippet to change and marked what was explicitly out of scope.

2. **Navbar slim + site-wide footer:**
   - `frontend/app/navbar.tsx` — removed `Whitepaper`, `API Docs`, `X/Twitter` (desktop + mobile), later removed `Create` as well (but left `/create` route + Arena page's partner/admin "+ CREATE" button intact). Unused icons (`FileText`, `XIcon`, `PlusCircle`) and the inline `XIcon` helper were dropped.
   - `frontend/app/layout.tsx` — rebuilt the inline footer into a single horizontal link row (Whitepaper | API Docs | X / Twitter | Deriv API | Telegram) so nothing pulled from the navbar got orphaned.

3. **Arena tabs trim + rename:**
   - `frontend/app/arena/page.tsx` — `ArenaTab` union narrowed to `'games' | 'live' | 'command_center' | 'map'`. `GlobalLeaderboard` + `LeaderboardRow` were deleted from the file, along with the `PredictionsTab` dynamic import. The visible label for `command_center` was later renamed to `Hub`; the internal value stayed as `command_center` so no component plumbing broke.

4. **Stats always-zero on Vercel (Task 4):**
   - Two root causes identified and fixed together:
     - `/api/auth/me` had no `dynamic`/`revalidate` export, so Vercel could serve a cached JSON response and the `arena_users` row stayed stale. Added `export const dynamic = 'force-dynamic'` and `export const revalidate = 0` in `frontend/app/api/auth/me/route.ts`.
     - `QuickStats` read from the Zustand cache and never refetched — it only got populated when the navbar first mounted `ArenaAuthButton`. Extended `QuickStats` to pull `fetchUser` from `useArenaAuth()` and call it on mount **and** on `visibilitychange === 'visible'`, so returning to the Arena tab after finishing a game refreshes Rating / Games / Wins / Win Rate without a hard reload.

5. **Map rewired to real bots:**
   - `frontend/components/arena/AgentMap.tsx` — replaced the static `AGENTS_DEF` + random sentiment/god-wallet demo loop with bot nodes pulled from `useBotStore()`. Each bot hashes into a stable color/emoji/token slot and remains draggable/clickable.
   - New `frontend/components/arena/BotMapDetailSheet.tsx` — clicking a bot opens a side sheet with `BotLevelBadge`, `BotMiniPnLChart` (via `buildCumulativePnLSeries`), and analytics fetched lazily from the bot store.
   - Empty state text nudges users to create a bot in the Hub tab when none exist yet.

6. **Command Center quest + XP rewire:**
   - New shared module `frontend/lib/arena-quest-definitions.ts` with `ARENA_QUESTS` (`join_competition`, `first_game`, `first_trade`, `finish_match`, `win_streak`, `share_link`, `referral`). The marketing demo (`quests-leaderboards-demo.tsx`) was switched to derive its list from this module so the landing page and Command Center can never drift apart.
   - New `frontend/lib/trading-bot-level.ts` mirrors the backend's `levelThresholds` from `backend/internal/tradingbot/leveling.go`, exposing `getBotXpBar(bot)` with segment-local `into/span` values.
   - `frontend/lib/command-center-bot-adapters.ts` gained `buildArenaQuestTasks(ctx)` with heuristics from arena + bot stats (e.g. `botWinStreak >= 2` satisfies "Win Streak") and non-zero `xpReward` values. The old `xpReward: 0` signal-only list became a secondary fallback.
   - `frontend/components/dashboard/AgentDataFlow.tsx` now prefetches bot trades and signals, syncs the header XP bar to `getBotXpBar(primaryBot)` via `updateAgent(...)`, and feeds a new `questCtx` into `mergeAgentTasks`. Tabs became `Tasks | Positions | Activity` (the old `Chats` section was retired in favor of a bot-signal feed).

7. **Backend trade-close fix for display:**
   - `backend/internal/tradingbot/engine.go` — paper/instant fills now set `ClosedAt` equal to `ExecutedAt`, so APIs/clients see closed trades immediately and the Command Center's Positions tab isn't stuck on "open" rows.

8. **Remove the `Deriv Fallback` badge:**
   - Earlier, a `fixed bottom-4 right-4` pill rendered from `frontend/app/layout.tsx` via `<DerivStreamStatus />`. Since it showed `Deriv Fallback` in production (the legacy v3 WS path) and read as a bug, both the render + import were removed from `layout.tsx` and the `frontend/components/deriv/DerivStreamStatus.tsx` file was deleted. The `DerivStreamStatus` *type* inside `frontend/lib/deriv/websocket.ts` stayed because the WebSocket layer itself still uses it.

**Prompt (verbatim) — trading bots not trading:**

> *"why si the bot not doing any tade ? why are they stuck ??"*

**What AI Did:** read-only diagnosis against `backend/internal/tradingbot/engine.go` and `signal_processor.go`. The `runLoop` ticks every 10 s, but a trade only fires if:

- there's at least one scored signal (technical / news / AI pattern), AND
- combined `confidence >= threshold` (roughly `0.6` conservative, `0.45` moderate, `0.3` aggressive), AND
- `MaxDailyTrades` isn't hit and the hour is inside `TimeRestrictions`.

Additional failure mode flagged: `StartBot` refuses if the bot's DB status is already `running`, but the in-memory runner is *not* re-created on backend restart. That causes the classic "UI says RUNNING, but no goroutine is ticking" zombie — `Stop` → `Start` fixes it because `StopBot` is written to mark the DB row `stopped` even when there's no runner in memory.

**Prompt (verbatim) — deployed app "Failed to fetch":**

> *"Why is it saying failed to fetch? it was working when i tested it locally now in the deployed version its not showing and when i create a new bot, its not deploying as well i click deploy bit."*
>
> (Later) *"Request URL: https://deriv-arena-hackathon-production.up.railway.app/api/bots/?user_id=… referer: https://arena.solharsh.com/ … This is the error i am getting, how to fix it?"*

**What AI Did:**

1. **First round — env var:** traced `frontend/lib/api/trading-bots.ts` to `const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8090'`. `NEXT_PUBLIC_*` is inlined at Vercel *build* time, and the Vercel project didn't have that variable, so the deployed bundle called `http://localhost:8090/api/bots/...` from the user's browser → instant `TypeError: Failed to fetch`. Fix: set `NEXT_PUBLIC_API_URL=https://deriv-arena-hackathon-production.up.railway.app` in Vercel env vars and redeploy.

2. **Second round — CORS:** after the env was fixed, requests reached Railway but the custom domain `https://arena.solharsh.com` was still blocked. Verified with `curl` that a GET returned 200 but with **no** `access-control-allow-origin` header, and the OPTIONS preflight was also missing CORS headers. Fix: extend the `CORS_ORIGINS` env on Railway to include `https://arena.solharsh.com` (comma-separated, exact match, no trailing slash), then restart the service. `backend/cmd/server/main.go` already merges `CORS_ORIGINS` into the allow list at startup — no code change needed.

**Architecture Decisions (Phase 8):**

- **One source of truth for quests.** A shared `ARENA_QUESTS` array drives both the marketing landing page and the Command Center's Tasks tab. The Command Center has no local quest copy.
- **Bot level math lives in both layers, intentionally.** `backend/internal/tradingbot/leveling.go` remains the authority; the new `frontend/lib/trading-bot-level.ts` mirrors `levelThresholds` so the XP bar can render immediately without a round trip. The two constants are kept side by side with a comment pointing at the backend file so future changes get synced.
- **Deployment assumes two envs, always.** The frontend needs `NEXT_PUBLIC_API_URL`, and the backend needs `CORS_ORIGINS` with every public hostname the frontend is served from. Adding a new domain (custom, preview, etc.) is a two-place change; nothing is auto-discovered.
- **Keep compatibility keys internal.** Renaming `Command` → `Hub` changed only the label; the `tab === 'command_center'` routing and `command_center` analytics value stayed untouched so downstream code didn't break.

---

## 4. Debugging Sessions

### Debug Session 1: Partner Button Not Responding

**Symptom:** Clicking "Partners" on the signup page produced no visible response.

**Investigation:**
```
User prompt → AI explores auth flow → Finds no separate signup page
→ Traces flow: /login → ?step=role → POST /api/auth/role
→ Realizes "Partner" button routes to role selection, not a new page
```

**Root Cause:** UX misunderstanding — the auth system uses role selection within the login flow, not a separate partner signup. The button was working but the visual feedback was insufficient.

**Fix:** Added logging around the auth endpoints and improved the UI transition when switching roles.

---

### Debug Session 2: High CPU Usage / System Fan

**Symptom:** Running the dev stack caused the system fan to spin up on a 48GB M4 Max Mac.

**Investigation:**
```
User prompt → AI checks for infinite loops in Go backend
→ No loops found → Analyzes dev stack resource usage
→ Identifies: Next.js dev server + webpack HMR + large dependency tree
  (Three.js, PixiJS, Recharts, Solana) = heavy compilation
```

**Root Cause:** Not a bug — the development environment legitimately consumes significant resources due to the breadth of dependencies being compiled and hot-reloaded simultaneously.

**Mitigation:** This is expected behavior for a dev environment of this scale. Production builds are optimized and don't exhibit this behavior.

---

### Debug Session 3: React Rules of Hooks Violation (GameTimer)

**Symptom:** React error: "Rendered more hooks than during the previous render" in GameTimer component.

**Investigation:**
```
Full stack trace provided → AI launches hooks-audit subagent
→ Scans all component files for hook-after-return patterns
→ Finds: useRef called AFTER an early return in GameTimer
→ React renders inconsistent hook count between renders
```

**Root Cause:** In `GameTimer`, a conditional early `return` appeared before `useRef` calls. When the condition changed between renders, React saw a different number of hooks.

**Fix:**
```
BEFORE (broken):
  function GameTimer({ ... }) {
    if (!active) return null;    // ← early return
    const timerRef = useRef();    // ← hook AFTER return = violation
    ...
  }

AFTER (fixed):
  function GameTimer({ ... }) {
    const timerRef = useRef();    // ← ALL hooks first
    if (!active) return null;     // ← conditional return AFTER hooks
    ...
  }
```

---

### Debug Session 4: Silent Audio on Site

**Symptom:** Sound effects were implemented but produced no audible output.

**Investigation:**
```
User report → AI checks sound system implementation
→ Verifies: Howler.js lazy import, file paths, volume levels
→ Identifies multiple potential causes:
  1. Browser autoplay policy blocking audio
  2. Settings store defaulting to sounds disabled
  3. Async Howler import race condition
```

**Root Cause:** Combination of browser autoplay restrictions and the settings store's default state.

**Fix:**
- Ensured `ensureHowler()` promise resolves before calling `.play()`
- Verified the settings store defaults `arenaSoundEnabled` to `true`
- Wrapped play calls in try-catch to prevent audio failures from breaking gameplay
- Audio only triggers after user interaction (compliant with browser policies)

---

### Debug Session 5: QuickStats Always Showed Dashes on Vercel

**Symptom:** Locally the Arena stat cards (Rating / Games / Wins / Win Rate) worked; on the deployed site they showed `—` or stayed at zero even after playing games.

**Investigation:**
```
User report → AI reads QuickStats
→ Pulls `user` from useArenaAuth() only, never refetches
→ fetchUser() ran once, on navbar mount
→ /api/auth/me had no dynamic / revalidate export
→ Vercel could cache the JSON response → stale arena_users row
```

**Root Cause:** Two layered issues: (1) the `/api/auth/me` handler was cacheable on Vercel, so the server returned stale stats; (2) even with fresh data, `QuickStats` never asked for it after the initial navbar mount.

**Fix:**
- `frontend/app/api/auth/me/route.ts` — added `export const dynamic = 'force-dynamic'` and `export const revalidate = 0` so every request re-reads the session + the `arena_users` row.
- `frontend/app/arena/page.tsx` — `QuickStats` now destructures `fetchUser` from `useArenaAuth()` and calls it on mount, plus on `document.visibilitychange === 'visible'`, so coming back to the tab after finishing a game refreshes the cards without a hard reload.

---

### Debug Session 6: "My Bot Is Stuck — Why Isn't It Trading?"

**Symptom:** Bot card showed `RUNNING` and prior trade counts (87 / 17 / 32), but no new trades appeared.

**Investigation:**
```
User prompt → AI reads engine.go runLoop (tick every 10 s)
→ processBot: MaxDailyTrades guard, TimeRestrictions guard, then signals
→ SignalProcessor.ProcessSignals:
    - scores list needs ≥1 entry (tech / news / AI pattern)
    - confidence = |weighted avg|; must be ≥ threshold
    - thresholds: aggressive 0.3, moderate 0.45, conservative 0.6
→ StartBot refuses if bot.Status == "running" and runners map lacks entry
→ In-memory runners are NOT recreated on backend restart
```

**Root Cause(s):** Most "stuck" ticks are *intentional* — low confidence, daily cap reached, or outside time window. The silent failure mode is backend restarts: the DB still says `running`, but no goroutine is ticking, so the UI looks alive while nothing happens.

**Fix / Mitigation:**
- Documented the trade-gating rules in this doc for future operators.
- Confirmed `StopBot` marks the DB `stopped` even when no runner is present in memory, so `Stop → Start` reliably re-creates a live runner.
- Flagged a future improvement: on startup, have the backend scan `trading_bots` for `status='running'` rows and rehydrate runners (not yet implemented).

---

### Debug Session 7: "Failed to fetch" on Deployed App

**Symptom:** On the Vercel build at `https://arena.solharsh.com`, the AI Trading Bots card showed `Failed to fetch` and the "Deploy First Bot" button did nothing. Same code worked on `make dev` locally.

**Investigation round 1 — env var:**
```
AI reads frontend/lib/api/trading-bots.ts
→ const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8090'
→ NEXT_PUBLIC_* is inlined at BUILD time (Vercel doesn't read .env.local)
→ Vercel project had no NEXT_PUBLIC_API_URL → bundle called localhost
→ Browser throws TypeError: Failed to fetch immediately (no server listening)
```

**Fix 1:** Added `NEXT_PUBLIC_API_URL=https://deriv-arena-hackathon-production.up.railway.app` to Vercel Production + Preview + Development envs, triggered a clean redeploy.

**Investigation round 2 — CORS:**
```
User re-ran → new error, different cause
AI hit Railway with curl using Origin: https://arena.solharsh.com
→ GET returned 200 but NO access-control-allow-origin header
→ OPTIONS preflight returned 200 but NO allow-* headers either
→ Only https://deriv-arena-hackathon-beta.vercel.app was whitelisted
```

**Root Cause:** `backend/cmd/server/main.go` builds its allowed origin list from a localhost default plus `CORS_ORIGINS` env. The custom domain `arena.solharsh.com` wasn't in that env, so the Go CORS middleware never echoed an `access-control-allow-origin`, and Chrome blocked every bot API call.

**Fix 2:** Append `https://arena.solharsh.com` (comma-separated, exact match, no trailing slash) to the Railway service's `CORS_ORIGINS` variable, then restart the Railway deployment so Go re-reads env.

**Follow-up guidance recorded in this doc:** any new domain (custom, `www.`, Vercel preview URL) must be added to `CORS_ORIGINS` *and* the frontend must have `NEXT_PUBLIC_API_URL` set before rebuild.

---

## 5. How AI Helped Architect the Solution

### Subagent Orchestration Pattern

The AI leveraged a **parallel subagent architecture** throughout development. For complex tasks, multiple specialized agents explored different parts of the codebase simultaneously:

```
Main AI Agent
├── Explore Agent: Frontend architecture (routes, components, API clients)
├── Explore Agent: Backend Go API (competition service, DB layer)
├── Explore Agent: Auth flow (login, session, role management)
├── Explore Agent: Color palette & design tokens
├── Explore Agent: Git branch comparison (master vs feature)
├── Explore Agent: Responsive audit (game components)
├── Explore Agent: Responsive audit (app pages)
└── Explore Agent: Hooks violation scanner
```

This parallel exploration meant the AI could understand the full system context in seconds rather than sequentially reading files.

### Plan-Then-Execute Methodology

For every major feature, the AI followed a consistent pattern:

1. **Explore** — Launch subagents to understand the current codebase state
2. **Plan** — Create a structured implementation plan with clear steps
3. **Validate** — Ask clarifying questions before committing to decisions
4. **Execute** — Implement changes systematically, marking progress
5. **Verify** — Check for linter errors, test builds, review output

### Dual-Stack Awareness

One of the most valuable AI contributions was maintaining awareness of the **dual data path**:

- **Go Backend** (`localhost:8090`): Competition CRUD, Sortino calculation, SSE streaming
- **Next.js API Routes** (`localhost:3000/api/*`): Auth, partner stats, instance management, admin

The AI consistently routed features to the correct stack based on context, preventing confusion between the two API surfaces.

---

## 6. Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| **Homebrew PostgreSQL over Docker** | Simpler local dev, no container overhead, faster startup |
| **`?ref=` URL parameter for attribution** | Platform-agnostic, no server redirects, works in all share contexts |
| **sessionStorage for referral persistence** | Survives page navigations within session, auto-clears, no cookie overhead |
| **Howler.js with lazy loading** | Avoids SSR issues, keeps initial bundle small, robust cross-browser audio |
| **Framer Motion for timeline** | Consistent with existing animation library, staggered reveals feel polished |
| **Single login with role selection** | DRY — one auth flow for both players and partners |
| **Sound system singleton** | One Howl instance per sound, cached in Map, prevents duplicate loading |
| **Parallel subagent exploration** | 10x faster codebase understanding for complex multi-file features |
| **Shared `ARENA_QUESTS` module** | Single source for quest copy + point values; marketing demo and Command Center tasks can't drift |
| **`trading-bot-level.ts` mirrors Go thresholds** | UI can render the XP bar instantly without a round trip; comment in both files pins them together |
| **`force-dynamic` on `/api/auth/me`** | Stops Vercel from caching the user row; stats refresh every request instead of staying at zero |
| **`CORS_ORIGINS` env on backend** | Adding new frontend hosts is a Railway env edit, not a code deploy; exact-match avoids wildcard risk |
| **Rename label, not internal key** | `Command` → `Hub` changed display only; `tab === 'command_center'` kept existing routing/analytics untouched |

---

## 7. Lessons Learned

### What Worked Well

1. **Giving AI full context** — Providing detailed requirements with examples (like the image template) resulted in more accurate first-pass implementations.

2. **DRY principle as a constraint** — Explicitly stating "follow DRY, use minimal code" kept the AI from over-engineering solutions.

3. **Functionality over design** — This prioritization rule prevented scope creep on mobile responsive work.

4. **Parallel exploration** — Subagents scanning frontend, backend, and auth simultaneously meant features were designed with full system awareness.

5. **Plan-then-execute** — Creating plans before implementation caught architectural misalignments early.

### What Was Challenging

1. **Two API surfaces** — The Go backend and Next.js API routes serving different concerns required careful routing of features.

2. **Port configuration drift** — `.env.example` said 5436, Makefile said 5432 — this kind of configuration inconsistency required manual investigation.

3. **Browser autoplay policies** — Sound effects that worked in development were silent in browsers that hadn't received a user gesture yet.

4. **Rules of Hooks** — A subtle ordering issue that only manifested at runtime, requiring careful static analysis to identify.

5. **Resource consumption** — A large dependency tree (Three.js, PixiJS, Solana stack, Recharts) makes the dev server legitimately resource-intensive.

6. **`NEXT_PUBLIC_*` is a build-time snapshot** — `.env.local` doesn't reach Vercel, and a missing env var silently falls back to `localhost:8090`, which only shows up in production as `Failed to fetch`. Always check the Vercel project env vars, not the repo.

7. **Cross-origin CORS is an env concern, not a code concern** — adding a new custom domain or Vercel preview URL can break every bot call until `CORS_ORIGINS` on the Go backend is updated *and* the service is restarted so it re-reads the env.

8. **"Running" in the DB vs in memory** — the trading bot engine's in-memory runner is authoritative for whether trades actually fire; the DB status is a projection of it. A backend restart can desync the two, and the visible fix (`Stop → Start`) is unintuitive unless you know that.

9. **Plan-mode for UI cleanup pays off** — the Phase 8 navbar/footer/tabs/stats work was safer because the plan file enumerated every edit first and listed what was deliberately out of scope, so removing components didn't silently orphan links or break keys downstream.

---

*This document was generated from actual AI conversation transcripts and development sessions during the Deriv API Grand Prix 2026 hackathon. Every prompt shown is verbatim from the development process.*
