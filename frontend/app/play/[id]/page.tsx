'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Play, Users, Copy, Check, Share2, ArrowLeft, Loader2,
  TrendingUp, TrendingDown, BarChart3, Trophy, Wifi, WifiOff,
} from 'lucide-react';
import { arenaApi } from '@/lib/arena-api';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useTradeStore } from '@/lib/stores/trade-store';
import { useArenaAuth } from '@/store/arenaAuthStore';
import type { GameInstance, InstancePlayer } from '@/lib/arena-types';
import { GAME_MODE_LABELS, GAME_MODE_DESCRIPTIONS, type GameMode } from '@/lib/arena-types';
import GradientText from '@/components/reactbits/GradientText';
import GameTimer from '@/components/game/GameTimer';
import LiveLeaderboardPanel from '@/components/game/LiveLeaderboardPanel';
import GameAIChatPanel from '@/components/game/GameAIChatPanel';
import BranchedTimelinePanel from '@/components/game/BranchedTimelinePanel';
import GameInfoPanel from '@/components/game/GameInfoPanel';
import GameInstructionsOverlay from '@/components/game/GameInstructionsOverlay';
import ConversionNudgeModal from '@/components/game/ConversionNudgeModal';
import {
  getNextLiveThreshold,
  getEndGameThreshold,
  interpolateMessage,
  type ConversionThreshold,
} from '@/lib/conversion-thresholds';
import ClassicArenaRenderer from '@/components/game/renderers/ClassicArenaRenderer';
import BoxingRingRenderer from '@/components/game/renderers/BoxingRingRenderer';
import AntiYouRenderer from '@/components/game/renderers/AntiYouRenderer';
import PhantomLeagueRenderer from '@/components/game/renderers/PhantomLeagueRenderer';
import BehavioralXRayRenderer from '@/components/game/renderers/BehavioralXRayRenderer';
import WarRoomRenderer from '@/components/game/renderers/WarRoomRenderer';

