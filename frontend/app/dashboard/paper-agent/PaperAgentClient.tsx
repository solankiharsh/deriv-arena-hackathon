'use client';

const GOLD = '#E8B45E';
const BG = '#07090F';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Bot, ChevronLeft, Play, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { AgentDataFlow } from '@/components/dashboard';
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

export function PaperAgentClient() {
  const [policy, setPolicy] = useState<AgentPolicy>(() => ({ ...parseAgentPolicy(null) }));
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [returns, setReturns] = useState<number[]>([0.0001, -0.00005, 0.00012, 0.00008, -0.00002]);
  const [lastQuote, setLastQuote] = useState(1000);
  const [barIndex, setBarIndex] = useState(0);
  const [ledger, setLedger] = useState<PaperLedger>(() => new PaperLedger(10_000));
  const [lastSwarm, setLastSwarm] = useState<SwarmResult | null>(null);
  const [lastConf, setLastConf] = useState(0.45);

  useEffect(() => {
    const p = loadAgentPolicyFromStorage();
    setPolicy(p);
    const L = loadPaperLedgerFromStorage();
    if (L) {
      setLedger(L);
    } else {
      setLedger(new PaperLedger(p.deployment.paperStartingCash));
    }
    setLastQuote(1000);
  }, []);

  const symbol = policy.preferences.primarySymbol;

  const derivedPreview = useMemo(() => {
    const snap = ledger.snapshot(lastQuote);
    return policyToTradingRuntime(policy, {
      winStreak: winStreakFromLedger(ledger),
      confidence: lastConf,
      equityApprox: snap.equityApprox,
    });
  }, [policy, ledger, lastQuote, lastConf]);

  const ctx: MarketContext = useMemo(
    () => ({
      symbol,
      lastQuote,
      returns: returns.slice(-derivedPreview.returnsLookback),
      sentimentPlaceholder: sentimentFromPolicy(policy, policy.preferences.strategyNotes),
    }),
    [symbol, lastQuote, returns, derivedPreview.returnsLookback, policy],
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
    const snap = ledger.snapshot(lastQuote);
    const streak = winStreakFromLedger(ledger);
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
    setLedger((prev) => {
      prev.applyPaperStep({
        symbol,
        markQuote: lastQuote,
        action: swarm.fused.action,
        confidence: swarm.fused.confidence,
        knobs: knobsForPaper,
        barIndex,
        maxOpenBars: rt.maxOpenBars,
      });
      savePaperLedgerToStorage(prev);
      return deserializePaperLedger(serializePaperLedger(prev)) ?? prev;
    });
    setBarIndex((b) => {
      toast.message(`Bar ${b}: ${swarm.fused.action}`);
      return b + 1;
    });
  }, [ctx, policy, symbol, lastQuote, barIndex, ledger, lastConf]);

  const pushSyntheticBar = useCallback(() => {
    const drift = (Math.sin(barIndex / 3) * 0.00015 + (barIndex % 5 === 0 ? 0.00008 : 0)) as number;
    const noise = (Math.random() - 0.5) * 0.00006;
    const r = drift + noise;
    setReturns((prev) => [...prev.slice(-60), r]);
    setLastQuote((q) => Math.max(1e-6, q * (1 + r)));
  }, [barIndex]);

  const resetLedger = useCallback(() => {
    clearPaperLedgerStorage();
    const cash = policy.deployment.paperStartingCash;
    setLedger(new PaperLedger(cash));
    setBarIndex(0);
    setLastConf(0.45);
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
            Configure agent policy (wizard), then run the swarm against Deriv-style returns. Stakes and timing follow your money approach, patience, and
            personality.
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
              Market sim
            </h2>
            <p className="text-[10px] text-white/35 font-mono">Symbol {symbol}</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  pushSyntheticBar();
                  toast.message('Synthetic bar');
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
          <PaperStatePanel ledger={ledger} lastQuote={lastQuote} barIndex={barIndex} />
        </div>

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
