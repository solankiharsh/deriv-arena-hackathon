'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Rocket,
  Scale,
  Zap,
  Shuffle,
  Anchor,
  Sparkles,
  Trophy,
  ShieldCheck,
  BarChart3,
  Brain,
  GitBranch,
  ChevronDown,
  ChevronUp,
  BookOpen,
} from 'lucide-react';
import GradientText from '@/components/reactbits/GradientText';

const GOLD = '#E8B45E';

const ARCHETYPES = [
  {
    icon: Rocket,
    name: 'Momentum Rider',
    accent: '#F97316',
    blurb:
      'Trades with the trend. Reads strength, holds through noise, exits into exhaustion. Thrives in directional markets.',
  },
  {
    icon: Scale,
    name: 'Mean Reverter',
    accent: '#10B981',
    blurb:
      'Fades extremes. Sells strength, buys weakness, leans on overextension. Shines in choppy, range-bound regimes.',
  },
  {
    icon: Zap,
    name: 'Scalper',
    accent: '#EAB308',
    blurb:
      'High frequency, tiny size, short holds. Lives on the spread, dies on the slippage. Precision is the whole strategy.',
  },
  {
    icon: Shuffle,
    name: 'Contrarian',
    accent: '#EC4899',
    blurb:
      'Trades against consensus. Positions when sentiment is one-sided. High variance, big asymmetric payoff when right.',
  },
  {
    icon: Anchor,
    name: 'Whale',
    accent: '#6366F1',
    blurb:
      'Lower frequency, larger conviction, longer holds. Patient entries, structural exits. Size is the edge.',
  },
];

const FAQ_ITEMS = [
  {
    q: 'How do I improve my score?',
    a: 'Your score is driven by the Sortino ratio of your session: risk-adjusted returns that penalize downside volatility, not upside. Focus on cutting losing streaks early, sizing consistently, and avoiding tilt-driven revenge trades. The AI coach surfaces the specific pattern that is hurting you most this session.',
  },
  {
    q: 'Why do I see trader archetypes ("Phantom League")?',
    a: 'In Phantom League mode, the five archetypes simulate alternate versions of you trading the same market. They let you see what a disciplined scalper or patient whale would have earned on the exact tape you just traded, so you can benchmark your own style against a population of plausible strategies.',
  },
  {
    q: 'How is this different from just running a demo account?',
    a: 'Demo accounts measure P&L. DerivArena measures skill. A lucky 4-trade win streak on demo looks identical to a structurally sound session; our Sortino + behavioral scoring separates the two so you can tell whether you are actually getting better.',
  },
  {
    q: 'Is my trade data shared?',
    a: 'DerivArena only records trades you place inside simulated competition sessions. Arena sessions live in the arena database; we never touch your private Deriv account or broker data without an explicit live-trading opt-in.',
  },
  {
    q: 'Why am I not on the public leaderboard?',
    a: 'The global leaderboard only surfaces traders who have completed at least one ranked session. Join a competition, play it to completion, and you will appear on the next SSE refresh (which streams updates in real time, not on a 24-hour batch).',
  },
  {
    q: 'What does "tilt" mean here?',
    a: 'Tilt is a behavioral score (0-100) computed from your recent trading cadence: revenge sizing, shortening hold times, breaking your own rules after losses. When tilt > 60, the AI coach intervenes with a pre-mortem prompt before your next trade.',
  },
];

const DELIVERY_PHASES = [
  {
    id: 0,
    title: 'Phase 0 — Foundation',
    status: 'Shipped',
    bullets: ['Dev environment + Makefile', 'PostgreSQL schema + migrations', 'CI + lint guardrails'],
  },
  {
    id: 1,
    title: 'Phase 1 — Core Arena MVP',
    status: 'Shipped',
    bullets: ['Competition CRUD', 'Sortino scoring engine', 'Real-time SSE leaderboard'],
  },
  {
    id: 2,
    title: 'Phase 2 — Gamified Modes',
    status: 'Shipped',
    bullets: ['Classic Arena, Boxing Ring, War Room', 'Phantom League, Anti-You, Behavioral X-Ray'],
  },
  {
    id: 3,
    title: 'Phase 3 — Conversion Engine',
    status: 'Shipped',
    bullets: ['Threshold nudges', 'AI coach + branched timelines', 'XP + rank progression'],
  },
  {
    id: 4,
    title: 'Phase 4 — Partner & Admin',
    status: 'Shipped',
    bullets: ['Template authoring', 'Funnel analytics', 'Referral attribution'],
  },
  {
    id: 5,
    title: 'Phase 5 — Deriv V2 live trading',
    status: 'Shipped',
    bullets: ['OAuth PKCE', 'Authenticated WebSocket', 'Real-money contracts'],
  },
];

