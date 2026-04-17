'use client';

import { useState } from 'react';
import { defaultBotConfig, BotConfig } from '@/lib/api/trading-bots';

const GOLD = '#E8B45E';

interface Props {
  onSubmit: (payload: { name: string; execution_mode: string; config: BotConfig }) => Promise<void>;
  onCancel: () => void;
}

type QuestionType = 'text' | 'radio' | 'checkbox' | 'slider' | 'number';

interface Question {
  id: string;
  section: string;
  question: string;
  type: QuestionType;
  options?: { value: any; label: string; desc?: string }[];
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
}

const QUESTIONS: Question[] = [
  {
    id: 'name', section: 'Basic Info', question: 'What should we call your bot?',
    type: 'text', placeholder: 'e.g. Volatility Hunter',
  },
  {
    id: 'execution_mode', section: 'Basic Info', question: 'How should your bot execute trades?',
    type: 'radio', options: [
      { value: 'paper', label: 'Paper Trading', desc: 'Simulated trades · no real calls' },
      { value: 'demo_live', label: 'Deriv Demo', desc: 'Real API · demo money' },
    ],
  },
  {
    id: 'risk_profile', section: 'Risk & Execution', question: 'What is your risk appetite?',
    type: 'radio', options: [
      { value: 'conservative', label: 'Conservative', desc: 'Smaller positions · strict stops' },
      { value: 'moderate', label: 'Moderate', desc: 'Balanced risk-reward' },
      { value: 'aggressive', label: 'Aggressive', desc: 'Larger positions · wider stops' },
    ],
  },
  {
    id: 'market_selection', section: 'Markets', question: 'Which markets should your bot trade?',
    type: 'checkbox', options: [
      { value: 'VOL100-USD', label: 'Volatility 100' },
      { value: 'VOL75-USD', label: 'Volatility 75' },
      { value: 'VOL50-USD', label: 'Volatility 50' },
      { value: 'VOL25-USD', label: 'Volatility 25' },
    ],
  },
  {
    id: 'contract_types', section: 'Contracts', question: 'Which contract types may your bot use?',
    type: 'checkbox', options: [
      { value: 'CALL', label: 'Call / Put', desc: 'Classic rise/fall' },
      { value: 'PUT', label: 'Put (bearish)', desc: 'Downward bet' },
      { value: 'ACCU', label: 'Accumulator', desc: 'Low volatility multiplier' },
      { value: 'MULTUP', label: 'Multiplier Up', desc: 'Leveraged upside' },
    ],
  },
  {
    id: 'technical_indicators', section: 'Signal Sources', question: 'Which technical indicators?',
    type: 'checkbox', options: [
      { value: 'rsi', label: 'RSI', desc: 'Overbought / oversold' },
      { value: 'macd', label: 'MACD', desc: 'Momentum & trend' },
      { value: 'bollinger', label: 'Bollinger Bands', desc: 'Volatility extremes' },
    ],
  },
  {
    id: 'ai_patterns', section: 'Signal Sources', question: 'Enable AI pattern detection?',
    type: 'radio', options: [
      { value: true, label: 'Yes', desc: 'Use LLM + heuristics to detect chart patterns' },
      { value: false, label: 'No', desc: 'Skip AI analysis' },
    ],
  },
  {
    id: 'news_weight', section: 'Signal Sources', question: 'How much weight should news sentiment have?',
    type: 'slider', min: 0, max: 1, step: 0.1,
  },
  {
    id: 'stake_amount', section: 'Execution Parameters', question: 'Stake amount per trade (USD)?',
    type: 'number', min: 1, max: 1000,
  },
  {
    id: 'max_daily_trades', section: 'Execution Parameters', question: 'Maximum trades per day?',
    type: 'number', min: 1, max: 500,
  },
];

const SECTIONS = ['Basic Info', 'Risk & Execution', 'Markets', 'Contracts', 'Signal Sources', 'Execution Parameters'];

type FormData = Record<string, any>;