function ScoreBar({
  totalScore,
  totalPnl,
  tradesCount,
  currentPercentile,
}: {
  totalScore: number;
  totalPnl: number;
  tradesCount: number;
  currentPercentile: number;
}) {
  const isConnected = useAuthStore((s) => s.isConnected);
  const balance = useAuthStore((s) => s.balance);
  const sessionPnl = useTradeStore((s) => s.sessionPnl);

  return (
    <div className="bg-card border border-border rounded-card p-3 flex items-center gap-4 flex-wrap">
      <div className="flex items-center gap-1.5">
        {isConnected ? (
          <Wifi className="w-3 h-3 text-emerald-400" />
        ) : (
          <WifiOff className="w-3 h-3 text-red-400 animate-pulse" />
        )}
        <span className="text-[10px] font-mono text-text-muted">
          {isConnected ? 'LIVE' : 'CONNECTING'}
        </span>
      </div>

      <div className="h-4 w-px bg-border" />

      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-mono text-text-muted uppercase">Balance</span>
        <span className="font-mono font-bold text-sm text-text-primary tabular-nums">
          ${(balance + sessionPnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>

      <div className="h-4 w-px bg-border" />

      <div className="flex items-center gap-1.5">
        <BarChart3 className="w-3.5 h-3.5 text-accent-primary" />
        <span className="text-[10px] font-mono text-text-muted uppercase">Score</span>
        <span className="font-mono font-bold text-sm text-text-primary">{totalScore.toFixed(1)}</span>
      </div>

      <div className={`font-mono text-xs flex items-center gap-1 ${totalPnl >= 0 ? 'text-success' : 'text-error'}`}>
        {totalPnl >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
        ${Math.abs(totalPnl).toFixed(2)}
      </div>

      <div className="ml-auto flex items-center gap-3">
        <span className="text-[10px] text-text-muted font-mono">
          {tradesCount} trades
        </span>
        <span className="text-[10px] text-text-muted">
          Top <span className="text-text-primary font-mono font-bold">{currentPercentile.toFixed(0)}%</span>
        </span>
      </div>
    </div>
  );
}

type ExtendedInstance = GameInstance & {
  game_mode?: string;
  template_name?: string;
  template_config?: string | Record<string, unknown>;
  template_description?: string;
};

export default function PlayPage() {
  const params = useParams();
  const router = useRouter();
  const instanceId = (params?.id ?? '') as string;
  const { user, fetchUser } = useArenaAuth();

  const [instance, setInstance] = useState<ExtendedInstance | null>(null);
  const [players, setPlayers] = useState<InstancePlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [joined, setJoined] = useState(false);
  const [copied, setCopied] = useState(false);
  const [currentPercentile, setCurrentPercentile] = useState(0);
  const [showInstructions, setShowInstructions] = useState(false);
  const [instructionsDismissed, setInstructionsDismissed] = useState(false);
  const [nudge, setNudge] = useState<ConversionThreshold | null>(null);
  const [showNudge, setShowNudge] = useState(false);
  const highestThresholdShown = useRef(0);
  const endGameNudgeShown = useRef(false);

  // Score tracking
  const [totalPnl, setTotalPnl] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [tradesCount, setTradesCount] = useState(0);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const loadInstance = useCallback(async () => {
    try {
      const data = await arenaApi.instances.get(instanceId);
      setInstance(data.instance as ExtendedInstance);
      setPlayers(data.players);

      if (user) {
        const isJoined = data.players.some(
          (p: InstancePlayer) => p.user_id === user.id,
        );
        setJoined(isJoined);
      }
    } catch (err) {
      console.error('Failed to load instance:', err);
    } finally {
      setLoading(false);
    }
  }, [instanceId, user]);

  useEffect(() => {
    loadInstance();
  }, [loadInstance]);

  // Auto-join and auto-start for shared links
  useEffect(() => {
    if (!user || !instance || joined) return;
    const autoJoin = async () => {
      try {
        await arenaApi.instances.join(instanceId);
        setJoined(true);
        if (instance.status === 'waiting') {
          try { await arenaApi.instances.start(instanceId); } catch { /* may already be started */ }
        }
        loadInstance();
      } catch { /* already joined or instance full */ }
    };
    autoJoin();
  }, [user, instance, joined, instanceId, loadInstance]);

  useEffect(() => {
    if (instance?.status === 'live' && !instructionsDismissed) {
      setShowInstructions(true);
    }
  }, [instance?.status, instructionsDismissed]);

  useEffect(() => {
    if (instance?.status === 'finished' && currentPercentile > 0 && !endGameNudgeShown.current) {
      const endThreshold = getEndGameThreshold(currentPercentile);
      if (endThreshold) {
        endGameNudgeShown.current = true;
        const msg = interpolateMessage(endThreshold.message, currentPercentile);
        setNudge({ ...endThreshold, message: msg });
        setShowNudge(true);
      }
    }
  }, [instance?.status, currentPercentile]);

  const handleJoin = async () => {
    try {
      await arenaApi.instances.join(instanceId);
      setJoined(true);
      loadInstance();
    } catch (err) {
      console.error('Join failed:', err);
    }
  };

  const handleStart = async () => {
    try {
      await arenaApi.instances.start(instanceId);
      loadInstance();
    } catch (err) {
      console.error('Start failed:', err);
    }
  };

  const handleScoreUpdate = async (data: {
    score: number;
    pnl: number;
    trades_count: number;
    behavioral_score: number;
  }) => {
    if (!user || !instance || instance.status !== 'live') return;

    setTotalScore(data.score);
    setTotalPnl(data.pnl);
    setTradesCount(data.trades_count);

    try {
      const result = await arenaApi.instances.submitScore(instanceId, data);
      setCurrentPercentile(result.percentile);

      const next = getNextLiveThreshold(result.percentile, highestThresholdShown.current);
      if (next) {
        highestThresholdShown.current = next.percentile;
        setNudge(next);
        setShowNudge(true);

        arenaApi.conversion.track({
          event_type: 'signup_click',
          instance_id: instanceId,
          template_id: instance.template_id,
          percentile: result.percentile,
          metadata: { threshold: next.percentile, tier: next.tier },
        }).catch(() => {});
      }
    } catch (err) {
      console.error('Score submit failed:', err);
    }
  };

  const handleTimeUp = async () => {
    try {
      await arenaApi.instances.finalize(instanceId);
      loadInstance();
    } catch {}
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/play/${instanceId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent-primary" />
      </div>
    );
  }

  if (!instance) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-text-muted mb-4">Game not found</p>
          <button onClick={() => router.push('/arena')} className="btn-secondary">
            Back to Arena
          </button>
        </div>
      </div>
    );
  }

  const config = instance.template_config
    ? (typeof instance.template_config === 'string' ? JSON.parse(instance.template_config) : instance.template_config)
    : {};

  const canStart = user && instance.started_by === user.id && instance.status === 'waiting';
  const isLive = instance.status === 'live';
  const isFinished = instance.status === 'finished';

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Header */}
      <div className="sticky top-16 z-30 bg-bg-primary/95 backdrop-blur-lg border-b border-border">
        <div className="container-colosseum py-2 flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            onClick={() => router.push('/arena')}
            className="text-text-muted hover:text-text-primary transition-colors shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-display font-bold uppercase tracking-wider text-text-primary truncate">
                {(instance as ExtendedInstance).template_name || 'Game'}
              </h1>
              <span className="hidden sm:inline text-[10px] font-mono text-text-muted px-2 py-0.5 border border-border rounded-pill whitespace-nowrap">
                {GAME_MODE_LABELS[(instance as ExtendedInstance).game_mode as keyof typeof GAME_MODE_LABELS] || 'Classic'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <GameTimer
              endsAt={instance.ends_at}
              status={instance.status}
              onTimeUp={handleTimeUp}
            />
            <span className="flex items-center gap-1 text-xs text-text-muted">
              <Users className="w-3.5 h-3.5" />
              {instance.player_count}
            </span>
            <button
              onClick={handleCopyLink}
              className="btn-ghost text-xs gap-1"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Share2 className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{copied ? 'Copied' : 'Share'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="container-colosseum py-3">
        {/* Waiting state */}
        {instance.status === 'waiting' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-lg mx-auto text-center py-12"
          >
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-warning/10 border border-warning/20 flex items-center justify-center">
              <Users className="w-8 h-8 text-warning" />
            </div>
            <h2 className="text-xl font-display font-bold mb-2">
              <GradientText
                colors={['#E8B45E', '#F5C978', '#E8B45E']}
                animationSpeed={4}
                className="font-display font-bold"
              >
                Waiting for Players
              </GradientText>
            </h2>
            <p className="text-text-secondary text-sm mb-6">
              Share the link and start when everyone is ready.
            </p>

            <div className="flex items-center gap-2 justify-center mb-6 max-w-full px-2">
              <code className="text-xs font-mono bg-bg-secondary border border-border rounded-lg px-3 py-2 text-text-secondary truncate min-w-0">
                {typeof window !== 'undefined' ? `${window.location.origin}/play/${instanceId}` : ''}
              </code>
              <button onClick={handleCopyLink} className="btn-ghost">
                {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex gap-3 justify-center">
              {!joined && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleJoin}
                  className="btn-secondary"
                >
                  Join Game
                </motion.button>
              )}
              {canStart && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleStart}
                  className="btn-primary gap-2"
                >
                  <Play className="w-4 h-4" />
                  Start Game
                </motion.button>
              )}
            </div>
          </motion.div>
        )}

        {/* Live game area */}
        {(isLive || isFinished) && (
          <div className="space-y-4">
            {/* Philosophy banner */}
            <div className="w-full bg-[#0a0e17] border-t border-b border-white/[0.06] py-4 px-6 text-center">
              <p className="text-sm md:text-base text-white/60 font-serif italic tracking-wide">
                &ldquo;Most traders don&apos;t lose because of bad strategy.{' '}
                <span className="text-white/90 font-semibold not-italic">They lose because of bad behavior.</span>&rdquo;
              </p>
            </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">
            {/* Main trading area */}
            <div className="space-y-3">
              {/* Game description, instructions, and explanation */}
              <GameInfoPanel
                gameMode={(instance as ExtendedInstance).game_mode || 'classic'}
                templateName={(instance as ExtendedInstance).template_name || 'Game'}
                templateDescription={(instance as ExtendedInstance).template_description || ''}
                config={config}
                isFinished={isFinished}
                showInstructions={instructionsDismissed}
              />

              {/* Score bar */}
              <ScoreBar
                totalScore={totalScore}
                totalPnl={totalPnl}
                tradesCount={tradesCount}
                currentPercentile={currentPercentile}
              />

              {/* Game renderer — mode-specific */}
              {joined && user && (() => {
                const mode = (instance as ExtendedInstance).game_mode || 'classic';
                const props = {
                  instanceId,
                  userId: user.id,
                  isLive,
                  onScoreUpdate: handleScoreUpdate,
                };
                switch (mode) {
                  case 'boxing_ring':
                    return <BoxingRingRenderer {...props} />;
                  case 'anti_you':
                    return <AntiYouRenderer {...props} />;
                  case 'phantom_league':
                    return <PhantomLeagueRenderer {...props} />;
                  case 'behavioral_xray':
                    return <BehavioralXRayRenderer {...props} />;
                  case 'war_room':
                    return <WarRoomRenderer {...props} />;
                  default:
                    return <ClassicArenaRenderer {...props} />;
                }
              })()}

              {/* Finished state */}
              {isFinished && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-card border border-accent-primary/20 rounded-card p-6 text-center"
                >
                  <Trophy className="w-12 h-12 text-accent-primary mx-auto mb-3" />
                  <h3 className="text-lg font-display font-bold text-text-primary mb-2">
                    Game Finished
                  </h3>
                  <p className="text-text-secondary text-sm mb-4">
                    Final Score: <span className="text-accent-primary font-bold">{totalScore.toFixed(1)}</span>
                    {' — '}
                    P&L: <span className={totalPnl >= 0 ? 'text-success' : 'text-error'}>
                      ${totalPnl.toFixed(2)}
                    </span>
                  </p>
                  <div className="flex flex-wrap gap-3 justify-center">
                    <button onClick={() => router.push('/arena')} className="btn-secondary">
                      Back to Arena
                    </button>
                    <button onClick={() => router.push('/leaderboard')} className="btn-primary">
                      View Leaderboard
                    </button>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Right sidebar — leaderboard, AI chat, branched timelines */}
            <div className="space-y-4">
              {user && (
                <LiveLeaderboardPanel
                  instanceId={instanceId}
                  currentUserId={user.id}
                />
              )}

              <GameAIChatPanel
                gameScore={totalScore}
                percentile={currentPercentile}
                gameMode={(instance as ExtendedInstance).game_mode || 'classic'}
                gameModeName={GAME_MODE_LABELS[((instance as ExtendedInstance).game_mode || 'classic') as GameMode] || 'Classic Arena'}
                gameModeDescription={GAME_MODE_DESCRIPTIONS[((instance as ExtendedInstance).game_mode || 'classic') as GameMode] || ''}
                templateDescription={(instance as ExtendedInstance).template_description || ''}
              />

              <BranchedTimelinePanel />
            </div>
          </div>
          </div>
        )}
      </div>

      {/* Game instructions overlay — shown on game start, auto-dismisses after 10s */}
      {showInstructions && (
        <GameInstructionsOverlay
          gameMode={(instance as ExtendedInstance).game_mode || 'classic'}
          onDismiss={() => {
            setShowInstructions(false);
            setInstructionsDismissed(true);
          }}
        />
      )}

      {/* Multi-threshold conversion nudge */}
      {nudge && (
        <ConversionNudgeModal
          isOpen={showNudge}
          onClose={() => setShowNudge(false)}
          percentile={currentPercentile}
          message={nudge.message}
          tier={nudge.tier}
          autoDismissMs={nudge.autoDismissMs}
          instanceId={instanceId}
          templateId={instance.template_id}
          isEndGame={instance.status === 'finished'}
        />
      )}
    </div>
  );
}
