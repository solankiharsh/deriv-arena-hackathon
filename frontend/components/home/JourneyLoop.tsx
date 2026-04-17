'use client';

/**
 * `JourneyLoop`
 *
 * Home-page diagram that ties the end-to-end DerivArena product story into
 * one animated shape. Reuses the pulse-over-curved-path visual language from
 * `components/dashboard/AgentDataFlow.tsx` ("Command Center"):
 *
 *   - Static spokes from 6 pillar cards radiate toward a central core at low
 *     opacity.
 *   - A pulse engine spawns short glowing segments traveling outward from
 *     core → pillar (activation) and back from pillar → core (returning
 *     data, miles, insights).
 *   - Cards use the same corner-bracket treatment as the Command Center,
 *     each tinted with its pillar color.
 *
 * Layout intent (desktop):
 *
 *   [Play & Compete]  [Deploy AI Agents]  [Learn w/ Copilot]     ← activation
 *              ╲             │             ╱
 *               ╲   ┌──────────────────┐  ╱
 *                ══▶│ DerivArena Core  │◀══
 *                   └──────────────────┘
 *               ╱             │             ╲
 *              ╱              │              ╲
 *   [Earn Miles]   [Spend in Marketplace]   [Go Real on Deriv]   ← rewards
 *
 * Mobile collapses to a single vertical rail with the same card style and
 * colored dots, so the loop is legible on a phone without horizontal scroll.
 */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
  type SVGProps,
} from 'react';
import { motion } from 'framer-motion';
import {
  Swords,
  Bot,
  Star,
  ShoppingBag,
  Rocket,
  Cpu,
} from 'lucide-react';
import { useIsMobile } from '@/hooks/useIsMobile';

// ── Journey pillars ─────────────────────────────────────────────

type Pillar = {
  id: string;
  label: string;
  tagline: string;
  description: string;
  /** Accent color for card chrome + pulse tint. */
  color: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Which row the card sits in on desktop. */
  row: 'top' | 'bottom';
  /** Column index (0..2) within its row. */
  col: 0 | 1 | 2;
};

const PILLARS: Pillar[] = [
  {
    id: 'compete',
    label: 'Play & Compete',
    tagline: 'Free gamified trading',
    description:
      'Sortino-ranked arenas on Deriv Accumulators, Multipliers and Digit contracts. Demo-first, no deposit.',
    color: '#E8B45E',
    icon: Swords,
    row: 'top',
    col: 0,
  },
  {
    id: 'agents',
    label: 'Deploy AI Agents',
    tagline: 'Let agents trade for you',
    description:
      'Spin up an agent, pick a strategy, watch it trade live Deriv ticks. Every decision audit-logged.',
    color: '#818CF8',
    icon: Bot,
    row: 'top',
    col: 1,
  },
  {
    id: 'copilot',
    label: 'Learn with Copilot',
    tagline: 'Deriv-aware AI coach',
    description:
      'Streaming workspace grounded in Deriv docs. Entry critiques, pattern notes, risk guardrails.',
    color: '#34D399',
    icon: Cpu,
    row: 'top',
    col: 2,
  },
  {
    id: 'miles',
    label: 'Earn Deriv Miles',
    tagline: 'Trading rewards bank',
    description:
      'Join, play, finish, win, share — every move pays Miles. Like credit-card points for skill.',
    color: '#F472B6',
    icon: Star,
    row: 'bottom',
    col: 0,
  },
  {
    id: 'marketplace',
    label: 'Spend in Marketplace',
    tagline: 'Redeem for real tools',
    description:
      'Copilot credits, pro signals, chart-analyst passes, masterclasses. Miles buy the next upgrade.',
    color: '#F59E0B',
    icon: ShoppingBag,
    row: 'bottom',
    col: 1,
  },
  {
    id: 'real',
    label: 'Go Real on Deriv',
    tagline: 'Contextual deposit nudge',
    description:
      'Hit the 85th percentile and a Deriv-branded prompt opens a real account — partner-tracked, commission-ready.',
    color: '#38BDF8',
    icon: Rocket,
    row: 'bottom',
    col: 2,
  },
];

// ── Pulse engine (adapted from AgentDataFlow) ──────────────────

interface Pulse {
  id: string;
  pillarIndex: number;
  /** 'out' = core → card (activation). 'in' = card → core (rewards/data). */
  direction: 'out' | 'in';
  startTime: number;
}

