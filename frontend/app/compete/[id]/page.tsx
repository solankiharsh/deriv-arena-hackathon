'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouteParamId } from '@/hooks/useRouteParamId';
import { 
  ArrowLeft, 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Zap, 
  Send,
  Loader2,
  Settings,
  Wallet,
  MessageSquare,
  BarChart3,
} from 'lucide-react';
import { getCompetition, type Competition } from '@/lib/derivarena-api';
import { useAuthStore } from '@/store/authStore';

const GOLD = '#E8B45E';
const SURF = '#0C1020';

// ── Mock Synthetic Ticker Data ───────────────────────────────────────────────────
function useSyntheticTicker(symbol: string) {
  const [ticks, setTicks] = useState<{ price: number; timestamp: number }[]>([]);
  const [currentPrice, setCurrentPrice] = useState(500000);
  const [trend, setTrend] = useState<'up' | 'down' | 'flat'>('flat');

  useEffect(() => {
    // Simulate tick stream in demo mode
    const interval = setInterval(() => {
      const delta = (Math.random() - 0.5) * 50;
      const newPrice = currentPrice + delta;
      setCurrentPrice(newPrice);
      setTicks((prev) => [...prev.slice(-50), { price: newPrice, timestamp: Date.now() }]);
      setTrend(delta > 10 ? 'up' : delta < -10 ? 'down' : 'flat');
    }, 800);

    return () => clearInterval(interval);
  }, [symbol, currentPrice]);

  return { ticks, currentPrice, trend };
}

// ── AI Coach Hook ────────────────────────────────────────────────────────────────
function useAICoach(competitionId: string | null, market: string) {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([
    { role: 'assistant', content: `Hi! I'm your AI Strategy Coach. Ask me for tips on trading ${market} contracts.` },
  ]);
  const [loading, setLoading] = useState(false);

  const askTip = useCallback(async () => {
    setLoading(true);
    // In production: call POST /api/coach/tip with competition context
    // For demo: return mock tips
    const tips = [
      `Volatility is low right now — perfect time to enter an ACCUMULATOR contract!`,
      `The RSI indicates oversold conditions. Consider a CALL option.`,
      `The market is trending down. A MULTDOWN contract might be risky right now.`,
      `Current tick momentum is positive. A CALL option could yield good returns.`,
      `Avoid trading during high volatility hours. Wait for consolidation.`,
    ];
    const randomTip = tips[Math.floor(Math.random() * tips.length)];
    
    setTimeout(() => {
      setMessages((prev) => [...prev, { role: 'assistant', content: randomTip }]);
      setLoading(false);
    }, 1200);
  }, []);

  return { messages, askTip, loading };
}

