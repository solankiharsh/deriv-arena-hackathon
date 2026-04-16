'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, TrendingUp, TrendingDown, BarChart3, Radio } from 'lucide-react';
import { motion } from 'framer-motion';
import { useArenaAuthBridge } from '@/lib/arena-auth-bridge';

const GOLD = '#E8B45E';

interface PredictionMarket {
  id: string;
  question: string;
  yes_price: number;
  no_price: number;
  volume: number;
  status: string;
}

export default function PredictionsTab() {
  useArenaAuthBridge();
  const [markets, setMarkets] = useState<PredictionMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/arena/proxy?path=/api/predictions/markets');
      const data = await res.json();
      if (data.fallback) {
        setMarkets([]);
        setError(null);
      } else if (Array.isArray(data)) {
        setMarkets(data);
      } else if (data.markets) {
        setMarkets(data.markets);
      }
    } catch {
      setError('Unable to load prediction markets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-accent-primary" />
      </div>
    );
  }

  if (markets.length === 0) {
    return (
      <div className="text-center py-16">
        <Radio className="w-10 h-10 text-text-muted/40 mx-auto mb-4" />
        <h3 className="text-base font-display font-bold text-text-primary mb-2">Prediction Markets</h3>
        <p className="text-text-muted text-sm max-w-md mx-auto mb-2">
          {error || 'No active prediction markets right now. Start the backend service to see live markets.'}
        </p>
        <p className="text-[10px] text-text-muted/60 font-mono">
          Markets refresh every 30 seconds
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-4 h-4" style={{ color: GOLD }} />
        <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-text-primary">
          Active Markets
        </h2>
        <span className="text-[10px] font-mono text-text-muted ml-auto">
          {markets.length} markets
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {markets.map((m, i) => (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="bg-card border border-border rounded-card p-4 hover:border-accent-primary/30 transition-all cursor-pointer"
          >
            <p className="text-sm text-text-primary font-medium mb-3 line-clamp-2">{m.question}</p>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingUp className="w-3.5 h-3.5 text-green-400" />
                  <span className="text-xs font-mono text-green-400">
                    YES {(m.yes_price * 100).toFixed(0)}¢
                  </span>
                </div>
                <div className="w-full bg-white/[0.05] rounded-full h-1.5">
                  <div
                    className="h-1.5 rounded-full bg-green-500/60"
                    style={{ width: `${m.yes_price * 100}%` }}
                  />
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                  <span className="text-xs font-mono text-red-400">
                    NO {(m.no_price * 100).toFixed(0)}¢
                  </span>
                </div>
                <div className="w-full bg-white/[0.05] rounded-full h-1.5">
                  <div
                    className="h-1.5 rounded-full bg-red-500/60"
                    style={{ width: `${m.no_price * 100}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="text-[10px] text-text-muted font-mono mt-2">
              Vol: ${m.volume?.toLocaleString() ?? 0}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
