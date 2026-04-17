# DerivArena — YouTube Video Script

A **6–8 minute** explainer / product video. Written to be punchy enough for cold
traffic, but dense enough to serve as the definitive platform walkthrough for the
Deriv API Grand Prix 2026 submission.

---

## 1. Pre-production checklist

Before you press record, confirm:

- [ ] Latest prod is live on **https://deriv-arena-hackathon-beta.vercel.app**
- [ ] You are signed in as a partner account (so `/partner`, `/create`, share
      modal, and 85th-percentile deposit prompt are all reachable).
- [ ] Railway backend is healthy — visit
      `https://deriv-arena-hackathon-production.up.railway.app/health` and
      confirm `"status":"ok"`.
- [ ] Your Deriv demo account has enough balance to place at least 3 exotic
      trades live on camera.
- [ ] The **DerivStreamStatus** pill in the bottom-right reads **"Deriv Live"**
      (green). If it's amber ("Fallback"), re-log so OTP auth refreshes.
- [ ] You've already run a game instance to finish once today so you have
      Miles showing in `/miles`, transactions in the ledger, and at least one
      redeemed item in `/marketplace`.
- [ ] OBS / ScreenStudio window captures **only the browser** at 1920×1080.
- [ ] Browser zoom is 100%, bookmarks bar hidden, dev tools closed, a clean
      incognito-style window with no extensions.
- [ ] Put `/trading-copilot` behind a second tab so you can cut to it without
      waiting for entitlement load.
- [ ] Prepare a phone on the side with **Telegram** open — you'll show the
      OpenClaw/MCP agent live responding. Keep the phone frame in a corner
      picture-in-picture so viewers see both.

## 2. Equipment & setup

| Purpose         | Tool                                               |
| --------------- | -------------------------------------------------- |
| Screen capture  | OBS Studio (1080p60) or ScreenStudio               |
| Voice           | Good USB mic, record ambient room-off              |
| Webcam          | 1080p, 16:9 circular crop, bottom-right overlay    |
| Editing         | Descript / Premiere / CapCut — your choice         |
| Captions        | Auto-captions + manual proofread                   |
| Music           | Subtle synthwave bed, -22 LUFS, duck under voice   |

## 3. Shot list (at a glance)

| #  | Duration | Scene                                      | Primary capture                                       |
| -- | -------- | ------------------------------------------ | ----------------------------------------------------- |
| 1  | 0:00–0:20| Hook — "4%"                                | Slow zoom into home hero                              |
| 2  | 0:20–0:50| The problem                                | Animated counter `4%` → `> 10%`                       |
| 3  | 0:50–1:30| The Journey Loop                           | `/` — the new `JourneyLoop` diagram                   |
| 4  | 1:30–2:40| Play & Compete                             | `/arena`, `/compete/[id]`, live ticks + chart         |
| 5  | 2:40–3:30| Deploy AI Agents                           | `/dashboard` — Command Center pulse animation        |
| 6  | 3:30–4:10| Learn with Copilot                         | `/trading-copilot` — streaming response + widgets     |
| 7  | 4:10–4:50| Earn Miles → Marketplace                   | `/miles` + `/marketplace` redemption                  |
| 8  | 4:50–5:30| Go Real on Deriv (85th percentile)         | `/play/[id]` results → Percentile85Modal              |
| 9  | 5:30–6:10| Share & Partner                            | Partner branded share modal → Telegram share         |
| 10 | 6:10–6:45| MCP / OpenClaw                             | Telegram PiP: "what can I redeem with my miles?"     |
| 11 | 6:45–7:30| Tech behind it                             | DerivStreamStatus, Deriv API V2, Sortino, Vercel+Rail |
| 12 | 7:30–8:00| Call to action                             | Logo, URL, "Built for Deriv API Grand Prix 2026"      |

---

## 4. Script (word-for-word narration)

> Brackets `[LIKE THIS]` are director notes / B-roll / on-screen text — do not read them.

### SCENE 1 — Hook (0:00 – 0:20)

**[Cold open. Silent half-second, then hard cut to the DerivArena home
hero. Title overlay: "Only 4% of demo traders ever deposit."]**

> "Four percent.
>
> Out of every hundred people who sign up to try trading, only four ever put
> real money in. That's a leaky pipe. And it's the exact problem Deriv asked
> us to solve."

**[Cut to the hero glitch text: "A conversion engine disguised as a game."]**

> "So we built one."

### SCENE 2 — The Problem (0:20 – 0:50)

**[Full-screen animated tile: BUSINESS_PROBLEMS section of the home page —
`4%` ticking to `> 10%`, then `18.9K fake accounts`, then
`WhatsApp deposits → active funnel`.]**

> "Deriv's internal numbers are brutal. Four percent signup-to-deposit.
> Thousands of fake accounts within days. Zero warm leads coming out of
> WhatsApp partner channels. Demo accounts go nowhere, and partners
> run out of things to share.
>
> DerivArena fixes this by turning the whole funnel into a single loop."

