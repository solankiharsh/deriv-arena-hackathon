'use client';

const GOLD = '#E8B45E';

import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Play, Radio, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { useDerivPublicTicks } from '@/hooks/useDerivPublicTicks';
import {
  AGENT_POLICY_CHANGED_EVENT,
  loadAgentPolicyFromStorage,
  parseAgentPolicy,
  policyToTradingRuntime,
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
  partnerRulesToPaperLimits,
  savePaperLedgerToStorage,
  serializePaperLedger,
  winStreakFromLedger,
} from '@/lib/paper';
import { PaperAgentRunChart, type RunHistoryPoint } from '@/components/dashboard/PaperAgentRunChart';
import { listCompetitions, type Competition, type PartnerRules } from '@/lib/derivarena-api';
import {
  getPaperMirrorCompetitionId,
  isPaperMirrorPostingEnabled,
  mirrorPaperClosesToCompetition,
  setPaperMirrorCompetitionId,
  setPaperMirrorPostingEnabled,
} from '@/lib/paper/competitionMirror';

function paperBlockedMessage(key: string): string {
  switch (key) {
    case 'max_stake_per_contract':
      return 'Paper step blocked: stake exceeds host max_stake_per_contract.';
    case 'max_loss_per_day':
      return 'Paper step blocked: would exceed host max_loss_per_day (UTC day).';
    case 'max_drawdown_percent':
      return 'Paper step blocked: would exceed host max_drawdown_percent.';
    default:
      return 'Paper step blocked by active competition host rules.';
  }
}

function partnerRulesMeaningful(pr: PartnerRules | null | undefined): boolean {
  if (!pr || typeof pr !== 'object') return false;
  return !!(
    pr.max_stake_per_contract
    || pr.max_loss_per_day
    || pr.max_drawdown_percent
    || pr.market_bias
    || (pr.data_source_weights && Object.keys(pr.data_source_weights).length > 0)
  );
}

export type PaperSwarmVariant = 'page' | 'embedded' | 'embedded-wide';

