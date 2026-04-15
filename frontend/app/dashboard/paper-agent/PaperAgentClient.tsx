'use client';

const GOLD = '#E8B45E';
const BG = '#07090F';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Bot, ChevronLeft, Play, RotateCcw, Save } from 'lucide-react';
import { toast } from 'sonner';
import { AgentDataFlow } from '@/components/dashboard';
import { DEFAULT_KNOBS, runSwarm, type AgentProfileKnobs, type MarketContext, type SwarmResult } from '@/lib/agents';
import {
  PaperLedger,
  clearPaperLedgerStorage,
  deserializePaperLedger,
  loadPaperLedgerFromStorage,
  savePaperLedgerToStorage,
  serializePaperLedger,
} from '@/lib/paper';

const PERSONALITY_KEY = 'derivarena-paper-personality-v1';
const MAX_ARCH = 64;
const MAX_PERSONALITY = 280;
const MAX_STRATEGY = 500;

function clampStr(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max);
}

function loadPersonality(): { archetype: string; personality: string; strategyNotes: string } {
  if (typeof window === 'undefined') {
    return { archetype: '', personality: '', strategyNotes: '' };
  }
  try {
    const raw = window.localStorage.getItem(PERSONALITY_KEY);
    if (!raw) return { archetype: 'Operator', personality: '', strategyNotes: '' };
    const o = JSON.parse(raw) as Record<string, unknown>;
    return {
      archetype: clampStr(String(o.archetype ?? 'Operator'), MAX_ARCH),
      personality: clampStr(String(o.personality ?? ''), MAX_PERSONALITY),
      strategyNotes: clampStr(String(o.strategyNotes ?? ''), MAX_STRATEGY),
    };
  } catch {
    return { archetype: 'Operator', personality: '', strategyNotes: '' };
  }
}

