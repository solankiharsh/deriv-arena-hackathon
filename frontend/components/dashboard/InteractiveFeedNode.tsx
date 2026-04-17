'use client';

import { useEffect, useState, useCallback } from 'react';
import { TrendingUp, Globe, Activity, Sparkles } from 'lucide-react';
import { Bot, getBotFeedData, toggleBotFeed } from '@/lib/api/trading-bots';

const GOLD = '#E8B45E';

type FeedID = 'deriv_ticks' | 'sentiment' | 'pattern' | 'partner';

interface LiveFeedPanelProps {
  userId: string;
  bot: Bot | null;
  feedId: FeedID;
  feedColor: string;
  feedLabel: string;
}

export function LiveFeedPanel({ userId, bot, feedId, feedColor, feedLabel }: LiveFeedPanelProps) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const enabled = bot?.config?.enabledFeeds?.[feedId] ?? true;
  const [toggleBusy, setToggleBusy] = useState(false);
  const [localEnabled, setLocalEnabled] = useState(enabled);

  useEffect(() => {
    setLocalEnabled(enabled);
  }, [enabled]);

  const load = useCallback(async () => {
    if (!bot || !userId) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await getBotFeedData(userId, bot.id, feedId);
      setData((resp as any)?.data ?? resp);
    } catch (e: any) {
      setError(e?.message || 'Failed to load live data');
    } finally {
      setLoading(false);
    }
  }, [bot, userId, feedId]);

  useEffect(() => {
    if (!bot || !localEnabled) return;
    load();
    const iv = setInterval(load, 5000);
    return () => clearInterval(iv);
  }, [bot?.id, localEnabled, load]);

  const onToggle = async () => {
    if (!bot || !userId || toggleBusy) return;
    setToggleBusy(true);
    const next = !localEnabled;
    setLocalEnabled(next);
    try {
      await toggleBotFeed(userId, bot.id, feedId, next);
    } catch {
      setLocalEnabled(!next);
    } finally {
      setToggleBusy(false);
    }
  };

  if (!bot) {
    return (
      <div
        className="p-4 rounded text-center"
        style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)' }}
      >
        <p className="text-xs font-mono text-white/50 mb-1">No bot deployed</p>
        <p className="text-[10px] font-mono text-white/30">
          Create a bot below to see live {feedLabel.toLowerCase()} data and control this feed.
        </p>
      </div>
    );
  }

  return (
    <div
      className="p-3 rounded"
      style={{
        background: `${feedColor}08`,
        border: `1px solid ${feedColor}33`,
      }}
    >
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: localEnabled ? feedColor : 'rgba(255,255,255,0.25)',
                boxShadow: localEnabled ? `0 0 8px ${feedColor}` : 'none',
                animation: localEnabled ? 'pulse 2s infinite' : undefined,
              }}
            />
            <span className="text-[10px] font-mono uppercase tracking-wider text-white/60 truncate">
              {bot.name} · Live {feedLabel}
            </span>
          </div>
        </div>
        <button
          onClick={onToggle}
          disabled={toggleBusy}
          className="px-2.5 py-1 rounded-full text-[9px] font-mono uppercase tracking-wider font-bold transition shrink-0"
          style={{
            background: localEnabled ? `${feedColor}20` : 'rgba(255,255,255,0.04)',
            border: `1px solid ${localEnabled ? feedColor : 'rgba(255,255,255,0.15)'}`,
            color: localEnabled ? feedColor : 'rgba(255,255,255,0.4)',
            opacity: toggleBusy ? 0.5 : 1,
          }}
        >
          {localEnabled ? 'ON' : 'OFF'}
        </button>
      </div>

      {!localEnabled && (
        <p className="text-[10px] font-mono text-white/30 italic">
          Feed disabled. The bot will ignore {feedLabel.toLowerCase()} signals until re-enabled.
        </p>
      )}

      {localEnabled && loading && !data && (
        <p className="text-[10px] font-mono text-white/30">Loading live data…</p>
      )}

      {localEnabled && error && (
        <p className="text-[10px] font-mono text-red-400">{error}</p>
      )}

      {localEnabled && data && (
        <FeedDataRenderer feedId={feedId} color={feedColor} data={data} />
      )}
    </div>
  );
}

function FeedDataRenderer({
  feedId,
  color,
  data,
}: {
  feedId: FeedID;
  color: string;
  data: any;
}) {
  switch (feedId) {
    case 'deriv_ticks':
      return <LiveTicksDisplay data={data} color={color} />;
    case 'sentiment':
      return <LiveSentimentDisplay data={data} color={color} />;
    case 'pattern':
      return <LivePatternDisplay data={data} color={color} />;
    case 'partner':
      return <LivePartnerDisplay data={data} color={color} />;
    default:
      return null;
  }
}

