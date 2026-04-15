'use client';

const GOLD = '#E8B45E';

import type { AgentPolicy, AssetLove } from '@/lib/agents';
import type { Dispatch, SetStateAction } from 'react';
import { defaultSymbolForAsset } from '@/lib/agents';

const STEPS = [
  { id: 1, title: 'Basic identity', sub: 'Who your agent is' },
  { id: 2, title: 'Trading style', sub: 'How it hunts' },
  { id: 3, title: 'Risk & money', sub: 'Sizing and safety' },
  { id: 4, title: 'Preferences', sub: 'Markets and signal mix' },
  { id: 5, title: 'Launch', sub: 'Review and save' },
] as const;

type StepId = (typeof STEPS)[number]['id'];

export function AgentPolicyWizard({
  policy,
  setPolicy,
  step,
  setStep,
  onSave,
  onRandomize,
}: {
  policy: AgentPolicy;
  setPolicy: Dispatch<SetStateAction<AgentPolicy>>;
  step: StepId;
  setStep: (s: StepId) => void;
  onSave: () => void;
  onRandomize: () => void;
}) {
  return (
    <div
      className="border border-white/[0.08] rounded-lg overflow-hidden"
      style={{ background: 'rgba(18,18,26,0.5)' }}
    >
      <div className="p-3 border-b border-white/[0.06] flex flex-wrap gap-2 items-center justify-between">
        <h2 className="text-xs font-bold font-mono uppercase tracking-wider" style={{ color: GOLD }}>
          Agent policy
        </h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onRandomize}
            className="text-[10px] font-mono uppercase px-2 py-1 rounded border border-white/15 text-white/50 hover:bg-white/5"
          >
            Skip (randomize)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-0 md:gap-4">
        <nav className="p-3 border-b md:border-b-0 md:border-r border-white/[0.06] space-y-1">
          {STEPS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStep(s.id)}
              className={`w-full text-left px-2 py-1.5 rounded text-[10px] font-mono transition-colors ${
                step === s.id ? 'bg-amber-500/15 text-amber-200 border border-amber-500/30' : 'text-white/40 hover:text-white/70 border border-transparent'
              }`}
            >
              <span className="opacity-50 mr-1">{s.id}.</span>
              {s.title}
              <span className="block text-[9px] opacity-40 font-normal mt-0.5">{s.sub}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 space-y-4 min-h-[280px]">
          {step === 1 && <StepIdentity policy={policy} setPolicy={setPolicy} />}
          {step === 2 && <StepTrading policy={policy} setPolicy={setPolicy} />}
          {step === 3 && <StepRisk policy={policy} setPolicy={setPolicy} />}
          {step === 4 && <StepPreferences policy={policy} setPolicy={setPolicy} />}
          {step === 5 && <StepLaunch policy={policy} setPolicy={setPolicy} />}

          <div className="flex flex-wrap justify-between gap-2 pt-2 border-t border-white/[0.06]">
            <button
              type="button"
              disabled={step <= 1}
              onClick={() => setStep((step - 1) as StepId)}
              className="text-[11px] font-mono uppercase px-3 py-1.5 rounded border border-white/10 text-white/60 disabled:opacity-30"
            >
              Back
            </button>
            <div className="flex gap-2">
              {step < 5 ? (
                <button
                  type="button"
                  onClick={() => setStep((step + 1) as StepId)}
                  className="text-[11px] font-mono uppercase px-3 py-1.5 rounded bg-amber-500/25 border border-amber-500/50 text-amber-100"
                >
                  Continue →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onSave}
                  className="text-[11px] font-mono uppercase px-3 py-1.5 rounded bg-emerald-600/30 border border-emerald-500/50 text-emerald-100"
                >
                  Save policy
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Choice<T extends string>({
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

function StepIdentity({ policy, setPolicy }: { policy: AgentPolicy; setPolicy: Dispatch<SetStateAction<AgentPolicy>> }) {
  const set = (patch: Partial<AgentPolicy['identity']>) =>
    setPolicy((p) => ({ ...p, identity: { ...p.identity, ...patch } }));

  return (
    <div className="space-y-3">
      <label className="block text-[10px] uppercase text-white/35">Designation / name</label>
      <input
        value={policy.identity.displayName}
        onChange={(e) => set({ displayName: e.target.value.slice(0, 64) })}
        className="w-full bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1.5 text-sm text-white font-mono"
        placeholder="e.g. Tiger the Fast"
      />
      <div className="text-[10px] uppercase text-white/35">Avatar slot</div>
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
      <div className="text-[10px] uppercase text-white/35">Personality</div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Choice
          label="Careful guardian"
          desc="Capital preservation, strict downside limits."
          selected={policy.identity.personality === 'careful_guardian'}
          onSelect={() => set({ personality: 'careful_guardian' })}
        />
        <Choice
          label="Balanced trader"
          desc="Moderate risk / reward."
          selected={policy.identity.personality === 'balanced_trader'}
          onSelect={() => set({ personality: 'balanced_trader' })}
        />
        <Choice
          label="Bold adventurer"
          desc="Higher volatility tolerance."
          selected={policy.identity.personality === 'bold_adventurer'}
          onSelect={() => set({ personality: 'bold_adventurer' })}
        />
      </div>
      <div className="text-[10px] uppercase text-white/35">Decision style</div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Choice
          label="Gut instinct"
          desc="Fast; momentum and sentiment weighted."
          selected={policy.identity.decisionStyle === 'gut_instinct'}
          onSelect={() => set({ decisionStyle: 'gut_instinct' })}
        />
        <Choice
          label="Deep analyst"
          desc="Data-heavy; longer lookback."
          selected={policy.identity.decisionStyle === 'deep_analyst'}
          onSelect={() => set({ decisionStyle: 'deep_analyst' })}
        />
        <Choice
          label="Patient observer"
          desc="Fewer trades; higher conviction bar."
          selected={policy.identity.decisionStyle === 'patient_observer'}
          onSelect={() => set({ decisionStyle: 'patient_observer' })}
        />
      </div>
    </div>
  );
}

function StepTrading({ policy, setPolicy }: { policy: AgentPolicy; setPolicy: Dispatch<SetStateAction<AgentPolicy>> }) {
  const set = (patch: Partial<AgentPolicy['tradingStyle']>) =>
    setPolicy((p) => ({ ...p, tradingStyle: { ...p.tradingStyle, ...patch } }));

  return (
    <div className="space-y-3">
      <div className="text-[10px] uppercase text-white/35">Trading instinct</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Choice label="Trend chaser" desc="Follow momentum." selected={policy.tradingStyle.instinct === 'trend_chaser'} onSelect={() => set({ instinct: 'trend_chaser' })} />
        <Choice label="Value hunter" desc="Fade extremes; mean reversion tilt." selected={policy.tradingStyle.instinct === 'value_hunter'} onSelect={() => set({ instinct: 'value_hunter' })} />
        <Choice label="Reversal spotter" desc="Counter-trend at exhaustion hints." selected={policy.tradingStyle.instinct === 'reversal_spotter'} onSelect={() => set({ instinct: 'reversal_spotter' })} />
        <Choice label="Speed demon" desc="Short horizon; higher momentum weight." selected={policy.tradingStyle.instinct === 'speed_demon'} onSelect={() => set({ instinct: 'speed_demon' })} />
      </div>
      <div className="text-[10px] uppercase text-white/35">Time patience (paper bars)</div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Choice label="Lightning day" desc="Tight max holding window." selected={policy.tradingStyle.patience === 'lightning_day'} onSelect={() => set({ patience: 'lightning_day' })} />
        <Choice label="Swing rider" desc="Default swing-style holds." selected={policy.tradingStyle.patience === 'swing_rider'} onSelect={() => set({ patience: 'swing_rider' })} />
        <Choice label="Long-term visionary" desc="Longer holds before time exit." selected={policy.tradingStyle.patience === 'long_term_visionary'} onSelect={() => set({ patience: 'long_term_visionary' })} />
      </div>
      <div className="text-[10px] uppercase text-white/35">Profit dream</div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Choice label="Quick wins" desc="Smaller size, steadier clips." selected={policy.tradingStyle.profitDream === 'quick_wins'} onSelect={() => set({ profitDream: 'quick_wins' })} />
        <Choice label="Big moves" desc="Larger caps when conviction is high." selected={policy.tradingStyle.profitDream === 'big_moves'} onSelect={() => set({ profitDream: 'big_moves' })} />
        <Choice label="Wealth builder" desc="Balanced compounding path." selected={policy.tradingStyle.profitDream === 'wealth_builder'} onSelect={() => set({ profitDream: 'wealth_builder' })} />
      </div>
    </div>
  );
}

function StepRisk({ policy, setPolicy }: { policy: AgentPolicy; setPolicy: Dispatch<SetStateAction<AgentPolicy>> }) {
  const set = (patch: Partial<AgentPolicy['risk']>) => setPolicy((p) => ({ ...p, risk: { ...p.risk, ...patch } }));
  const setCash = (n: number) =>
    setPolicy((p) => ({
      ...p,
      deployment: { ...p.deployment, paperStartingCash: Math.max(100, Math.min(1_000_000, Math.round(n))) },
    }));

  return (
    <div className="space-y-3">
      <div className="text-[10px] uppercase text-white/35">Money approach</div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Choice label="Fixed & safe" desc="Stable stake from bankroll %." selected={policy.risk.moneyApproach === 'fixed_safe'} onSelect={() => set({ moneyApproach: 'fixed_safe' })} />
        <Choice label="Smart scaling" desc="Stake scales with streak + confidence." selected={policy.risk.moneyApproach === 'smart_scaling'} onSelect={() => set({ moneyApproach: 'smart_scaling' })} />
        <Choice label="Aggressive sizer" desc="Larger utilization when confident." selected={policy.risk.moneyApproach === 'aggressive_sizer'} onSelect={() => set({ moneyApproach: 'aggressive_sizer' })} />
      </div>
      <div className="text-[10px] uppercase text-white/35">Protection mindset</div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Choice label="Tight guardian" desc="Stricter confidence; shorter max hold." selected={policy.risk.protection === 'tight_guardian'} onSelect={() => set({ protection: 'tight_guardian' })} />
        <Choice label="Flexible" desc="Balanced exits vs flips." selected={policy.risk.protection === 'flexible'} onSelect={() => set({ protection: 'flexible' })} />
        <Choice label="Hands-off" desc="Looser guard; favors letting legs run." selected={policy.risk.protection === 'hands_off'} onSelect={() => set({ protection: 'hands_off' })} />
      </div>
      <label className="block text-[10px] uppercase text-white/35">Paper starting cash (reset ledger to apply)</label>
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

function StepPreferences({ policy, setPolicy }: { policy: AgentPolicy; setPolicy: Dispatch<SetStateAction<AgentPolicy>> }) {
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
      <div className="text-[10px] uppercase text-white/35">Signal mix (Deriv data)</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Choice
          label="Tickstructure only"
          desc="Weights ticks, probability, regime; sentiment channel off."
          selected={policy.preferences.marketSense === 'fixed_rules'}
          onSelect={() => setPref({ marketSense: 'fixed_rules' })}
        />
        <Choice
          label="Narrative tilt"
          desc="Adds soft sentiment from your strategy notes (optional overlay)."
          selected={policy.preferences.marketSense === 'mood_reader'}
          onSelect={() => setPref({ marketSense: 'mood_reader' })}
        />
      </div>
      <div className="text-[10px] uppercase text-white/35">Synthetic family (Deriv API symbols)</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Choice
          label="Volatility 1s (1HZ*)"
          desc="One-second volatility indices — default 1HZ100V."
          selected={policy.preferences.assetLove === 'stocks_fan'}
          onSelect={() => onAsset('stocks_fan')}
        />
        <Choice
          label="Countdown ranges (R_*)"
          desc="Range-style synthetics — default R_75."
          selected={policy.preferences.assetLove === 'forex_pro'}
          onSelect={() => onAsset('forex_pro')}
        />
        <Choice
          label="Faster-tick vol"
          desc="Higher tick cadence vol index — default 1HZ50V."
          selected={policy.preferences.assetLove === 'crypto_rebel'}
          onSelect={() => onAsset('crypto_rebel')}
        />
        <Choice
          label="Mixed synthetics"
          desc="Blended 1HZ + R_* profile — default 1HZ75V."
          selected={policy.preferences.assetLove === 'all_rounder'}
          onSelect={() => onAsset('all_rounder')}
        />
      </div>
      <label className="block text-[10px] uppercase text-white/35">Primary symbol (Deriv underlying)</label>
      <input
        value={policy.preferences.primarySymbol}
        onChange={(e) => setPref({ primarySymbol: e.target.value.replace(/[^\w]/g, '').slice(0, 32) })}
        className="w-full bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1.5 text-sm text-white font-mono"
      />
      <div className="flex flex-wrap gap-1.5 mt-2">
        {['1HZ100V', '1HZ75V', '1HZ50V', 'R_10', 'R_25', 'R_50', 'R_75', 'R_100'].map((s) => (
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
      <label className="block text-[10px] uppercase text-white/35">Strategy notes</label>
      <textarea
        value={policy.preferences.strategyNotes}
        onChange={(e) => setPref({ strategyNotes: e.target.value.slice(0, 500) })}
        rows={3}
        className="w-full bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1.5 text-xs text-white/90"
      />
    </div>
  );
}

function StepLaunch({ policy, setPolicy }: { policy: AgentPolicy; setPolicy: Dispatch<SetStateAction<AgentPolicy>> }) {
  const dna = `${policy.tradingStyle.instinct.replace(/_/g, ' ')} · ${policy.preferences.marketSense.replace(/_/g, ' ')} · ${policy.preferences.assetLove.replace(/_/g, ' ')} · ${policy.risk.moneyApproach.replace(/_/g, ' ')}`;

  return (
    <div className="space-y-3 text-[11px] text-white/75">
      <p>
        <span className="text-white/40">Agent:</span> <span className="text-amber-200/90 font-mono">{policy.identity.displayName}</span>
      </p>
      <p>
        <span className="text-white/40">Strategy DNA:</span> {dna}
      </p>
      <p>
        <span className="text-white/40">Paper mode</span> — starting cash {policy.deployment.paperStartingCash.toLocaleString()} (synthetic).
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
        <span>I understand this is simulated trading; live Deriv trading requires separate auth and risk controls.</span>
      </label>
    </div>
  );
}
