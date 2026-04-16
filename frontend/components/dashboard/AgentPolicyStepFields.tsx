'use client';

import type { Dispatch, SetStateAction } from 'react';
import type { AgentPolicy, AssetLove } from '@/lib/agents';
import { defaultSymbolForAsset } from '@/lib/agents';
import {
  AGENT_POLICY_LABELS,
  ASSET_LOVE_CHOICES,
  DECISION_STYLE_CHOICES,
  DERIV_SYNTHETIC_SYMBOLS,
  MARKET_SENSE_CHOICES,
  MONEY_APPROACH_CHOICES,
  PERSONALITY_CHOICES,
  PROFIT_DREAM_CHOICES,
  PROTECTION_CHOICES,
  TIME_PATIENCE_CHOICES,
  TRADING_INSTINCT_CHOICES,
} from '@/lib/agents/agentPolicyCopy';

export function PolicyChoice<T extends string>({
  label,
  desc,
  selected,
  onSelect,
}: {
  label: string;
  desc: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left p-2.5 rounded border transition-colors ${
        selected ? 'border-amber-500/50 bg-amber-500/10' : 'border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04]'
      }`}
    >
      <div className="text-[11px] font-bold text-white">{label}</div>
      <div className="text-[10px] text-white/40 mt-0.5 leading-snug">{desc}</div>
    </button>
  );
}

export function AgentPolicyIdentityFields({
  policy,
  setPolicy,
}: {
  policy: AgentPolicy;
  setPolicy: Dispatch<SetStateAction<AgentPolicy>>;
}) {
  const set = (patch: Partial<AgentPolicy['identity']>) =>
    setPolicy((p) => ({ ...p, identity: { ...p.identity, ...patch } }));

  return (
    <div className="space-y-3">
      <label className="block text-[10px] uppercase text-white/35">{AGENT_POLICY_LABELS.designation}</label>
      <input
        value={policy.identity.displayName}
        onChange={(e) => set({ displayName: e.target.value.slice(0, 64) })}
        className="w-full bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1.5 text-sm text-white font-mono"
        placeholder="e.g. Tiger the Fast"
      />
      <div className="text-[10px] uppercase text-white/35">{AGENT_POLICY_LABELS.avatarSlot}</div>
      <div className="flex gap-2 flex-wrap">
        {[0, 1, 2, 3, 4].map((i) => (
          <button
            key={i}
            type="button"
            onClick={() => set({ avatarId: i })}
            className={`w-10 h-10 rounded-full border-2 text-xs font-mono flex items-center justify-center ${
              policy.identity.avatarId === i ? 'border-amber-400 bg-amber-500/20 text-amber-200' : 'border-white/15 text-white/40'
            }`}
          >
            {i}
          </button>
        ))}
      </div>
      <div className="text-[10px] uppercase text-white/35">{AGENT_POLICY_LABELS.personality}</div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {PERSONALITY_CHOICES.map((c) => (
          <PolicyChoice
            key={c.value}
            label={c.label}
            desc={c.desc}
            selected={policy.identity.personality === c.value}
            onSelect={() => set({ personality: c.value })}
          />
        ))}
      </div>
      <div className="text-[10px] uppercase text-white/35">{AGENT_POLICY_LABELS.decisionStyle}</div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {DECISION_STYLE_CHOICES.map((c) => (
          <PolicyChoice
            key={c.value}
            label={c.label}
            desc={c.desc}
            selected={policy.identity.decisionStyle === c.value}
            onSelect={() => set({ decisionStyle: c.value })}
          />
        ))}
      </div>
    </div>
  );
}

export function AgentPolicyTradingFields({
  policy,
  setPolicy,
}: {
  policy: AgentPolicy;
  setPolicy: Dispatch<SetStateAction<AgentPolicy>>;
}) {
  const set = (patch: Partial<AgentPolicy['tradingStyle']>) =>
    setPolicy((p) => ({ ...p, tradingStyle: { ...p.tradingStyle, ...patch } }));

  return (
    <div className="space-y-3">
      <div className="text-[10px] uppercase text-white/35">{AGENT_POLICY_LABELS.tradingInstinct}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {TRADING_INSTINCT_CHOICES.map((c) => (
          <PolicyChoice
            key={c.value}
            label={c.label}
            desc={c.desc}
            selected={policy.tradingStyle.instinct === c.value}
            onSelect={() => set({ instinct: c.value })}
          />
        ))}
      </div>
      <div className="text-[10px] uppercase text-white/35">{AGENT_POLICY_LABELS.timePatience}</div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {TIME_PATIENCE_CHOICES.map((c) => (
          <PolicyChoice
            key={c.value}
            label={c.label}
            desc={c.desc}
            selected={policy.tradingStyle.patience === c.value}
            onSelect={() => set({ patience: c.value })}
          />
        ))}
      </div>
      <div className="text-[10px] uppercase text-white/35">{AGENT_POLICY_LABELS.profitDream}</div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {PROFIT_DREAM_CHOICES.map((c) => (
          <PolicyChoice
            key={c.value}
            label={c.label}
            desc={c.desc}
            selected={policy.tradingStyle.profitDream === c.value}
            onSelect={() => set({ profitDream: c.value })}
          />
        ))}
      </div>
    </div>
  );
}

export function AgentPolicyRiskFields({
  policy,
  setPolicy,
}: {
  policy: AgentPolicy;
  setPolicy: Dispatch<SetStateAction<AgentPolicy>>;
}) {
  const set = (patch: Partial<AgentPolicy['risk']>) => setPolicy((p) => ({ ...p, risk: { ...p.risk, ...patch } }));
  const setCash = (n: number) =>
    setPolicy((p) => ({
      ...p,
      deployment: { ...p.deployment, paperStartingCash: Math.max(100, Math.min(1_000_000, Math.round(n))) },
    }));

  return (
    <div className="space-y-3">
      <div className="text-[10px] uppercase text-white/35">{AGENT_POLICY_LABELS.moneyApproach}</div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {MONEY_APPROACH_CHOICES.map((c) => (
          <PolicyChoice
            key={c.value}
            label={c.label}
            desc={c.desc}
            selected={policy.risk.moneyApproach === c.value}
            onSelect={() => set({ moneyApproach: c.value })}
          />
        ))}
      </div>
      <div className="text-[10px] uppercase text-white/35">{AGENT_POLICY_LABELS.protectionMindset}</div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {PROTECTION_CHOICES.map((c) => (
          <PolicyChoice
            key={c.value}
            label={c.label}
            desc={c.desc}
            selected={policy.risk.protection === c.value}
            onSelect={() => set({ protection: c.value })}
          />
        ))}
      </div>
      <label className="block text-[10px] uppercase text-white/35">{AGENT_POLICY_LABELS.paperStartingCash}</label>
      <input
        type="number"
        min={100}
        max={1_000_000}
        value={policy.deployment.paperStartingCash}
        onChange={(e) => setCash(Number(e.target.value))}
        className="w-full max-w-xs bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1.5 text-sm text-white font-mono"
      />
    </div>
  );
}

export function AgentPolicyPreferencesFields({
  policy,
  setPolicy,
}: {
  policy: AgentPolicy;
  setPolicy: Dispatch<SetStateAction<AgentPolicy>>;
}) {
  const setPref = (patch: Partial<AgentPolicy['preferences']>) =>
    setPolicy((p) => ({ ...p, preferences: { ...p.preferences, ...patch } }));

  const onAsset = (asset: AssetLove) => {
    setPolicy((p) => ({
      ...p,
      preferences: {
        ...p.preferences,
        assetLove: asset,
        primarySymbol: defaultSymbolForAsset(asset),
      },
    }));
  };

  return (
    <div className="space-y-3">
      <div className="text-[10px] uppercase text-white/35">{AGENT_POLICY_LABELS.signalMix}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {MARKET_SENSE_CHOICES.map((c) => (
          <PolicyChoice
            key={c.value}
            label={c.label}
            desc={c.desc}
            selected={policy.preferences.marketSense === c.value}
            onSelect={() => setPref({ marketSense: c.value })}
          />
        ))}
      </div>
      <div className="text-[10px] uppercase text-white/35">{AGENT_POLICY_LABELS.syntheticFamily}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {ASSET_LOVE_CHOICES.map((c) => (
          <PolicyChoice
            key={c.value}
            label={c.label}
            desc={c.desc}
            selected={policy.preferences.assetLove === c.value}
            onSelect={() => onAsset(c.value)}
          />
        ))}
      </div>
      <label className="block text-[10px] uppercase text-white/35">{AGENT_POLICY_LABELS.primarySymbol}</label>
      <input
        value={policy.preferences.primarySymbol}
        onChange={(e) => setPref({ primarySymbol: e.target.value.replace(/[^\w]/g, '').slice(0, 32) })}
        className="w-full bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1.5 text-sm text-white font-mono"
      />
      <div className="flex flex-wrap gap-1.5 mt-2">
        {DERIV_SYNTHETIC_SYMBOLS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setPref({ primarySymbol: s })}
            className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
              policy.preferences.primarySymbol === s
                ? 'border-amber-500/50 bg-amber-500/15 text-amber-200'
                : 'border-white/10 text-white/45 hover:bg-white/5'
            }`}
          >
            {s}
          </button>
        ))}
      </div>
      <label className="block text-[10px] uppercase text-white/35">{AGENT_POLICY_LABELS.strategyNotes}</label>
      <textarea
        value={policy.preferences.strategyNotes}
        onChange={(e) => setPref({ strategyNotes: e.target.value.slice(0, 500) })}
        rows={3}
        className="w-full bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1.5 text-xs text-white/90"
      />
    </div>
  );
}