### SCENE 3 — The Loop (0:50 – 1:30)

**[Scroll home page down to the new "DerivArena Loop" animated diagram.
Leave it on-screen, let the pulses run for three full seconds with no
voiceover. Then voiceover resumes.]**

> "Everything in DerivArena sits inside one loop: **Play → Deploy Agents →
> Learn → Earn Miles → Spend in Marketplace → Go Real on Deriv**. And every
> pulse you're seeing on screen is a real signal running through the
> platform right now — Deriv ticks, Miles, MCP calls, share events.
>
> Let's walk through it the way a real trader would."

### SCENE 4 — Play & Compete (1:30 – 2:40)

**[Cut to `/arena`. Pick a live competition card. Click "Join". Cut to
the `/compete/[id]` or `/play/[id]` screen mid-match. Live ticks visible in
the chart.]**

> "Step one — you **play**. You don't deposit, you don't even pick a broker.
> You just pick a competition — which is running on Deriv's exotic
> synthetic indices, 24/7, unaffected by real-world events.
>
> These are contracts you can't practice anywhere else: Accumulators that
> grow tick-by-tick, Multipliers with up to 1000× leverage, Digit contracts
> that bet on the last digit of a price tick, classic Rise/Fall.
>
> Every single tick on this chart is coming through Deriv's v2 WebSocket
> API — you can see that in the corner right now."