export function PaperAgentClient() {
  const [archetype, setArchetype] = useState('');
  const [personality, setPersonality] = useState('');
  const [strategyNotes, setStrategyNotes] = useState('');
  const [symbol, setSymbol] = useState('1HZ100V');
  const [lastQuote, setLastQuote] = useState(1000);
  const [returns, setReturns] = useState<number[]>([0.0001, -0.00005, 0.00012, 0.00008, -0.00002]);
  const [knobs, setKnobs] = useState<AgentProfileKnobs>({ ...DEFAULT_KNOBS });
  const [barIndex, setBarIndex] = useState(0);
  const [ledger, setLedger] = useState<PaperLedger>(() => new PaperLedger(10_000));
  const [lastSwarm, setLastSwarm] = useState<SwarmResult | null>(null);

  useEffect(() => {
    const p = loadPersonality();
    setArchetype(p.archetype);
    setPersonality(p.personality);
    setStrategyNotes(p.strategyNotes);
    const L = loadPaperLedgerFromStorage();
    if (L) setLedger(L);
  }, []);

  const ctx: MarketContext = useMemo(
    () => ({
      symbol,
      lastQuote,
      returns,
      sentimentPlaceholder: personality.trim() ? Math.min(1, personality.length / 280) * 0.2 - 0.1 : 0,
    }),
    [symbol, lastQuote, returns, personality],
  );

  const runStep = useCallback(() => {
    setLedger((prev) => {
      const swarm = runSwarm(ctx, knobs);
      setLastSwarm(swarm);
      prev.applyPaperStep({
        symbol,
        markQuote: lastQuote,
        action: swarm.fused.action,
        confidence: swarm.fused.confidence,
        knobs,
        barIndex,
        maxOpenBars: 12,
      });
      savePaperLedgerToStorage(prev);
      const copy = deserializePaperLedger(serializePaperLedger(prev));
      return copy ?? prev;
    });
    setBarIndex((b) => {
      const next = b + 1;
      toast.message(`Bar ${b}: step complete`);
      return next;
    });
  }, [ctx, knobs, symbol, lastQuote, barIndex]);

  const pushSyntheticBar = useCallback(() => {
    const drift = (Math.sin(barIndex / 3) * 0.00015 + (barIndex % 5 === 0 ? 0.00008 : 0)) as number;
    const noise = (Math.random() - 0.5) * 0.00006;
    const r = drift + noise;
    setReturns((prev) => [...prev.slice(-40), r]);
    setLastQuote((q) => Math.max(1e-6, q * (1 + r)));
  }, [barIndex]);

  const savePersonality = useCallback(() => {
    try {
      window.localStorage.setItem(
        PERSONALITY_KEY,
        JSON.stringify({
          archetype: clampStr(archetype, MAX_ARCH),
          personality: clampStr(personality, MAX_PERSONALITY),
          strategyNotes: clampStr(strategyNotes, MAX_STRATEGY),
        }),
      );
      toast.success('Personality saved locally');
    } catch {
      toast.error('Could not save');
    }
  }, [archetype, personality, strategyNotes]);

  const resetLedger = useCallback(() => {
    clearPaperLedgerStorage();
    const L = new PaperLedger(10_000);
    setLedger(L);
    setBarIndex(0);
    toast.message('Paper ledger reset');
  }, []);

  return (
    <div className="min-h-screen pt-16 sm:pt-20 pb-8 px-4 sm:px-[8%] lg:px-[12%] relative" style={{ background: BG }}>
      <div className="relative z-10 space-y-6">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1 text-[11px] font-mono uppercase tracking-wider text-white/50 hover:text-white/80"
            >
              <ChevronLeft className="w-4 h-4" />
              Command center
            </Link>
          </div>
          <div className="flex items-center gap-2 text-white/60 text-[11px] font-mono">
            <Bot className="w-4 h-4" style={{ color: GOLD }} />
            Paper + swarm (no live OAuth)
          </div>
        </div>

        <div>
          <h1 className="text-lg font-black font-mono text-white tracking-tight">PAPER SWARM LAB</h1>
          <p className="text-[11px] font-mono mt-0.5 text-white/35 max-w-2xl">
            Seven deterministic analyzers fuse into CALL / PUT / HOLD. Ledger is simulated cash — tune knobs to match your Command Center Deriv settings, then export behavior via localStorage.
          </p>
        </div>

        <AgentDataFlow />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div
            className="border border-white/[0.08] rounded-lg p-4 space-y-3"
            style={{ background: 'rgba(18,18,26,0.5)' }}
          >
            <h2 className="text-xs font-bold font-mono uppercase tracking-wider" style={{ color: GOLD }}>
              Personal agent
            </h2>
            <label className="block text-[10px] uppercase text-white/35">Archetype (max {MAX_ARCH})</label>
            <input
              value={archetype}
              onChange={(e) => setArchetype(clampStr(e.target.value, MAX_ARCH))}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1.5 text-sm text-white font-mono"
            />
            <label className="block text-[10px] uppercase text-white/35">Personality (max {MAX_PERSONALITY})</label>
            <textarea
              value={personality}
              onChange={(e) => setPersonality(clampStr(e.target.value, MAX_PERSONALITY))}
              rows={3}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1.5 text-xs text-white/90"
            />
            <label className="block text-[10px] uppercase text-white/35">Strategy notes (max {MAX_STRATEGY})</label>
            <textarea
              value={strategyNotes}
              onChange={(e) => setStrategyNotes(clampStr(e.target.value, MAX_STRATEGY))}
              rows={2}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1.5 text-xs text-white/90"
            />
            <button
              type="button"
              onClick={savePersonality}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-mono uppercase bg-amber-500/20 border border-amber-500/40 text-amber-200 hover:bg-amber-500/30"
            >
              <Save className="w-3.5 h-3.5" />
              Save profile
            </button>
          </div>

          <div
            className="border border-white/[0.08] rounded-lg p-4 space-y-3"
            style={{ background: 'rgba(18,18,26,0.5)' }}
          >
            <h2 className="text-xs font-bold font-mono uppercase tracking-wider" style={{ color: GOLD }}>
              Knobs (mirror dashboard)
            </h2>
            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
              <label className="text-white/40 col-span-2">Symbol</label>
              <input
                value={symbol}
                onChange={(e) => setSymbol(clampStr(e.target.value.replace(/[^\w]/g, ''), 24))}
                className="col-span-2 bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1 text-white"
              />
              <Field
                label="Default stake"
                value={knobs.defaultStake}
                onChange={(n) => setKnobs((k) => ({ ...k, defaultStake: n }))}
              />
              <Field label="Max stake" value={knobs.maxStake} onChange={(n) => setKnobs((k) => ({ ...k, maxStake: n }))} />
              <Field
                label="Min conf"
                value={knobs.minConfidenceToTrade}
                onChange={(n) => setKnobs((k) => ({ ...k, minConfidenceToTrade: n }))}
                step={0.01}
              />
              <Field label="Risk bias" value={knobs.riskBias} onChange={(n) => setKnobs((k) => ({ ...k, riskBias: n }))} step={0.05} />
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  pushSyntheticBar();
                  toast.message('Synthetic bar pushed');
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded text-[11px] font-mono uppercase border border-white/10 text-white/80 hover:bg-white/5"
              >
                <Play className="w-3.5 h-3.5" />
                Push bar
              </button>
              <button
                type="button"
                onClick={runStep}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded text-[11px] font-mono uppercase bg-amber-500/25 border border-amber-500/50 text-amber-100"
              >
                Run swarm + paper step
              </button>
              <button
                type="button"
                onClick={resetLedger}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded text-[11px] font-mono uppercase border border-red-500/30 text-red-300/90 hover:bg-red-500/10"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset ledger
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TerminalSwarmPanel swarm={lastSwarm} />
          <PaperStatePanel ledger={ledger} lastQuote={lastQuote} barIndex={barIndex} />
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  step?: number;
}) {
  return (
    <div className="col-span-1">
      <div className="text-white/40 mb-0.5">{label}</div>
      <input
        type="number"
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1 text-white"
      />
    </div>
  );
}