export function AgentPolicyLaunchFields({
  policy,
  setPolicy,
}: {
  policy: AgentPolicy;
  setPolicy: Dispatch<SetStateAction<AgentPolicy>>;
}) {
  const dna = `${policy.tradingStyle.instinct.replace(/_/g, ' ')} · ${policy.preferences.marketSense.replace(/_/g, ' ')} · ${policy.preferences.assetLove.replace(/_/g, ' ')} · ${policy.risk.moneyApproach.replace(/_/g, ' ')}`;

  return (
    <div className="space-y-3 text-[11px] text-white/75">
      <p>
        <span className="text-white/40">Agent:</span>{' '}
        <span className="text-amber-200/90 font-mono">{policy.identity.displayName}</span>
      </p>
      <p>
        <span className="text-white/40">Strategy DNA:</span> {dna}
      </p>
      <p>
        <span className="text-white/40">Paper mode</span> — starting cash {policy.deployment.paperStartingCash.toLocaleString()}{' '}
        (synthetic).
      </p>
      <label className="flex items-start gap-2 cursor-pointer pt-2">
        <input
          type="checkbox"
          checked={policy.deployment.deploymentAcknowledged}
          onChange={(e) =>
            setPolicy((p) => ({
              ...p,
              deployment: { ...p.deployment, deploymentAcknowledged: e.target.checked },
            }))
          }
          className="mt-1"
        />
        <span>{AGENT_POLICY_LABELS.paperTradingAck}</span>
      </label>
    </div>
  );
}