// ── Trading Panel ────────────────────────────────────────────────────────────────
function TradingPanel({ 
  symbol, 
  currentPrice, 
  trend,
  onTrade,
}: { 
  symbol: string;
  currentPrice: number;
  trend: 'up' | 'down' | 'flat';
  onTrade: (type: string, stake: number) => void;
}) {
  const [stake, setStake] = useState(10);
  const [contractType, setContractType] = useState<'CALL' | 'PUT' | 'ACCU'>('CALL');

  return (
    <div className="bg-[#12121a]/50 backdrop-blur-xl border border-white/[0.08] rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">Trade {symbol}</h3>
        <div className="flex items-center gap-2">
          {trend === 'up' && <TrendingUp className="w-4 h-4 text-green-400" />}
          {trend === 'down' && <TrendingDown className="w-4 h-4 text-red-400" />}
          <span className="text-lg font-mono font-bold" style={{ color: GOLD }}>
            {(currentPrice / 10000).toFixed(2)}
          </span>
        </div>
      </div>

      {/* Contract Type Selection */}
      <div className="grid grid-cols-3 gap-2">
        {(['CALL', 'PUT', 'ACCU'] as const).map((type) => (
          <button
            key={type}
            onClick={() => setContractType(type)}
            className={`py-2 px-2 text-xs font-semibold rounded transition-colors ${
              contractType === type 
                ? 'bg-amber-500/20 border border-amber-500/40 text-amber-400' 
                : 'bg-white/[0.04] border border-white/[0.08] text-white/50 hover:bg-white/[0.06]'
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Stake Input */}
      <div className="space-y-2">
        <label className="text-[10px] uppercase tracking-wider text-white/50">Stake Amount (USD)</label>
        <input
          type="number"
          value={stake}
          onChange={(e) => setStake(Number(e.target.value))}
          min={1}
          max={1000}
          className="w-full bg-white/[0.04] border border-white/[0.08] rounded px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-amber-500/40"
        />
      </div>

      <button
        onClick={() => onTrade(contractType, stake)}
        className="w-full flex items-center justify-center gap-2 px-3 py-3 rounded-lg font-semibold text-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
        style={{ background: GOLD, color: '#000' }}
      >
        <Zap className="w-4 h-4" />
        BUY {contractType}
      </button>
    </div>
  );
}

// ── AI Coach Panel ───────────────────────────────────────────────────────
function CoachPanel({ 
  messages, 
  onAsk, 
  loading 
}: { 
  messages: { role: 'user' | 'assistant'; content: string }[];
  onAsk: () => void;
  loading: boolean;
}) {
  return (
    <div className="bg-[#12121a]/50 backdrop-blur-xl border border-white/[0.08] rounded-lg p-4 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare className="w-4 h-4" style={{ color: GOLD }} />
        <h3 className="text-sm font-bold text-white">AI Strategy Coach</h3>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-3 min-h-[200px]">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`text-xs p-2 rounded ${
              msg.role === 'assistant' 
                ? 'bg-amber-500/10 text-amber-100/80 mr-4' 
                : 'bg-white/[0.06] text-white/80 ml-4'
            }`}
          >
            {msg.content}
          </div>
        ))}
      </div>

      <button
        onClick={onAsk}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded text-xs font-semibold transition-colors disabled:opacity-50"
        style={{ background: 'rgba(232,180,94,0.15)', borderColor: 'rgba(232,180,94,0.3)', color: GOLD, border: '1px solid' }}
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
        {loading ? 'Thinking...' : 'Get Trading Tip'}
      </button>
    </div>
  );
}

// ── Main Page ───────────────────���────────────────────────────────────────────
export default function CompetePage() {
  const id = useRouteParamId('compete') || '';
  
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [loading, setLoading] = useState(true);
  const [symbol] = useState('1HZ100V');

  const { ticks, currentPrice, trend } = useSyntheticTicker(symbol);
  const { messages, askTip, loading: coachLoading } = useAICoach(id, symbol);

  useEffect(() => {
    if (!id) return;
    getCompetition(id)
      .then(setCompetition)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const handleTrade = useCallback((type: string, stake: number) => {
    // In production: call Deriv V2 API to execute trade
    console.log(`Executing ${type} trade with stake ${stake} on ${symbol}`);
    alert(`Demo: ${type} trade of $${stake} would be executed on ${symbol}`);
  }, [symbol]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: GOLD }} />
      </div>
    );
  }

  if (!competition) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <p className="text-white/50">Competition not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20" style={{ background: SURF }}>
      {/* Header */}
      <div className="sticky top-0 z-10 backdrop-blur-xl border-b border-white/[0.06] px-4 py-3" style={{ background: 'rgba(7,9,15,0.8)' }}>
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <button onClick={() => window.history.back()} className="text-white/50 hover:text-white">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-white">{competition.name}</h1>
              <p className="text-xs text-white/40">Manual Trading Mode</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              DEMO
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Ticker Chart (simplified) */}
        <div className="bg-[#12121a]/50 backdrop-blur-xl border border-white/[0.08] rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4" style={{ color: GOLD }} />
              <span className="text-sm font-semibold text-white">{symbol} Live Ticks</span>
            </div>
            <span className="text-xs text-white/40">Demo Mode</span>
          </div>
          {/* Simplified sparkline */}
          <div className="h-24 flex items-end gap-0.5">
            {ticks.slice(-40).map((tick, i) => (
              <div
                key={i}
                className={`flex-1 rounded-sm ${
                  tick.price > currentPrice - 20 
                    ? 'bg-green-500/60' 
                    : 'bg-red-500/60'
                }`}
                style={{ height: `${Math.min(100, Math.max(10, ((tick.price - (currentPrice - 100)) / 2)))}%` }}
              />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Trading Panel */}
          <TradingPanel 
            symbol={symbol} 
            currentPrice={currentPrice} 
            trend={trend}
            onTrade={handleTrade}
          />

          {/* AI Coach */}
          <CoachPanel 
            messages={messages}
            onAsk={askTip}
            loading={coachLoading}
          />
        </div>

        {/* Info */}
        <div className="text-center text-xs text-white/30">
          <p>Manual trades count toward your Sortino score on the leaderboard.</p>
          <p className="mt-1">Use AI Coach tips to improve your strategy!</p>
        </div>
      </div>
    </div>
  );
}