**[Zoom briefly to the DerivStreamStatus pill, expand it: 'Deriv Live —
trading/v1 (new)'.]**

> "And we rank by **Sortino ratio**, not raw P&L. Which means the person
> at the top didn't just get lucky — they managed their downside. Skill
> wins, not variance."

### SCENE 5 — Deploy AI Agents (2:40 – 3:30)

**[Cut to `/dashboard` — the Command Center pulse animation with the four
feeds flowing into the central agent.]**

> "Step two — you can also **deploy an AI agent**. Instead of trading
> yourself, you can spin one up, pick a strategy, and let it trade live
> Deriv ticks inside the arena while you watch.
>
> The agent ingests four live feeds: Deriv tick data, technical patterns,
> news & social sentiment, and partner strategy overrides. Every decision
> it makes is audit-logged, so when it wins or loses you can replay exactly
> why."

**[Click one of the feed cards → the side sheet opens showing the data
source detail.]**

> "This isn't a toy. It's a real agent harness — the same shape you'd build
> if you were a quant fund with a single synthetic-index strategy."

### SCENE 6 — Learn with Copilot (3:30 – 4:10)

**[Cut to `/trading-copilot`. Type a real question: "Explain the risk of
a 10% accumulator growth rate on VOL100 right now." Let the streaming
response play.]**

> "Step three — you **learn**. The Trading Copilot is a streaming AI
> workspace that's grounded in Deriv's own docs — so the answers aren't
> hallucinated, they're quoted.
>
> It explains exotic contracts, critiques your entries, flags when a
> position is taking on too much tail risk — all with real context about
> what you just traded."

**[Cut to a Copilot widget rendering a signal card — the structured UI
output, not just text.]**

> "And because Copilot responses are structured, you don't just get a
> wall of text — you get actionable cards you can act on."

### SCENE 7 — Earn Miles → Marketplace (4:10 – 4:50)

**[Cut to `/miles`. Camera focuses on the "Quick Wins" card and the
recent transactions feed.]**

> "Now here's where it gets interesting. Everything you just did paid you
> in **Deriv Miles**. Think of it like a credit-card rewards program for
> skill.
>
> Join a competition — 100 Miles. First trade — 125. First full match —
> 175. Share the game link — 100 more. Pull off a five-win streak —
> 1,000. It's all visible, it's all logged, and it's all idempotent."

**[Cut to `/marketplace`. Hover over `AI Chart Analyst — 5 credits` and
click Redeem. Show the confirmation modal → success toast.]**

> "And those Miles are spendable. Redeem them for AI chart analysis credits,
> Trading Copilot passes, pro trading signals — anything that makes you
> a better trader, funded by the game you already played for free."

### SCENE 8 — Go Real on Deriv (4:50 – 5:30)

**[Cut to a competition results screen where the player is ≥ 85th
percentile. The `Percentile85Modal` fires.]**

> "At some point you get good. And when you do — when you cross the 85th
> percentile — something different happens. Deriv itself asks you to open
> a real account. Not a spammy banner. A contextual, partner-tracked
> deposit prompt that only fires when the numbers say you're ready."

**[Click through the modal → Deriv signup page (cut to still frame, don't
actually sign up on camera).]**

> "That's the core conversion bridge. 4% becomes 10% because people deposit
> when they've already *earned* the right to."

### SCENE 9 — Share & Partner (5:30 – 6:10)

**[Cut to `/create` → pick a template → "Share". The ShareGameModal opens
with the partner ID pill visible.]**

> "For partners, this replaces cold-sharing. Every competition you create
> has your affiliate ID baked into the link. You don't post "deposit on
> Deriv", you post "beat my score on this 15-minute synthetic index
> challenge."

**[Click the Telegram share button. Cut to Telegram opening with the
prefilled message.]**

> "Share it to Telegram, WhatsApp, or X in one click. Every trade your
> referral places on DerivArena goes through your `app_id` — so
> commission tracking just works."

### SCENE 10 — MCP / OpenClaw (6:10 – 6:45)

**[Picture-in-picture: phone with Telegram + DerivArena Agent chat.
Type: "how many Miles do I have, and what can I redeem right now?"]**

> "And the whole platform also runs headless. We ship an MCP server
> compatible with OpenClaw, Claude Desktop, and Telegram. So an AI agent
> — yours, mine, anyone's — can list competitions, check Miles balance,
> preview a redemption, and actually redeem it, all through a standard
> tool-calling interface."

**[Let the agent's reply stream. It should list balance and suggest
redeeming the 300-Mile AI Chart Analyst pack.]**

> "This isn't a bolt-on. It's the same API the web app uses."

### SCENE 11 — Under the hood (6:45 – 7:30)

**[Full-screen card stack. Each bullet pops in with a small chip: Deriv
API V2, Sortino, Vercel, Railway, Next.js, Postgres, MCP.]**

> "A quick note on the stack because it matters. The trading rails are
> **Deriv's v2 API over OTP-authenticated WebSockets** — we only fall
> back to the legacy v3 socket when a user isn't logged in, and you can
> see which one is active from that little pill in the corner of every
> page.
>
> Backend is Go plus Postgres, deployed to Railway. Frontend is Next.js
> on Vercel. Miles are posted atomically with database-level idempotency,
> so nothing double-credits, nothing silently drops."

### SCENE 12 — Close (7:30 – 8:00)

**[Cut back to the home page, DerivArena logo centered. Text fades in:
"deriv-arena-hackathon-beta.vercel.app" + "Built for Deriv API Grand
Prix 2026".]**

> "That's DerivArena. A gamified trading platform that turns demo
> traders into depositors, earns partners their next commission, and
> gives AI agents a first-class place to compete alongside humans.
>
> Play it yourself at the link below. And if you're on the Deriv team —
> the numbers we're chasing are right on the home page."

**[Hold on the logo for 2 seconds. End card.]**

---

## 5. B-roll shots to capture in advance

Record these **before** sitting down to narrate so you can cut them in during
editing without dead air:

1. 5-second loop of the home page `JourneyLoop` diagram pulsing.
2. 3-second zoom-in on the `DerivStreamStatus` pill expanding.
3. One full game from `/compete/[id]` start to `/play/[id]` finish,
   screen-recorded at 60 fps (10–15 min raw; you'll cut to 20s).
4. Command Center animation on `/dashboard` with all four feeds active.
5. Trading Copilot streaming a response with a widget appearing.
6. Marketplace → Redeem → success toast.
7. 85th-percentile modal firing (force it by joining a sparse instance or
   using the admin finalize endpoint).
8. Share modal → Telegram share (don't actually send; capture the
   compose screen).
9. Telegram MCP agent responding to "what can I redeem?".
10. 2-second `/health` curl output in a terminal window for the tech scene.

## 6. On-screen text overlays (cheat sheet)

| Timestamp | Lower-third text                                                   |
| --------- | ------------------------------------------------------------------ |
| 0:04      | *DerivArena — deriv-arena-hackathon-beta.vercel.app*               |
| 0:30      | *Deriv internal: 4% signup→deposit, 0 WhatsApp deposits*           |
| 1:45      | *Deriv API V2 · OTP WebSocket*                                     |
| 2:50      | *4 data feeds · audit-logged decisions*                            |
| 3:40      | *Grounded in Deriv LLMs.txt*                                       |
| 4:20      | *First-time rewards up to 600 Miles on day one*                    |
| 5:00      | *Contextual deposit nudge · Partner app_id tracked*                |
| 6:20      | *Model Context Protocol · OpenClaw · Claude Desktop · Telegram*    |

## 7. Editing notes

- Keep every cut under **2.5 s** of static content to maintain pacing.
- When showing the pulse animations, **don't** talk over the first two
  seconds of the first appearance; let the motion do the selling.
- The Deriv logo should appear on screen exactly **twice**: once at the
  85th-percentile modal, once in the close card.
- Prefer sidebar-overlay webcam composition; the platform UI itself is the
  star, keep yourself small.
- Caption everything. Mute music under dialogue to -32 dB.

## 8. Thumbnail & title

- **Primary title:** *"I built a platform that converts demo traders into
  real depositors — using Deriv's own API."*
- **Alternate:** *"Can gamification fix Deriv's 4% conversion problem?"*
- **Thumbnail:** left side — large `4%` with a red X, right side — the
  DerivArena logo with `> 10%` in gold. Bottom-right corner: a small
  screenshot of the Journey Loop diagram.