function usePulseEngine(
  count: number,
  durationSec: number,
  intervalSec: number,
) {
  const [pulses, setPulses] = useState<Pulse[]>([]);

  useEffect(() => {
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    const spawn = (i: number) => {
      const pillar = PILLARS[i];
      // Top row mostly pulses from center → out (activation). Bottom row
      // mostly pulses back from card → center (rewards flowing back).
      const direction: 'out' | 'in' =
        pillar?.row === 'top'
          ? Math.random() < 0.75
            ? 'out'
            : 'in'
          : Math.random() < 0.75
            ? 'in'
            : 'out';
      setPulses((prev) => [
        ...prev,
        {
          id: `${i}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          pillarIndex: i,
          direction,
          startTime: Date.now(),
        },
      ]);
      timeouts.push(
        setTimeout(
          () => spawn(i),
          intervalSec * 1000 * (0.7 + Math.random() * 0.7),
        ),
      );
    };

    for (let i = 0; i < count; i++) {
      timeouts.push(setTimeout(() => spawn(i), Math.random() * intervalSec * 1000));
    }

    return () => timeouts.forEach(clearTimeout);
  }, [count, intervalSec]);

  useEffect(() => {
    let raf: number;
    const durationMs = durationSec * 1000;
    const tick = () => {
      const now = Date.now();
      setPulses((prev) =>
        prev.filter((p) => (now - p.startTime) / durationMs < 1),
      );
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [durationSec]);

  return pulses;
}

// ── Pulse rendering layer ───────────────────────────────────────

function PulseLayer({
  anchors,
  core,
  pulses,
  durationSec,
}: {
  anchors: { x: number; y: number }[];
  core: { x: number; y: number };
  pulses: Pulse[];
  durationSec: number;
}) {
  const pathCacheRef = useRef<Map<number, SVGPathElement>>(new Map());
  const [segments, setSegments] = useState<
    { id: string; d: string; opacity: number; color: string }[]
  >([]);

  useEffect(() => {
    pathCacheRef.current.clear();
  }, [anchors, core]);

  useEffect(() => {
    let raf: number;
    const durationMs = durationSec * 1000;

    const calc = () => {
      const now = Date.now();
      const segs: typeof segments = [];

      for (const pulse of pulses) {
        const to = anchors[pulse.pillarIndex];
        if (!to) continue;

        let path = pathCacheRef.current.get(pulse.pillarIndex);
        if (!path) {
          path = document.createElementNS(
            'http://www.w3.org/2000/svg',
            'path',
          );
          const dx = to.x - core.x;
          const dy = to.y - core.y;
          path.setAttribute(
            'd',
            `M ${core.x} ${core.y} C ${core.x + dx * 0.35} ${core.y + dy * 0.05}, ${core.x + dx * 0.65} ${core.y + dy * 0.95}, ${to.x} ${to.y}`,
          );
          pathCacheRef.current.set(pulse.pillarIndex, path);
        }

        const progress = Math.min((now - pulse.startTime) / durationMs, 1);
        if (progress <= 0 || progress >= 1) continue;

        const adj = pulse.direction === 'in' ? 1 - progress : progress;
        const length = path.getTotalLength();
        const headPos = adj;
        const tailPos =
          pulse.direction === 'in'
            ? Math.min(1, adj + 0.28)
            : Math.max(0, adj - 0.28);
        const steps = 10;
        const pts: { x: number; y: number }[] = [];
        for (let i = 0; i <= steps; i++) {
          const t = tailPos + (headPos - tailPos) * (i / steps);
          const pt = path.getPointAtLength(length * t);
          pts.push({ x: pt.x, y: pt.y });
        }
        if (pts.length < 2) continue;

        const opacity =
          Math.min(1, progress / 0.15) * Math.min(1, (1 - progress) / 0.15);
        segs.push({
          id: pulse.id,
          d:
            `M ${pts[0].x} ${pts[0].y}` +
            pts.slice(1).map((p) => ` L ${p.x} ${p.y}`).join(''),
          opacity,
          color: PILLARS[pulse.pillarIndex]?.color ?? '#E8B45E',
        });
      }

      setSegments(segs);
      raf = requestAnimationFrame(calc);
    };
    raf = requestAnimationFrame(calc);
    return () => cancelAnimationFrame(raf);
  }, [pulses, anchors, core, durationSec]);

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ overflow: 'visible' }}
      aria-hidden
    >
      <defs>
        <filter
          id="journeyPulseGlow"
          x="-100%"
          y="-100%"
          width="300%"
          height="300%"
        >
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Static connecting lines */}
      {anchors.map((to, i) => {
        const dx = to.x - core.x;
        const dy = to.y - core.y;
        const d = `M ${core.x} ${core.y} C ${core.x + dx * 0.35} ${core.y + dy * 0.05}, ${core.x + dx * 0.65} ${core.y + dy * 0.95}, ${to.x} ${to.y}`;
        return (
          <path
            key={`spoke-${i}`}
            d={d}
            fill="none"
            stroke={PILLARS[i]?.color ?? '#333'}
            strokeWidth={1.1}
            opacity={0.1}
          />
        );
      })}

      {/* Animated pulses */}
      {segments.map((seg) => (
        <g key={seg.id}>
          <path
            d={seg.d}
            fill="none"
            stroke={seg.color}
            strokeWidth={3.5}
            strokeLinecap="round"
            opacity={seg.opacity * 0.3}
            filter="url(#journeyPulseGlow)"
          />
          <path
            d={seg.d}
            fill="none"
            stroke={seg.color}
            strokeWidth={1.25}
            strokeLinecap="round"
            opacity={seg.opacity}
          />
        </g>
      ))}
    </svg>
  );
}

// ── Pillar card ────────────────────────────────────────────────

function PillarCard({
  pillar,
  mobile = false,
}: {
  pillar: Pillar;
  mobile?: boolean;
}) {
  const Icon = pillar.icon;
  const c = `${pillar.color}55`;
  return (
    <div
      className={`relative bg-[#0e0e18]/90 backdrop-blur-md ${
        mobile ? 'px-4 py-3' : 'px-4 py-3'
      } group hover:bg-[#0e0e18] transition-colors duration-200 w-full`}
    >
      <span
        className="absolute top-0 left-0 w-2.5 h-2.5 border-t border-l"
        style={{ borderColor: c }}
      />
      <span
        className="absolute top-0 right-0 w-2.5 h-2.5 border-t border-r"
        style={{ borderColor: c }}
      />
      <span
        className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b border-l"
        style={{ borderColor: c }}
      />
      <span
        className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b border-r"
        style={{ borderColor: c }}
      />

      <div className="flex items-start gap-3">
        <div
          className="w-9 h-9 flex items-center justify-center flex-shrink-0"
          style={{
            backgroundColor: `${pillar.color}15`,
            border: `1px solid ${pillar.color}35`,
          }}
        >
          <Icon
            className="w-4 h-4"
            style={{ color: pillar.color } as CSSProperties}
          />
        </div>
        <div className="min-w-0 text-left">
          <div className="text-[13px] font-bold text-white leading-tight">
            {pillar.label}
          </div>
          <div
            className="text-[9.5px] font-mono uppercase tracking-[0.15em] mt-0.5"
            style={{ color: `${pillar.color}cc` }}
          >
            {pillar.tagline}
          </div>
          <p className="text-[11px] text-white/55 leading-snug mt-1.5">
            {pillar.description}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Central core ────────────────────────────────────────────────

function CoreNode() {
  return (
    <div className="relative">
      <div className="absolute -inset-8 bg-[rgba(232,180,94,0.10)] blur-2xl pointer-events-none" />
      <motion.div
        animate={{
          boxShadow: [
            '0 0 0px rgba(232,180,94,0.2)',
            '0 0 32px rgba(232,180,94,0.38)',
            '0 0 0px rgba(232,180,94,0.2)',
          ],
        }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
        className="relative bg-[#0e0e18]/95 backdrop-blur-xl px-5 py-3 min-w-[230px]"
      >
        <span className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-[rgba(232,180,94,0.6)]" />
        <span className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-[rgba(232,180,94,0.6)]" />
        <span className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-[rgba(232,180,94,0.6)]" />
        <span className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-[rgba(232,180,94,0.6)]" />
        <div className="flex items-center gap-2 whitespace-nowrap">
          <div className="w-2 h-2 rounded-full bg-accent-primary animate-pulse" />
          <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-accent-primary">
            DerivArena Core
          </span>
        </div>
        <div className="mt-1 text-[10px] text-white/45 font-mono tracking-wide">
          sortino · miles · agents · mcp
        </div>
      </motion.div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────

export function JourneyLoop() {
  const containerRef = useRef<HTMLDivElement>(null);
  const topRowRef = useRef<HTMLDivElement>(null);
  const bottomRowRef = useRef<HTMLDivElement>(null);
  const coreRef = useRef<HTMLDivElement>(null);

  const [anchors, setAnchors] = useState<{ x: number; y: number }[]>(() => []);
  const [core, setCore] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const isMobile = useIsMobile();
  const pulses = usePulseEngine(PILLARS.length, 2.8, 3.2);

  // Measure anchor positions from actual DOM layout. This keeps the pulses
  // visually attached to the card edges even as the grid reflows at different
  // breakpoints (> mobile). Recomputes on resize and on layout-mutating
  // content loads via a ResizeObserver fallback.
  useEffect(() => {
    const measure = () => {
      const root = containerRef.current;
      if (!root) return;
      const rootRect = root.getBoundingClientRect();

      // Collect anchor points: top row cards anchor from their bottom edge,
      // bottom row cards anchor from their top edge, so pulses visually enter
      // each card at the natural side facing the core.
      const newAnchors: { x: number; y: number }[] = [];
      PILLARS.forEach((p) => {
        const rowEl = p.row === 'top' ? topRowRef.current : bottomRowRef.current;
        const cardEl = rowEl?.children[p.col] as HTMLElement | undefined;
        if (!cardEl) {
          newAnchors.push({ x: 0, y: 0 });
          return;
        }
        const r = cardEl.getBoundingClientRect();
        const x = r.left - rootRect.left + r.width / 2;
        const y =
          p.row === 'top'
            ? r.bottom - rootRect.top
            : r.top - rootRect.top;
        newAnchors.push({ x, y });
      });

      const coreEl = coreRef.current;
      let newCore = { x: rootRect.width / 2, y: rootRect.height / 2 };
      if (coreEl) {
        const cr = coreEl.getBoundingClientRect();
        newCore = {
          x: cr.left - rootRect.left + cr.width / 2,
          y: cr.top - rootRect.top + cr.height / 2,
        };
      }

      setAnchors(newAnchors);
      setCore(newCore);
    };

    measure();
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  const topPillars = useMemo(() => PILLARS.filter((p) => p.row === 'top'), []);
  const bottomPillars = useMemo(
    () => PILLARS.filter((p) => p.row === 'bottom'),
    [],
  );

  if (isMobile) {
    // Single vertical rail, loop reads top → down with a color dot per step.
    return (
      <div className="relative bg-[#0a0a12]/60 backdrop-blur-xl border border-white/[0.12] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_8px_32px_rgba(0,0,0,0.5)] p-5">
        <div className="flex items-center justify-center mb-5">
          <CoreNode />
        </div>

        <div className="relative">
          <div className="absolute left-[11px] top-0 bottom-0 w-px bg-gradient-to-b from-accent-primary/40 via-white/10 to-accent-primary/40" />
          <ul className="space-y-3 pl-7">
            {PILLARS.map((p, i) => (
              <li key={p.id} className="relative">
                <span
                  className="absolute -left-[19px] top-3.5 w-2 h-2 rounded-full"
                  style={{ backgroundColor: p.color }}
                />
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.05 }}
                >
                  <PillarCard pillar={p} mobile />
                </motion.div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="relative bg-[#0a0a12]/60 backdrop-blur-xl border border-white/[0.12] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden">
      <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-accent-primary/30 to-transparent" />

      <div ref={containerRef} className="relative px-6 py-8 lg:px-10 lg:py-10">
        <PulseLayer
          anchors={anchors}
          core={core}
          pulses={pulses}
          durationSec={2.8}
        />

        {/* Row labels give the loop an explicit narrative: inputs flow down
            into rewards, rewards feed back up. Positioned at the far edges so
            they don't compete with cards. */}
        <div className="absolute top-4 left-4 hidden xl:flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.18em] text-accent-primary/70 z-0">
          <span className="w-6 h-px bg-accent-primary/40" />
          Activation
        </div>
        <div className="absolute bottom-4 left-4 hidden xl:flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.18em] text-accent-primary/70 z-0">
          <span className="w-6 h-px bg-accent-primary/40" />
          Rewards
        </div>

        {/* Top row */}
        <div
          ref={topRowRef}
          className="grid grid-cols-3 gap-4 lg:gap-6 max-w-5xl mx-auto relative z-10"
        >
          {topPillars.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: -16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.45, delay: 0.08 * i }}
            >
              <PillarCard pillar={p} />
            </motion.div>
          ))}
        </div>

        {/* Core, spaced to give pulses room to travel */}
        <div className="flex justify-center my-12 lg:my-14 relative z-10">
          <div ref={coreRef}>
            <CoreNode />
          </div>
        </div>

        {/* Bottom row */}
        <div
          ref={bottomRowRef}
          className="grid grid-cols-3 gap-4 lg:gap-6 max-w-5xl mx-auto relative z-10"
        >
          {bottomPillars.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.45, delay: 0.08 * i }}
            >
              <PillarCard pillar={p} />
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
