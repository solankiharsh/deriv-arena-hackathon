'use client';

const GOLD = '#E8B45E';
const BG = '#07090F';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Bot, ChevronLeft, Play, RotateCcw, Radio } from 'lucide-react';
import { toast } from 'sonner';
import { AgentDataFlow } from '@/components/dashboard';
import { useDerivPublicTicks } from '@/hooks/useDerivPublicTicks';
import {
  loadAgentPolicyFromStorage,
  parseAgentPolicy,
  policyToTradingRuntime,
  randomAgentPolicy,
  runSwarm,
  saveAgentPolicyToStorage,
  sentimentFromPolicy,
  type AgentPolicy,
  type MarketContext,
  type SwarmResult,
} from '@/lib/agents';
import {
  PaperLedger,
  clearPaperLedgerStorage,
  deserializePaperLedger,
  loadPaperLedgerFromStorage,
  savePaperLedgerToStorage,
  serializePaperLedger,
  winStreakFromLedger,
} from '@/lib/paper';
import { AgentPolicyWizard } from './AgentPolicyWizard';
import { PaperAgentRunChart, type RunHistoryPoint } from './PaperAgentRunChart';

export function PaperAgentClient() {
  const [policy, setPolicy] = useState<AgentPolicy>(() => ({ ...parseAgentPolicy(null) }));
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [simReturns, setSimReturns] = useState<number[]>([0.0001, -0.00005, 0.00012, 0.00008, -0.00002]);
  const [simQuote, setSimQuote] = useState(1000);
  const [liveFeed, setLiveFeed] = useState(false);
  const [autoStep, setAutoStep] = useState(false);
  const [barIndex, setBarIndex] = useState(0);
  const [ledger, setLedger] = useState<PaperLedger>(() => new PaperLedger(10_000));
  const [lastSwarm, setLastSwarm] = useState<SwarmResult | null>(null);
  const [lastConf, setLastConf] = useState(0.45);
  const [runHistory, setRunHistory] = useState<RunHistoryPoint[]>([]);
  const ledgerRef = useRef(ledger);
  ledgerRef.current = ledger;

  const symbol = policy.preferences.primarySymbol;
  const live = useDerivPublicTicks(symbol, liveFeed);

  const mark = liveFeed && live.quote != null ? live.quote : simQuote;
  const returns = liveFeed && live.returns.length >= 3 ? live.returns : simReturns;

  useEffect(() => {
    const p = loadAgentPolicyFromStorage();
    setPolicy(p);
    const L = loadPaperLedgerFromStorage();
    if (L) {
      setLedger(L);
    } else {
      setLedger(new PaperLedger(p.deployment.paperStartingCash));
    }
    setSimQuote(1000);
  }, []);

  const derivedPreview = useMemo(() => {
    const snap = ledger.snapshot(mark);
    return policyToTradingRuntime(policy, {
      winStreak: winStreakFromLedger(ledger),
      confidence: lastConf,
      equityApprox: snap.equityApprox,
    });
  }, [policy, ledger, mark, lastConf]);

  const ctx: MarketContext = useMemo(
    () => ({
      symbol,
      lastQuote: mark,
      returns: returns.slice(-derivedPreview.returnsLookback),
      sentimentPlaceholder: sentimentFromPolicy(policy, policy.preferences.strategyNotes),
    }),
    [symbol, mark, returns, derivedPreview.returnsLookback, policy],
  );

  const savePolicy = useCallback(() => {
    if (!policy.deployment.deploymentAcknowledged) {
      toast.error('Confirm the paper-trading notice (Launch step) before saving.');
      setWizardStep(5);
      return;
    }
    saveAgentPolicyToStorage(policy);
    toast.success('Agent policy saved locally');
  }, [policy]);

  const onWizardSave = useCallback(() => {
    if (!policy.deployment.deploymentAcknowledged) {
      toast.error('Check the acknowledgement box on Launch.');
      setWizardStep(5);
      return;
    }
    saveAgentPolicyToStorage(policy);
    toast.success('Agent policy saved');
  }, [policy]);

  const runStep = useCallback(() => {
    if (!policy.deployment.deploymentAcknowledged) {
      toast.message('Launch step: confirm paper trading notice first.');
    }
    const L = ledgerRef.current;
    const snap = L.snapshot(mark);
    const streak = winStreakFromLedger(L);
    const rt = policyToTradingRuntime(policy, {
      winStreak: streak,
      confidence: lastConf,
      equityApprox: snap.equityApprox,
    });
    const swarm = runSwarm(ctx, rt.knobs);
    const rtStake = policyToTradingRuntime(policy, {
      winStreak: streak,
      confidence: swarm.fused.confidence,
      equityApprox: snap.equityApprox,
    });
    const knobsForPaper = { ...rt.knobs, defaultStake: rtStake.knobs.defaultStake };

    setLastSwarm(swarm);
    setLastConf(swarm.fused.confidence);

    const bar = barIndex;
    setLedger((prev) => {
      const copy = deserializePaperLedger(serializePaperLedger(prev)) ?? prev;
      copy.applyPaperStep({
        symbol,
        markQuote: mark,
        action: swarm.fused.action,
        confidence: swarm.fused.confidence,
        knobs: knobsForPaper,
        barIndex: bar,
        maxOpenBars: rt.maxOpenBars,
      });
      const eq = copy.snapshot(mark).equityApprox;
      queueMicrotask(() =>
        setRunHistory((h) =>
          [...h, { bar, equity: eq, action: swarm.fused.action, score: swarm.fused.score, conf: swarm.fused.confidence }].slice(-400),
        ),
      );
      savePaperLedgerToStorage(copy);
      return copy;
    });
    setBarIndex((b) => {
      toast.message(`Bar ${b}: ${swarm.fused.action}`);
      return b + 1;
    });
  }, [ctx, policy, symbol, mark, barIndex, lastConf]);

  const runStepRef = useRef(runStep);
  runStepRef.current = runStep;
  const lastAutoRef = useRef(0);
  useEffect(() => {
    if (!liveFeed || !autoStep) return;
    if (live.quote == null || live.returns.length < 5) return;
    const t = Date.now();
    if (t - lastAutoRef.current < 2000) return;
    lastAutoRef.current = t;
    runStepRef.current();
  }, [liveFeed, autoStep, live.quote, live.returns.length]);

  const pushSyntheticBar = useCallback(() => {
    const drift = (Math.sin(barIndex / 3) * 0.00015 + (barIndex % 5 === 0 ? 0.00008 : 0)) as number;
    const noise = (Math.random() - 0.5) * 0.00006;
    const r = drift + noise;
    setSimReturns((prev) => [...prev.slice(-60), r]);
    setSimQuote((q) => Math.max(1e-6, q * (1 + r)));
  }, [barIndex]);

  const resetLedger = useCallback(() => {
    clearPaperLedgerStorage();
    const cash = policy.deployment.paperStartingCash;
    setLedger(new PaperLedger(cash));
    setBarIndex(0);
    setLastConf(0.45);
    setRunHistory([]);
    toast.message('Paper ledger reset');
  }, [policy.deployment.paperStartingCash]);

  const onRandomizePolicy = useCallback(() => {
    setPolicy(randomAgentPolicy());
    toast.message('Random policy applied — save if you want to keep it');
  }, []);

  return (
    <div className="min-h-screen pt-16 sm:pt-20 pb-8 px-4 sm:px-[8%] lg:px-[12%] relative" style={{ background: BG }}>
      <div className="relative z-10 space-y-6">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 text-[11px] font-mono uppercase tracking-wider text-white/50 hover:text-white/80"
          >
            <ChevronLeft className="w-4 h-4" />
            Command center
          </Link>
          <div className="flex items-center gap-2 text-white/60 text-[11px] font-mono">
            <Bot className="w-4 h-4" style={{ color: GOLD }} />
            {policy.identity.displayName}
          </div>
        </div>

        <div>
          <h1 className="text-lg font-black font-mono text-white tracking-tight">PAPER SWARM LAB</h1>
          <p className="text-[11px] font-mono mt-0.5 text-white/35 max-w-2xl">
            Policy drives swarm weights and paper sizing. Use{' '}
            <span className="text-white/55">live Deriv public ticks</span> for real synthetic index quotes (1HZ*, R_*), or the offline simulator.
          </p>
        </div>

        <AgentDataFlow animatePipeline={false} />

        <AgentPolicyWizard
          policy={policy}
          setPolicy={setPolicy}
          step={wizardStep}
          setStep={setWizardStep}
          onSave={onWizardSave}
          onRandomize={onRandomizePolicy}
        />

        <div className="border border-white/[0.08] rounded-lg p-3 font-mono text-[10px] text-white/50" style={{ background: 'rgba(10,12,18,0.6)' }}>
          <span className="text-amber-500/80">Derived runtime</span>
          {' · '}
          stake {derivedPreview.knobs.defaultStake} / max {derivedPreview.knobs.maxStake} · minConf {derivedPreview.knobs.minConfidenceToTrade.toFixed(2)} ·
          riskBias {derivedPreview.knobs.riskBias.toFixed(2)} · maxBars {derivedPreview.maxOpenBars} · lookback {derivedPreview.returnsLookback}
          <button type="button" onClick={savePolicy} className="ml-3 text-amber-400/90 underline-offset-2 hover:underline">
            Save policy now
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="border border-white/[0.08] rounded-lg p-4 space-y-3" style={{ background: 'rgba(18,18,26,0.5)' }}>
            <h2 className="text-xs font-bold font-mono uppercase tracking-wider" style={{ color: GOLD }}>
              Market data
            </h2>
            <div className="flex flex-wrap gap-3 items-center text-[11px] font-mono">
              <label className="flex items-center gap-2 cursor-pointer text-white/70">
                <input type="checkbox" checked={liveFeed} onChange={(e) => setLiveFeed(e.target.checked)} />
                <Radio className="w-3.5 h-3.5 text-amber-400/80" />
                Live Deriv public WS
              </label>
              <span className="text-white/35">{live.status}{live.detail ? ` — ${live.detail}` : ''}</span>
            </div>
            <label className="flex items-center gap-2 cursor-pointer text-[11px] font-mono text-white/60">
              <input type="checkbox" checked={autoStep} onChange={(e) => setAutoStep(e.target.checked)} disabled={!liveFeed} />
              Auto step (~2s throttle, needs live ticks)
            </label>
            <p className="text-[10px] text-white/35 font-mono">
              Symbol <span className="text-amber-200/90">{symbol}</span> · mark {mark.toFixed(5)} · returns {returns.length}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={liveFeed}
                onClick={() => {
                  pushSyntheticBar();
                  toast.message('Simulated bar');
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded text-[11px] font-mono uppercase border border-white/10 text-white/80 hover:bg-white/5 disabled:opacity-30"
              >
                <Play className="w-3.5 h-3.5" />
                Push sim bar
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
          <PaperStatePanel ledger={ledger} lastQuote={mark} barIndex={barIndex} />
        </div>

        <PaperAgentRunChart history={runHistory} lastSwarm={lastSwarm} />

        <TerminalSwarmPanel swarm={lastSwarm} />
      </div>
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
                    {p.side} st={p.stake}
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
