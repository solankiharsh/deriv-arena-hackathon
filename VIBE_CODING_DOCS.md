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
│              ├─ Fix React Rules of Hooks violation (GameTimer)      │
│              ├─ Debug silent audio (autoplay policy)                │
│              └─ Final verification pass                             │
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

---

*This document was generated from actual AI conversation transcripts and development sessions during the Deriv API Grand Prix 2026 hackathon. Every prompt shown is verbatim from the development process.*
