'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';

interface SourceFunnel {
  source: string;
  clicks: number;
  signups: number;
  redirects: number;
  registrations: number;
  first_trades: number;
}

interface RecentJourney {
  user_id: string;
  display_name: string;
  source: string;
  clicked_at: string;
  last_event: string;
  events_count: number;
}

interface Props {
  sources: SourceFunnel[];
  recentJourneys: RecentJourney[];
}

const SOURCE_COLORS: Record<string, string> = {
  whatsapp: '#25D366',
  telegram: '#0088CC',
  twitter: '#FFFFFF',
  copy: '#E8B45E',
  direct: '#6B7280',
};

const STAGES = ['clicks', 'signups', 'redirects', 'registrations', 'first_trades'] as const;
const STAGE_LABELS: Record<string, string> = {
  clicks: 'Clicks',
  signups: 'Sign-ups',
  redirects: 'Redirects',
  registrations: 'Registrations',
  first_trades: 'First Trades',
};

function sourceLabel(s: string): string {
  const map: Record<string, string> = {
    whatsapp: 'WhatsApp',
    telegram: 'Telegram',
    twitter: 'X / Twitter',
    copy: 'Copy Link',
    direct: 'Direct',
  };
  return map[s] || s;
}

export default function ReferralJourneyTimeline({ sources, recentJourneys }: Props) {
  const [hoveredNode, setHoveredNode] = useState<{ source: string; stage: string } | null>(null);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);

  const totalClicks = useMemo(
    () => sources.reduce((sum, s) => sum + s.clicks, 0),
    [sources],
  );

  const maxClicks = useMemo(
    () => Math.max(...sources.map(s => s.clicks), 1),
    [sources],
  );

  if (sources.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-text-muted text-sm">No referral data yet. Share your game links to see the journey.</p>
      </div>
    );
  }

  const filteredSources = selectedSource
    ? sources.filter(s => s.source === selectedSource)
    : sources;

  return (
    <div className="space-y-4">
      {/* Source filter pills */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedSource(null)}
          className="text-[10px] font-mono font-bold uppercase tracking-wider px-3 py-1.5 rounded-pill border transition-all"
          style={!selectedSource
            ? { color: '#E8B45E', background: 'rgba(232,180,94,0.08)', borderColor: 'rgba(232,180,94,0.3)' }
            : { color: 'rgba(255,255,255,0.4)', borderColor: 'rgba(255,255,255,0.08)' }
          }
        >
          All ({totalClicks})
        </button>
        {sources.map(s => (
          <button
            key={s.source}
            onClick={() => setSelectedSource(selectedSource === s.source ? null : s.source)}
            className="text-[10px] font-mono font-bold uppercase tracking-wider px-3 py-1.5 rounded-pill border transition-all"
            style={selectedSource === s.source
              ? { color: SOURCE_COLORS[s.source] || '#fff', background: `${SOURCE_COLORS[s.source] || '#fff'}12`, borderColor: `${SOURCE_COLORS[s.source] || '#fff'}50` }
              : { color: 'rgba(255,255,255,0.4)', borderColor: 'rgba(255,255,255,0.08)' }
            }
          >
            {sourceLabel(s.source)} ({s.clicks})
          </button>
        ))}
      </div>

      {/* Timeline visualization */}
      <div className="relative">
        {/* Root node */}
        <div className="flex items-center gap-3 mb-4">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-10 h-10 rounded-full border-2 flex items-center justify-center shrink-0"
            style={{ borderColor: '#E8B45E', background: 'rgba(232,180,94,0.1)' }}
          >
            <span className="text-[10px] font-mono font-bold" style={{ color: '#E8B45E' }}>REF</span>
          </motion.div>
          <div>
            <div className="text-sm font-display font-bold text-text-primary">Referral Links</div>
            <div className="text-[10px] text-text-muted font-mono">{totalClicks} total clicks</div>
          </div>
        </div>

        {/* Branches per source */}
        <div className="space-y-3 ml-5 border-l border-border/50 pl-5">
          {filteredSources.map((src, srcIdx) => {
            const color = SOURCE_COLORS[src.source] || '#6B7280';
            const stageValues = STAGES.map(stage => src[stage]);

            return (
              <motion.div
                key={src.source}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: srcIdx * 0.08 }}
                className="relative"
              >
                {/* Connector dot on the left border */}
                <div
                  className="absolute -left-[25px] top-4 w-2.5 h-2.5 rounded-full border-2"
                  style={{ borderColor: color, background: `${color}30` }}
                />

                {/* Source header */}
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="text-[11px] font-mono font-bold uppercase tracking-wider"
                    style={{ color }}
                  >
                    {sourceLabel(src.source)}
                  </span>
                  <span className="text-[10px] text-text-muted font-mono">
                    {src.clicks} clicks
                  </span>
                </div>

                {/* Stage flow */}
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1">
                  {STAGES.map((stage, stageIdx) => {
                    const value = stageValues[stageIdx];
                    const prevValue = stageIdx > 0 ? stageValues[stageIdx - 1] : src.clicks;
                    const dropOff = prevValue > 0 ? ((1 - value / prevValue) * 100).toFixed(0) : '0';
                    const barWidth = Math.max(8, (value / maxClicks) * 100);
                    const isHovered = hoveredNode?.source === src.source && hoveredNode?.stage === stage;

                    return (
                      <div key={stage} className="flex items-center gap-1">
                        {stageIdx > 0 && (
                          <motion.div
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: 1 }}
                            transition={{ delay: srcIdx * 0.08 + stageIdx * 0.05 }}
                            className="w-3 h-px origin-left"
                            style={{ background: `${color}40` }}
                          />
                        )}
                        <div
                          className="relative group cursor-default"
                          onMouseEnter={() => setHoveredNode({ source: src.source, stage })}
                          onMouseLeave={() => setHoveredNode(null)}
                        >
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: srcIdx * 0.08 + stageIdx * 0.06 }}
                            className="flex items-center gap-1.5 px-2 py-1 rounded border transition-all"
                            style={{
                              borderColor: isHovered ? color : `${color}30`,
                              background: isHovered ? `${color}15` : `${color}08`,
                            }}
                          >
                            <div
                              className="h-3 rounded-sm transition-all"
                              style={{
                                width: `${barWidth}px`,
                                background: value > 0 ? color : `${color}20`,
                                opacity: value > 0 ? 0.7 : 0.3,
                              }}
                            />
                            <span className="text-[10px] font-mono font-bold text-text-primary whitespace-nowrap">
                              {value}
                            </span>
                          </motion.div>

                          {/* Tooltip */}
                          {isHovered && (
                            <div
                              className="absolute z-20 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg border text-xs whitespace-nowrap"
                              style={{
                                background: '#0A0A0F',
                                borderColor: `${color}40`,
                              }}
                            >
                              <div className="font-mono font-bold text-text-primary">{STAGE_LABELS[stage]}: {value}</div>
                              {stageIdx > 0 && (
                                <div className="text-text-muted text-[10px]">
                                  {dropOff}% drop-off from {STAGE_LABELS[STAGES[stageIdx - 1]]}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Stage labels (only on first source row) */}
                {srcIdx === 0 && (
                  <div className="flex items-center gap-1 mt-1">
                    {STAGES.map((stage, stageIdx) => (
                      <div key={stage} className="flex items-center gap-1">
                        {stageIdx > 0 && <div className="w-3" />}
                        <div className="px-2">
                          <span className="text-[8px] font-mono uppercase text-text-muted tracking-wider">
                            {STAGE_LABELS[stage]}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Recent journeys detail panel */}
      {recentJourneys.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border">
          <h4 className="text-[10px] font-mono uppercase tracking-wider text-text-muted mb-3">
            Recent User Journeys
          </h4>
          <div className="space-y-1.5 max-h-[200px] overflow-y-auto scrollbar-custom">
            {recentJourneys.slice(0, 10).map((j, i) => {
              const color = SOURCE_COLORS[j.source] || '#6B7280';
              return (
                <motion.div
                  key={`${j.user_id}-${i}`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
                >
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0"
                    style={{ background: `${color}15`, color, border: `1px solid ${color}30` }}
                  >
                    {j.display_name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-text-primary truncate">{j.display_name}</div>
                    <div className="text-[10px] text-text-muted">
                      via <span style={{ color }}>{sourceLabel(j.source)}</span>
                      {' → '}
                      <span className="text-text-secondary">{j.last_event.replace(/_/g, ' ')}</span>
                    </div>
                  </div>
                  <div className="text-[10px] text-text-muted font-mono shrink-0">
                    {j.events_count} events
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
