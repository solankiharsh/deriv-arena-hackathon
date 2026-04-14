'use client';

import { useState, useCallback, useEffect } from 'react';
import { X, ExternalLink, TrendingUp, Zap, Award, Users, DollarSign } from 'lucide-react';

interface ConversionNudge {
  id: string;
  type: 'agent_success' | 'human_success' | 'partner_tip' | 'win_streak' | 'top_25' | 'competition_winner';
  title: string;
  message: string;
  ctaText: string;
  ctaUrl: string;
  priority: 'high' | 'medium' | 'low';
  timestamp: string;
}

const NUDGE_TEMPLATES: Record<ConversionNudge['type'], Omit<ConversionNudge, 'id' | 'timestamp'>> = {
  agent_success: {
    type: 'agent_success',
    title: 'Your Agent is Crushing It! 🚀',
    message: 'Your AI agent is outperforming 80% of traders in the demo competition.',
    ctaText: 'Deposit to Trade Real Money',
    ctaUrl: 'https://app.deriv.com/signup',
    priority: 'high',
  },
  human_success: {
    type: 'human_success',
    title: 'You Beat the Bots! 🎯',
    message: 'You just outperformed the top AI agent. You clearly have a trading edge.',
    ctaText: 'Open Real Account',
    ctaUrl: 'https://app.deriv.com/signup',
    priority: 'high',
  },
  win_streak: {
    type: 'win_streak',
    title: '3-Win Streak! 🔥',
    message: 'You\'ve won 3 competitions in a row. Your strategy works.',
    ctaText: 'Trade with Real Money',
    ctaUrl: 'https://app.deriv.com/deposit',
    priority: 'high',
  },
  top_25: {
    type: 'top_25',
    title: 'Top 25% Trader 🏆',
    message: 'You\'re in the top 25% of the leaderboard! Ready for real stakes?',
    ctaText: 'Deposit & Compete for Real',
    ctaUrl: 'https://app.deriv.com/signup',
    priority: 'medium',
  },
  competition_winner: {
    type: 'competition_winner',
    title: 'Competition Winner! 🏅',
    message: 'Congratulations! Claim your achievement by trading with real funds.',
    ctaText: 'Unlock Prize Pool',
    ctaUrl: 'https://app.deriv.com/signup',
    priority: 'high',
  },
  partner_tip: {
    type: 'partner_tip',
    title: 'Partner Insight 💡',
    message: 'Agents using News Sentiment are up 12% today. Unlock this module with a real account.',
    ctaText: 'Upgrade to Real Trading',
    ctaUrl: 'https://app.deriv.com/signup',
    priority: 'low',
  },
};

const NUDGE_ICONS: Record<ConversionNudge['type'], typeof TrendingUp> = {
  agent_success: Zap,
  human_success: TrendingUp,
  win_streak: Award,
  top_25: Users,
  competition_winner: Award,
  partner_tip: TrendingUp,
};

const NUDGE_COLORS: Record<ConversionNudge['type'], { bg: string; border: string; text: string; icon: string }> = {
  agent_success: { bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-300', icon: 'text-purple-400' },
  human_success: { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-300', icon: 'text-green-400' },
  win_streak: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-300', icon: 'text-amber-400' },
  top_25: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-300', icon: 'text-blue-400' },
  competition_winner: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-300', icon: 'text-amber-400' },
  partner_tip: { bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', text: 'text-cyan-300', icon: 'text-cyan-400' },
};

// Demo mode: simulate nudges for the hackathon
function useDemoNudges(enabled: boolean) {
  const [nudges, setNudges] = useState<ConversionNudge[]>([]);

  useEffect(() => {
    if (!enabled) return;

    const templates = Object.keys(NUDGE_TEMPLATES) as ConversionNudge['type'][];
    const randomType = templates[Math.floor(Math.random() * templates.length)];
    
    const delay = setTimeout(() => {
      const template = NUDGE_TEMPLATES[randomType];
      setNudges([{ ...template, id: `nudge-${Date.now()}`, timestamp: new Date().toISOString() }]);
    }, 8000);

    return () => clearTimeout(delay);
  }, [enabled]);

  return nudges;
}

export function ConversionNudgeBanner() {
  // In demo mode, generate random nudges. In production, this would connect to the backend
  const [showDemoNudge] = useState(true);
  const nudges = useDemoNudges(showDemoNudge);

  // In production: listen to actual competition events
  // For now, we're just demoing the UI
  
  const dismiss = (_id: string) => {
    // In demo mode, we just let it auto-expire
    console.log('Dismiss nudge:', _id);
  };

  if (nudges.length === 0) return null;

  return (
    <div className="space-y-2">
      {nudges.map((nudge) => {
        const Icon = NUDGE_ICONS[nudge.type];
        const colors = NUDGE_COLORS[nudge.type];
        
        return (
          <div
            key={nudge.id}
            className={`flex items-center gap-3 rounded-lg border px-4 py-3 animate-in slide-in-from-top-2 ${colors.bg} ${colors.border}`}
          >
            <div className={`p-2 rounded-full ${colors.bg} ${colors.icon}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`text-sm font-semibold ${colors.text}`}>
                  {nudge.title}
                </span>
                <span className={`rounded ${colors.bg} px-1.5 py-0.5 text-[10px] ${colors.text} border ${colors.border}`}>
                  {nudge.priority.toUpperCase()}
                </span>
              </div>
              <p className={`text-xs text-white/60 truncate mt-0.5`}>{nudge.message}</p>
            </div>
            <a
              href={nudge.ctaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`shrink-0 rounded-md ${colors.bg} px-3 py-1.5 text-xs font-medium ${colors.text} hover:opacity-80 transition-opacity flex items-center gap-1 border ${colors.border}`}
            >
              {nudge.ctaText} <ExternalLink className="h-3 w-3" />
            </a>
            <button
              onClick={() => dismiss(nudge.id)}
              className="shrink-0 text-white/30 hover:text-white/60"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}