export function BotCreationWizard({ onSubmit, onCancel }: Props) {
  const [form, setForm] = useState<FormData>({
    name: '',
    execution_mode: 'paper',
    risk_profile: 'moderate',
    market_selection: ['VOL100-USD'],
    contract_types: ['CALL', 'PUT'],
    technical_indicators: ['rsi'],
    ai_patterns: false,
    news_weight: 0.3,
    stake_amount: 10,
    max_daily_trades: 20,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (id: string, value: any) => setForm((f) => ({ ...f, [id]: value }));

  const toggleInArray = (id: string, value: any) => {
    setForm((f) => {
      const arr: any[] = f[id] || [];
      if (arr.includes(value)) return { ...f, [id]: arr.filter((x) => x !== value) };
      return { ...f, [id]: [...arr, value] };
    });
  };

  const handleSubmit = async () => {
    setError(null);
    if (!form.name?.trim()) {
      setError('Name is required');
      return;
    }
    if ((form.market_selection || []).length === 0) {
      setError('Select at least one market');
      return;
    }
    if ((form.contract_types || []).length === 0) {
      setError('Select at least one contract type');
      return;
    }

    const baseCfg = defaultBotConfig();
    const config: BotConfig = {
      ...baseCfg,
      riskProfile: form.risk_profile,
      marketSelection: form.market_selection,
      contractTypes: form.contract_types,
      indicators: {
        technical: form.technical_indicators || [],
        aiPatterns: !!form.ai_patterns,
        newsWeight: Number(form.news_weight) || 0,
      },
      execution: {
        ...baseCfg.execution,
        stakeAmount: Number(form.stake_amount) || 10,
        maxDailyTrades: Number(form.max_daily_trades) || 20,
        stopLossPercent: form.risk_profile === 'conservative' ? 3 : form.risk_profile === 'aggressive' ? 8 : 5,
        takeProfitPercent: form.risk_profile === 'conservative' ? 5 : form.risk_profile === 'aggressive' ? 15 : 10,
      },
    };

    setSubmitting(true);
    try {
      await onSubmit({
        name: form.name.trim(),
        execution_mode: form.execution_mode,
        config,
      });
    } catch (e: any) {
      setError(e?.message || 'Failed to create bot');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-2">
      <div>
        <h2 className="text-lg font-black font-mono text-white tracking-tight">DEPLOY NEW BOT</h2>
        <p className="text-[11px] font-mono text-white/40 mt-1">
          Answer the questions below to customize your AI trading agent.
        </p>
      </div>

      {SECTIONS.map((section) => {
        const sectionQs = QUESTIONS.filter((q) => q.section === section);
        return (
          <div
            key={section}
            className="p-4 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] mb-3" style={{ color: GOLD }}>
              {section}
            </div>
            <div className="space-y-4">
              {sectionQs.map((q) => (
                <QuestionField
                  key={q.id}
                  q={q}
                  value={form[q.id]}
                  onChange={(v) => update(q.id, v)}
                  onToggle={(v) => toggleInArray(q.id, v)}
                />
              ))}
            </div>
          </div>
        );
      })}

      {error && (
        <div className="text-xs font-mono text-red-400 px-3 py-2 rounded" style={{ background: 'rgba(255,0,51,0.08)', border: '1px solid rgba(255,0,51,0.25)' }}>
          {error}
        </div>
      )}

      <div className="flex gap-2 sticky bottom-0 bg-black pt-3">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-2.5 rounded text-xs font-mono uppercase tracking-wider text-white/60 hover:text-white transition"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="flex-1 px-4 py-2.5 rounded text-xs font-mono uppercase tracking-wider font-bold disabled:opacity-50 transition"
          style={{
            background: `linear-gradient(135deg, ${GOLD} 0%, #D09A3A 100%)`,
            color: '#000',
            boxShadow: submitting ? 'none' : `0 0 20px ${GOLD}50`,
          }}
        >
          {submitting ? 'Deploying…' : 'Deploy Bot'}
        </button>
      </div>
    </div>
  );
}

function QuestionField({
  q,
  value,
  onChange,
  onToggle,
}: {
  q: Question;
  value: any;
  onChange: (v: any) => void;
  onToggle: (v: any) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-mono text-white/70 mb-2">{q.question}</label>
      {q.type === 'text' && (
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value.slice(0, 64))}
          placeholder={q.placeholder}
          className="w-full px-3 py-2 rounded text-sm font-mono text-white bg-white/[0.03] border border-white/10 focus:outline-none focus:border-[#E8B45E]/60 transition"
        />
      )}
      {q.type === 'number' && (
        <input
          type="number"
          value={value ?? ''}
          min={q.min}
          max={q.max}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
          className="w-full px-3 py-2 rounded text-sm font-mono text-white bg-white/[0.03] border border-white/10 focus:outline-none focus:border-[#E8B45E]/60 transition"
        />
      )}
      {q.type === 'slider' && (
        <div>
          <input
            type="range"
            min={q.min}
            max={q.max}
            step={q.step}
            value={value ?? q.min ?? 0}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-full accent-[#E8B45E]"
          />
          <div className="flex justify-between text-[10px] font-mono text-white/40 mt-1">
            <span>Ignore (0)</span>
            <span className="text-[#E8B45E]">{((value ?? 0) * 100).toFixed(0)}%</span>
            <span>High (1)</span>
          </div>
        </div>
      )}
      {q.type === 'radio' && q.options && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {q.options.map((opt) => {
            const selected = value === opt.value;
            return (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => onChange(opt.value)}
                className="text-left px-3 py-2.5 rounded transition"
                style={{
                  background: selected ? 'rgba(232,180,94,0.12)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${selected ? GOLD : 'rgba(255,255,255,0.08)'}`,
                }}
              >
                <div className="text-xs font-mono font-bold text-white">{opt.label}</div>
                {opt.desc && <div className="text-[10px] font-mono text-white/40 mt-0.5">{opt.desc}</div>}
              </button>
            );
          })}
        </div>
      )}
      {q.type === 'checkbox' && q.options && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {q.options.map((opt) => {
            const arr: any[] = Array.isArray(value) ? value : [];
            const selected = arr.includes(opt.value);
            return (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => onToggle(opt.value)}
                className="text-left px-3 py-2.5 rounded transition"
                style={{
                  background: selected ? 'rgba(232,180,94,0.12)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${selected ? GOLD : 'rgba(255,255,255,0.08)'}`,
                }}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-sm flex items-center justify-center"
                    style={{ background: selected ? GOLD : 'transparent', border: `1px solid ${selected ? GOLD : 'rgba(255,255,255,0.2)'}` }}
                  >
                    {selected && <span className="text-[8px] text-black font-bold">✓</span>}
                  </div>
                  <span className="text-xs font-mono font-bold text-white">{opt.label}</span>
                </div>
                {opt.desc && <div className="text-[10px] font-mono text-white/40 mt-0.5 ml-5">{opt.desc}</div>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