export default function WhitepaperPage() {
  const [techOpen, setTechOpen] = useState(false);

  return (
    <div className="min-h-screen bg-bg-primary">
      <div className="container-colosseum py-12 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="text-center mb-10"
        >
          <div className="flex items-center justify-center gap-2 mb-3 text-[11px] font-mono uppercase tracking-[0.25em] text-accent-primary">
            <BookOpen className="w-3.5 h-3.5" />
            <span>Whitepaper</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-display font-bold mb-4">
            <GradientText
              colors={['#E8B45E', '#F5C978', '#D6A04B', '#E8B45E']}
              animationSpeed={4}
              className="font-display font-bold"
            >
              Understanding DerivArena
            </GradientText>
          </h1>
          <p className="text-text-secondary max-w-2xl mx-auto text-sm sm:text-base">
            A guide to how we measure trading skill, simulate competition, and turn practice into
            progress.
          </p>
        </motion.div>

        <section className="glass rounded-card p-6 mb-6">
          <h2 className="text-lg font-display font-bold mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4" style={{ color: GOLD }} />
            Why we built this
          </h2>
          <p className="text-sm text-text-secondary leading-relaxed mb-4">
            Most traders never see the difference between a lucky week and a skilled one. P&L alone
            cannot tell you whether you are actually improving. DerivArena makes that difference
            visible.
          </p>
          <ul className="space-y-2 text-sm text-text-secondary">
            <li className="flex items-start gap-2">
              <span className="text-accent-primary mt-0.5">✓</span>
              <span>
                Rank traders by <span className="text-text-primary font-semibold">risk-adjusted</span>{' '}
                performance, not raw P&L, so luck cannot dominate the leaderboard.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-accent-primary mt-0.5">✓</span>
              <span>
                Surface <span className="text-text-primary font-semibold">behavioral</span> tells
                (tilt, revenge sizing, held-to-expiry drift) in real time before they cost money.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-accent-primary mt-0.5">✓</span>
              <span>
                Make practice a <span className="text-text-primary font-semibold">competition</span>{' '}
                rather than a solo activity, so traders come back and improve faster.
              </span>
            </li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="text-lg font-display font-bold mb-3 flex items-center gap-2">
            <Trophy className="w-4 h-4" style={{ color: GOLD }} />
            The Archetypes
          </h2>
          <p className="text-sm text-text-secondary leading-relaxed mb-4">
            "Good trading" does not look the same for every person. DerivArena recognises five
            archetypes, and Phantom League simulates each of them against the same tape so you can
            see which style you actually resemble.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ARCHETYPES.map((a) => {
              const Icon = a.icon;
              return (
                <div
                  key={a.name}
                  className="glass rounded-card p-4 border-l-2"
                  style={{ borderLeftColor: a.accent }}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center border"
                      style={{
                        borderColor: `${a.accent}40`,
                        background: `${a.accent}18`,
                        color: a.accent,
                      }}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="font-display font-bold text-sm text-text-primary">
                      {a.name}
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary leading-relaxed">{a.blurb}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="glass rounded-card p-6 mb-6">
          <h2 className="text-lg font-display font-bold mb-3 flex items-center gap-2">
            <BarChart3 className="w-4 h-4" style={{ color: GOLD }} />
            How it works
          </h2>
          <div className="space-y-4 text-sm text-text-secondary leading-relaxed">
            <div>
              <div className="text-text-primary font-semibold mb-1 flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-accent-primary" />
                Sortino, not raw P&L
              </div>
              <p>
                Your session score uses the Sortino ratio: excess return divided by{' '}
                <span className="text-text-primary">downside</span> volatility only. Two traders
                with identical P&L but different drawdown profiles rank differently — the calmer one
                wins.
              </p>
            </div>
            <div>
              <div className="text-text-primary font-semibold mb-1 flex items-center gap-2">
                <Brain className="w-3.5 h-3.5 text-accent-primary" />
                Behavioral X-Ray
              </div>
              <p>
                A tilt score (0-100) is computed live from your last trades: revenge sizing,
                shortening holds, breaking your own rules after losses. Above 60, the AI coach
                interrupts with a pre-mortem prompt before the next order ticket.
              </p>
            </div>
            <div>
              <div className="text-text-primary font-semibold mb-1 flex items-center gap-2">
                <GitBranch className="w-3.5 h-3.5 text-accent-primary" />
                Branched timelines
              </div>
              <p>
                After every resolved trade the engine replays the counterfactuals ("if you had
                held", "if you had paused after losses") and shows the alternate P&L. It is
                hindsight, but structured — and it is the fastest feedback loop we have found for
                changing behavior.
              </p>
            </div>
            <div>
              <div className="text-text-primary font-semibold mb-1 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-accent-primary" />
                Real-time leaderboard (SSE)
              </div>
              <p>
                The leaderboard is streamed over Server-Sent Events, so rank changes show up within
                seconds of a trade resolving — not on a 24-hour batch. Traders feel the competition
                as they play, which is where the engagement comes from.
              </p>
            </div>
          </div>
          <div className="mt-5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-200/80 flex gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
            <div>
              <span className="font-semibold text-emerald-300">Simulated sessions only.</span>{' '}
              DerivArena never touches your private Deriv account or broker data without an explicit
              live-trading opt-in. Everything in a standard arena session is a risk-free simulation.
            </div>
          </div>
        </section>

        <section className="mb-6">
          <h2 className="text-lg font-display font-bold mb-3 flex items-center gap-2">
            <Trophy className="w-4 h-4" style={{ color: GOLD }} />
            Delivery phases
          </h2>
          <p className="text-sm text-text-secondary leading-relaxed mb-4">
            DerivArena shipped in deliberate phases so each capability was validated before the next
            one landed.
          </p>
          <div className="space-y-2">
            {DELIVERY_PHASES.map((p) => (
              <div
                key={p.id}
                className="glass rounded-card p-4 flex flex-col sm:flex-row sm:items-center gap-3"
              >
                <div className="sm:w-56">
                  <div className="text-sm font-display font-bold text-text-primary">{p.title}</div>
                  <div
                    className={`text-[10px] font-mono uppercase tracking-wider mt-0.5 ${
                      p.status === 'Shipped'
                        ? 'text-emerald-400'
                        : p.status === 'In progress'
                          ? 'text-accent-primary'
                          : 'text-text-muted'
                    }`}
                  >
                    {p.status}
                  </div>
                </div>
                <ul className="flex-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-secondary">
                  {p.bullets.map((b) => (
                    <li key={b} className="flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-accent-primary" />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-6">
          <h2 className="text-lg font-display font-bold mb-3 flex items-center gap-2">
            <Brain className="w-4 h-4" style={{ color: GOLD }} />
            FAQ
          </h2>
          <div className="space-y-2">
            {FAQ_ITEMS.map((item) => (
              <details
                key={item.q}
                className="glass rounded-card px-4 py-3 group"
              >
                <summary className="cursor-pointer list-none flex items-center justify-between text-sm font-semibold text-text-primary">
                  <span>{item.q}</span>
                  <ChevronDown className="w-4 h-4 text-text-muted transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-2 text-sm text-text-secondary leading-relaxed">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mb-12">
          <button
            type="button"
            onClick={() => setTechOpen((v) => !v)}
            className="w-full glass rounded-card px-4 py-3 flex items-center justify-between hover:bg-white/[0.04] transition-colors"
          >
            <span className="flex items-center gap-2 text-sm font-display font-bold text-text-primary">
              <span className="text-accent-primary">+</span>
              Technical Deep Dive: The Algorithm
            </span>
            {techOpen ? (
              <ChevronUp className="w-4 h-4 text-text-muted" />
            ) : (
              <ChevronDown className="w-4 h-4 text-text-muted" />
            )}
          </button>
          {techOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="glass rounded-card mt-2 p-5 text-sm text-text-secondary leading-relaxed space-y-4"
            >
              <div>
                <div className="text-text-primary font-semibold mb-1">Sortino ratio</div>
                <p>
                  We compute <code className="text-accent-primary">(mean(returns) - MAR) / downside_deviation(returns)</code>,
                  where MAR is a configurable minimum acceptable return (default 0%). Only negative
                  deviations from MAR contribute to the denominator, so upside volatility does not
                  penalize you.
                </p>
              </div>
              <div>
                <div className="text-text-primary font-semibold mb-1">Trade simulator</div>
                <p>
                  Every simulated contract is parameterized by <code>asset, direction, stake,
                  duration, durationUnit</code>. The simulator derives its expiry from an explicit{' '}
                  <code>getExpiryMs(duration, unit)</code> so the UI progress bar and the settlement
                  logic always agree on "when does this contract end".
                </p>
              </div>
              <div>
                <div className="text-text-primary font-semibold mb-1">Phantom League simulation</div>
                <p>
                  Five phantoms are initialized with distinct archetype weights. On each tick, each
                  phantom samples an outcome against the current tape using its win-rate prior and
                  archetype-specific bias. Their cumulative P&L feeds the shadow leaderboard and the
                  profit-orb capture game.
                </p>
              </div>
              <div>
                <div className="text-text-primary font-semibold mb-1">Conversion thresholds</div>
                <p>
                  As your percentile crosses configured tiers (e.g. top-50%, top-25%, top-5%), the
                  conversion engine fires a single nudge per threshold per session. Nudges are
                  idempotent and time-gated so the UI never spams the trader.
                </p>
              </div>
              <div>
                <div className="text-text-primary font-semibold mb-1">Tilt detection</div>
                <p>
                  Tilt is a rolling score over the last N trades weighted by: loss streak length,
                  stake delta versus baseline, hold-time compression, and rule-break events
                  (hitting stop then re-entering). The score is independent of P&L — you can be
                  profitable and tilted at the same time.
                </p>
              </div>
            </motion.div>
          )}
        </section>
      </div>
    </div>
  );
}