function TerminalSwarmPanel({ swarm }: { swarm: SwarmResult | null }) {
  const lines = useMemo(() => {
    if (!swarm) return ['> Awaiting run…'];
    const out: string[] = [];
    out.push(`> FUSED score=${swarm.fused.score.toFixed(3)} conf=${swarm.fused.confidence.toFixed(2)} → ${swarm.fused.action}`);
    out.push(`> ${swarm.fused.rationale}`);
    for (const a of swarm.analyzers) {
      out.push(`  [${a.id}] ${a.score.toFixed(2)} — ${a.rationale}`);
    }
    return out;
  }, [swarm]);

  return (
    <div className="border border-white/[0.08] rounded-lg overflow-hidden font-mono text-[11px]" style={{ background: '#0a0c12' }}>
      <div className="px-3 py-2 border-b border-white/[0.06] flex items-center gap-2 text-amber-400/90 uppercase tracking-wider text-[10px]">
        Swarm feed
      </div>
      <div className="p-3 space-y-1 max-h-[320px] overflow-y-auto text-white/75">
        {lines.map((t, i) => (
          <div key={i} className="whitespace-pre-wrap break-words">
            {t}
          </div>
        ))}
      </div>
    </div>
  );
}

function PaperStatePanel({
  ledger,
  lastQuote,
  barIndex,
}: {
  ledger: PaperLedger;
  lastQuote: number;
  barIndex: number;
}) {
  const snap = ledger.snapshot(lastQuote);
  return (
    <div className="border border-white/[0.08] rounded-lg overflow-hidden font-mono text-[11px]" style={{ background: '#0a0c12' }}>
      <div className="px-3 py-2 border-b border-white/[0.06] flex items-center justify-between text-amber-400/90 uppercase tracking-wider text-[10px]">
        <span>Paper book</span>
        <span className="text-white/40">bar {barIndex}</span>
      </div>
      <div className="p-3 space-y-2 text-white/80">
        <div>
          Cash <span className="text-amber-300">{snap.cash.toFixed(2)}</span> · Equity ≈{' '}
          <span className="text-amber-300">{snap.equityApprox.toFixed(2)}</span>
        </div>
        <div className="text-white/40">Mark {lastQuote.toFixed(5)}</div>
        <div className="border-t border-white/[0.06] pt-2 space-y-1 max-h-[240px] overflow-y-auto">
          {snap.positions.length === 0 ? (
            <span className="text-white/35">No positions</span>
          ) : (
            snap.positions
              .slice()
              .reverse()
              .map((p) => (
                <div key={p.id} className="flex justify-between gap-2">
                  <span>
                    {p.side} {p.symbol} st={p.stake}
                  </span>
                  <span className={p.status === 'open' ? 'text-emerald-400/90' : 'text-white/45'}>{p.status}</span>
                  {p.pnl != null && <span className="text-white/50">pnl {p.pnl.toFixed(2)}</span>}
                </div>
              ))
          )}
        </div>
      </div>
    </div>
  );
}