function LiveTicksDisplay({ data, color }: { data: any; color: string }) {
  const ticks: any[] = Array.isArray(data?.ticks) ? data.ticks : [];
  if (ticks.length === 0) {
    return <p className="text-[10px] font-mono text-white/30">Awaiting ticks…</p>;
  }
  return (
    <div className="space-y-1.5">
      {ticks.slice(0, 6).map((t: any, i: number) => (
        <div
          key={`${t.symbol}-${i}`}
          className="flex items-center justify-between gap-2 text-[11px] font-mono"
        >
          <div className="flex items-center gap-1.5">
            <Activity className="w-3 h-3" style={{ color }} />
            <span className="text-white/70">{t.symbol}</span>
          </div>
          <span className="font-bold tabular-nums" style={{ color }}>
            {typeof t.price === 'number' ? t.price.toFixed(4) : String(t.price ?? '-')}
          </span>
        </div>
      ))}
    </div>
  );
}

function LiveSentimentDisplay({ data, color }: { data: any; color: string }) {
  const score = typeof data?.score === 'number' ? data.score : 0;
  const items: any[] = Array.isArray(data?.items) ? data.items : [];
  const sentColor = score > 0.3 ? '#00ff41' : score < -0.3 ? '#ff6b6b' : color;
  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <div className="font-mono text-lg font-black tabular-nums" style={{ color: sentColor }}>
          {(score * 100).toFixed(0)}
        </div>
        <div className="flex-1">
          <div className="text-[10px] font-mono uppercase text-white/40 tracking-wider">
            Sentiment Score
          </div>
          <div className="text-[10px] font-mono text-white/30">
            {items.length} headline{items.length === 1 ? '' : 's'}
          </div>
        </div>
      </div>
      <div className="space-y-1">
        {items.slice(0, 3).map((it: any, i: number) => (
          <div key={i} className="flex items-start gap-1.5">
            <Globe className="w-2.5 h-2.5 mt-0.5 shrink-0" style={{ color }} />
            <p className="text-[10px] font-mono text-white/50 line-clamp-1">
              {String(it.title || it.headline || '').slice(0, 90)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function LivePatternDisplay({ data, color }: { data: any; color: string }) {
  const patterns: any[] = Array.isArray(data?.detectedPatterns) ? data.detectedPatterns : [];
  if (patterns.length === 0) {
    return <p className="text-[10px] font-mono text-white/30">No patterns detected.</p>;
  }
  return (
    <div className="space-y-1.5">
      {patterns.slice(0, 5).map((p: any, i: number) => {
        const c = typeof p.confidence === 'number' ? p.confidence : 0;
        const good = c > 0.7;
        return (
          <div key={i} className="flex items-center gap-2">
            <TrendingUp className="w-3 h-3" style={{ color: good ? color : 'rgba(255,255,255,0.4)' }} />
            <span className="text-[11px] font-mono text-white/80">{String(p.name || 'pattern')}</span>
            <span className="ml-auto text-[10px] font-mono tabular-nums" style={{ color }}>
              {(c * 100).toFixed(0)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

function LivePartnerDisplay({ data, color }: { data: any; color: string }) {
  const strategies: any[] = Array.isArray(data?.strategies) ? data.strategies : [];
  if (strategies.length === 0) {
    return <p className="text-[10px] font-mono text-white/30">No partner strategies.</p>;
  }
  return (
    <div className="space-y-1.5">
      {strategies.map((s: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-[11px] font-mono">
          <Sparkles className="w-3 h-3" style={{ color: s.active ? color : 'rgba(255,255,255,0.3)' }} />
          <span className={s.active ? 'text-white/80' : 'text-white/40 line-through'}>
            {String(s.name || 'strategy')}
          </span>
          <span
            className="ml-auto text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded"
            style={{
              background: s.active ? `${color}18` : 'rgba(255,255,255,0.04)',
              color: s.active ? color : 'rgba(255,255,255,0.4)',
            }}
          >
            {s.active ? 'Active' : 'Locked'}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Compact toggle chip that can be overlaid on a feed card. Returns null if no bot.
 */
export function FeedToggleChip({
  userId,
  bot,
  feedId,
  feedColor,
}: {
  userId: string;
  bot: Bot | null;
  feedId: FeedID;
  feedColor: string;
}) {
  const enabled = bot?.config?.enabledFeeds?.[feedId] ?? true;
  const [local, setLocal] = useState(enabled);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setLocal(enabled);
  }, [enabled]);

  if (!bot) return null;

  const onClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    const next = !local;
    setLocal(next);
    try {
      await toggleBotFeed(userId, bot.id, feedId, next);
    } catch {
      setLocal(!next);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="px-1.5 py-0.5 rounded-full text-[9px] font-mono uppercase tracking-wider font-bold transition"
      title={local ? 'Disable feed for this bot' : 'Enable feed for this bot'}
      style={{
        background: local ? `${feedColor}22` : 'rgba(255,255,255,0.04)',
        border: `1px solid ${local ? feedColor : 'rgba(255,255,255,0.15)'}`,
        color: local ? feedColor : 'rgba(255,255,255,0.4)',
        opacity: busy ? 0.5 : 1,
      }}
    >
      {local ? 'ON' : 'OFF'}
    </button>
  );
}