export function PaperSwarmRunner({
  variant = 'page',
  policy: policyProp,
  setPolicy: setPolicyProp,
}: {
  variant?: PaperSwarmVariant;
  policy?: AgentPolicy;
  setPolicy?: Dispatch<SetStateAction<AgentPolicy>>;
}) {
  const wide = variant === 'embedded-wide';
  const embedded = variant === 'embedded' || wide;
  const controlled = policyProp != null && setPolicyProp != null;
  const [internalPolicy, setInternalPolicy] = useState<AgentPolicy>(() => ({ ...parseAgentPolicy(null) }));
  const policy = controlled ? policyProp! : internalPolicy;
  const setPolicy = controlled ? setPolicyProp! : setInternalPolicy;
  const [simReturns, setSimReturns] = useState<number[]>([0.0001, -0.00005, 0.00012, 0.00008, -0.00002]);
  const [simQuote, setSimQuote] = useState(1000);
  const [liveFeed, setLiveFeed] = useState(false);
  const [autoStep, setAutoStep] = useState(false);
  const [barIndex, setBarIndex] = useState(0);
  const [ledger, setLedger] = useState<PaperLedger>(() => new PaperLedger(10_000));
  const [lastSwarm, setLastSwarm] = useState<SwarmResult | null>(null);
  const [lastConf, setLastConf] = useState(0.45);
  const [runHistory, setRunHistory] = useState<RunHistoryPoint[]>([]);
  const [partnerRulesActive, setPartnerRulesActive] = useState<PartnerRules | null>(null);
  const [activeCompetition, setActiveCompetition] = useState<Competition | null>(null);
  const [mirrorPostsEnabled, setMirrorPostsEnabled] = useState(false);
  const [mirrorCompInput, setMirrorCompInput] = useState('');
  const ledgerRef = useRef(ledger);
  ledgerRef.current = ledger;
  const activeCompetitionRef = useRef<Competition | null>(null);
  activeCompetitionRef.current = activeCompetition;
  const mirrorNoCompIdWarnedRef = useRef(false);

  const symbol = policy.preferences.primarySymbol;
  const live = useDerivPublicTicks(symbol, liveFeed);

  const mark = liveFeed && live.quote != null ? live.quote : simQuote;
  const returns = liveFeed && live.returns.length >= 3 ? live.returns : simReturns;

  useEffect(() => {
    if (!controlled) return;
    const L = loadPaperLedgerFromStorage();
    if (L) setLedger(L);
    else setLedger(new PaperLedger(policy.deployment.paperStartingCash));
    setSimQuote(1000);
  }, [controlled, policy.deployment.paperStartingCash]);

  useEffect(() => {
    if (controlled) return;
    const syncFromStorage = () => {
      const p = loadAgentPolicyFromStorage();
      setInternalPolicy(p);
      const L = loadPaperLedgerFromStorage();
      if (L) setLedger(L);
      else setLedger(new PaperLedger(p.deployment.paperStartingCash));
      setSimQuote(1000);
    };
    syncFromStorage();
    window.addEventListener(AGENT_POLICY_CHANGED_EVENT, syncFromStorage);
    return () => window.removeEventListener(AGENT_POLICY_CHANGED_EVENT, syncFromStorage);
  }, [controlled]);

  useEffect(() => {
    setMirrorPostsEnabled(isPaperMirrorPostingEnabled());
    setMirrorCompInput(getPaperMirrorCompetitionId() || '');
  }, []);

  useEffect(() => {
    let cancelled = false;
    listCompetitions('active')
      .then((rows) => {
        if (cancelled) return;
        const hit =
          rows.find((r) => partnerRulesMeaningful(r.partner_rules))
          ?? rows[0];
        setPartnerRulesActive(hit?.partner_rules ?? null);
        setActiveCompetition(hit ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setPartnerRulesActive(null);
          setActiveCompetition(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const derivedPreview = useMemo(() => {
    const snap = ledger.snapshot(mark);
    return policyToTradingRuntime(
      policy,
      {
        winStreak: winStreakFromLedger(ledger),
        confidence: lastConf,
        equityApprox: snap.equityApprox,
      },
      { partnerRules: partnerRulesActive },
    );
  }, [policy, ledger, mark, lastConf, partnerRulesActive]);

  const ctx: MarketContext = useMemo(
    () => ({
      symbol,
      lastQuote: mark,
      returns: returns.slice(-derivedPreview.returnsLookback),
      sentimentPlaceholder: sentimentFromPolicy(policy, policy.preferences.strategyNotes),
    }),
    [symbol, mark, returns, derivedPreview.returnsLookback, policy],
  );

  const savePolicyQuick = useCallback(() => {
    if (!policy.deployment.deploymentAcknowledged) {
      toast.error('Confirm the paper-trading notice in Agent Configuration → Trading persona → Launch.');
      return;
    }
    saveAgentPolicyToStorage(policy);
    toast.success('Agent policy saved locally');
  }, [policy]);

  const runStep = useCallback(() => {
    if (!policy.deployment.deploymentAcknowledged) {
      toast.message('Confirm paper trading in Agent Configuration (Launch) first.');
    }
    const L = ledgerRef.current;
    const snap = L.snapshot(mark);
    const streak = winStreakFromLedger(L);
    const rt = policyToTradingRuntime(
      policy,
      {
        winStreak: streak,
        confidence: lastConf,
        equityApprox: snap.equityApprox,
      },
      { partnerRules: partnerRulesActive },
    );
    const swarm = runSwarm(ctx, rt.knobs);
    const rtStake = policyToTradingRuntime(
      policy,
      {
        winStreak: streak,
        confidence: swarm.fused.confidence,
        equityApprox: snap.equityApprox,
      },
      { partnerRules: partnerRulesActive },
    );
    const knobsForPaper = { ...rt.knobs, defaultStake: rtStake.knobs.defaultStake };

    setLastSwarm(swarm);
    setLastConf(swarm.fused.confidence);

    const bar = barIndex;
    const copy = deserializePaperLedger(serializePaperLedger(L));
    if (!copy) {
      toast.error('Could not clone paper ledger.');
      return;
    }
    const paperRes = copy.applyPaperStep({
      symbol,
      markQuote: mark,
      action: swarm.fused.action,
      confidence: swarm.fused.confidence,
      knobs: knobsForPaper,
      barIndex: bar,
      maxOpenBars: rt.maxOpenBars,
      paperRuleLimits: partnerRulesToPaperLimits(partnerRulesActive),
    });

    if (paperRes.blockedReason) {
      toast.message(paperBlockedMessage(paperRes.blockedReason));
      return;
    }

    setLedger(copy);
    const eq = copy.snapshot(mark).equityApprox;
    queueMicrotask(() =>
      setRunHistory((h) =>
        [...h, { bar, equity: eq, action: swarm.fused.action, score: swarm.fused.score, conf: swarm.fused.confidence }].slice(-400),
      ),
    );
    savePaperLedgerToStorage(copy);

    const closes = paperRes.closed ?? [];
    if (closes.length > 0 && isPaperMirrorPostingEnabled()) {
      const cid = getPaperMirrorCompetitionId() || activeCompetitionRef.current?.id || '';
      if (cid) {
        void mirrorPaperClosesToCompetition(cid, activeCompetitionRef.current, closes).then(({ posted, errors }) => {
          if (posted > 0) {
            toast.success(`Competition: recorded ${posted} closed trade(s)`, { duration: 5000 });
          }
          if (errors.length > 0) {
            toast.error(`Competition mirror: ${errors[0]}`, { duration: 9000 });
          }
        });
      } else if (!mirrorNoCompIdWarnedRef.current) {
        mirrorNoCompIdWarnedRef.current = true;
        toast.message('Competition mirror needs an id', {
          description: 'Paste a competition UUID in the field below or set NEXT_PUBLIC_PAPER_MIRROR_COMPETITION_ID.',
          duration: 8000,
        });
      }
    }

    setBarIndex((b) => {
      toast.message(`Bar ${b}: ${swarm.fused.action}`);
      return b + 1;
    });
  }, [ctx, policy, symbol, mark, barIndex, lastConf, partnerRulesActive]);

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

  const panelClass = wide
    ? 'rounded-lg border border-white/[0.08] p-4 space-y-3.5'
    : embedded
      ? 'rounded-lg border border-white/[0.08] p-3 space-y-3'
      : 'border border-white/[0.08] rounded-lg p-4 space-y-3';
  const innerBg = embedded ? 'rgba(12,16,32,0.85)' : 'rgba(18,18,26,0.5)';

  return (
    <div className={wide ? 'space-y-5 min-w-0' : 'space-y-3 min-w-0'}>
      {!embedded && (
        <div className="border border-white/[0.08] rounded-lg p-3 font-mono text-[10px] text-white/50" style={{ background: 'rgba(10,12,18,0.6)' }}>
          <span className="text-amber-500/80">Derived runtime</span>
          {' · '}
          stake {derivedPreview.knobs.defaultStake} / max {derivedPreview.knobs.maxStake} · minConf{' '}
          {derivedPreview.knobs.minConfidenceToTrade.toFixed(2)} · riskBias {derivedPreview.knobs.riskBias.toFixed(2)} · maxBars{' '}
          {derivedPreview.maxOpenBars} · lookback {derivedPreview.returnsLookback}
          <button type="button" onClick={savePolicyQuick} className="ml-3 text-amber-400/90 underline-offset-2 hover:underline">
            Save policy now
          </button>
        </div>
      )}

      <div
        className="rounded-lg border border-white/[0.08] px-3 py-2.5 space-y-2 font-mono text-[10px]"
        style={{ background: 'rgba(10,12,18,0.55)' }}
      >
        <label className="flex items-start gap-2 cursor-pointer text-white/65">
          <input
            type="checkbox"
            checked={mirrorPostsEnabled}
            onChange={(e) => {
              const on = e.target.checked;
              setPaperMirrorPostingEnabled(on);
              setMirrorPostsEnabled(on);
            }}
            className="mt-0.5"
          />
          <span>
            <span className="text-amber-200/85">Post paper closes</span> to Go competition API (
            <code className="text-white/40">POST …/trade</code>) for leaderboard stats — join is automatic with this
            browser&apos;s trader id.
          </span>
        </label>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <span className="text-white/35 shrink-0">Competition id</span>
          <input
            value={mirrorCompInput}
            onChange={(e) => setMirrorCompInput(e.target.value)}
            onBlur={() => setPaperMirrorCompetitionId(mirrorCompInput)}
            placeholder={activeCompetition?.id || 'paste UUID or use env'}
            className="flex-1 min-w-0 bg-black/30 border border-white/10 rounded px-2 py-1 text-[10px] text-amber-100/90 placeholder:text-white/25"
          />
        </div>
        {activeCompetition?.id ? (
          <p className="text-[9px] text-white/30">
            Active competition loaded: {activeCompetition.name.slice(0, 48)}
            {activeCompetition.name.length > 48 ? '…' : ''} · contracts: {(activeCompetition.contract_types || []).join(', ')}
          </p>
        ) : (
          <p className="text-[9px] text-white/30">No active competition from API — paste id from /competitions or README.</p>
        )}
      </div>

      <div
        className={
          wide
            ? 'grid grid-cols-1 md:grid-cols-2 gap-4'
            : embedded
              ? 'grid grid-cols-1 gap-3'
              : 'grid grid-cols-1 lg:grid-cols-2 gap-6'
        }
      >
        <div className={panelClass} style={{ background: innerBg }}>
          <h2 className="text-[10px] font-bold font-mono uppercase tracking-wider" style={{ color: GOLD }}>
            Market data
          </h2>
          <div className="flex flex-wrap gap-3 items-center text-[10px] font-mono">
            <label className="flex items-center gap-2 cursor-pointer text-white/70">
              <input type="checkbox" checked={liveFeed} onChange={(e) => setLiveFeed(e.target.checked)} />
              <Radio className="w-3 h-3 text-amber-400/80" />
              Live Deriv public WS
            </label>
            <span className="text-white/35">
              {live.status}
              {live.detail ? ` — ${live.detail}` : ''}
            </span>
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-[10px] font-mono text-white/60">
            <input type="checkbox" checked={autoStep} onChange={(e) => setAutoStep(e.target.checked)} disabled={!liveFeed} />
            Auto step (~2s, needs live ticks)
          </label>
          <p className="text-[9px] text-white/35 font-mono">
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
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-mono uppercase border border-white/10 text-white/80 hover:bg-white/5 disabled:opacity-30"
            >
              <Play className="w-3 h-3" />
              Sim bar
            </button>
            <button
              type="button"
              onClick={runStep}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-mono uppercase bg-amber-500/25 border border-amber-500/50 text-amber-100"
            >
              Run swarm + step
            </button>
            <button
              type="button"
              onClick={resetLedger}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-mono uppercase border border-red-500/30 text-red-300/90 hover:bg-red-500/10"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          </div>
        </div>
        <PaperStatePanel ledger={ledger} lastQuote={mark} barIndex={barIndex} embedded={embedded} wide={wide} />
      </div>

      <PaperAgentRunChart history={runHistory} lastSwarm={lastSwarm} chartHeight={wide ? 220 : 200} />
      <TerminalSwarmPanel swarm={lastSwarm} wide={wide} embedded={embedded} />
    </div>
  );
}

function TerminalSwarmPanel({
  swarm,
  embedded,
  wide,
}: {
  swarm: SwarmResult | null;
  embedded?: boolean;
  wide?: boolean;
}) {
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
    <div
      className="rounded-lg overflow-hidden font-mono text-[10px] border border-white/[0.08]"
      style={{ background: '#0a0c12' }}
    >
      <div className="px-2 py-1.5 border-b border-white/[0.06] flex items-center gap-2 text-amber-400/90 uppercase tracking-wider text-[9px]">
        Swarm feed
      </div>
      <div
        className={`p-2 space-y-1 overflow-y-auto text-white/75 ${
          wide ? 'max-h-[min(38vh,360px)]' : embedded ? 'max-h-[200px]' : 'max-h-[320px]'
        }`}
      >
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
  embedded,
  wide,
}: {
  ledger: PaperLedger;
  lastQuote: number;
  barIndex: number;
  embedded?: boolean;
  wide?: boolean;
}) {
  const snap = ledger.snapshot(lastQuote);
  return (
    <div className="rounded-lg overflow-hidden font-mono text-[10px] border border-white/[0.08]" style={{ background: '#0a0c12' }}>
      <div className="px-2 py-1.5 border-b border-white/[0.06] flex items-center justify-between text-amber-400/90 uppercase tracking-wider text-[9px]">
        <span>Paper book</span>
        <span className="text-white/40">bar {barIndex}</span>
      </div>
      <div className="p-2 space-y-2 text-white/80">
        <div>
          Cash <span className="text-amber-300">{snap.cash.toFixed(2)}</span> · Equity ≈{' '}
          <span className="text-amber-300">{snap.equityApprox.toFixed(2)}</span>
        </div>
        <div className="text-white/40">Mark {lastQuote.toFixed(5)}</div>
        <div
          className="border-t border-white/[0.06] pt-2 space-y-1 overflow-y-auto"
          style={{ maxHeight: wide ? 220 : embedded ? 160 : 240 }}
        >
          {snap.positions.length === 0 ? (
            <span className="text-white/35">No positions</span>
          ) : (
            snap
              .positions.slice()
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
