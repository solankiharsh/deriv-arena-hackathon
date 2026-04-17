'use client';

import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import ReactFlow, {
  Background,
  BackgroundVariant,
  Handle,
  NodeTypes,
  Position,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  NodeProps,
  NodeMouseHandler,
} from 'reactflow';
import 'reactflow/dist/style.css';
import type { Bot } from '@/lib/api/trading-bots';
import { useAuthStore } from '@/store/authStore';
import { useBotStore } from '@/lib/stores/bot-store';
import { AgentMapFeed, FeedEntry } from './AgentMapFeed';
import { BotMapDetailSheet } from './BotMapDetailSheet';

// ─────────────────────────────────────────────
// Static token backdrop
// ─────────────────────────────────────────────

const TOKEN_DATA = [
  { id: 't-bonk',     position: { x: 120,  y: 80  }, data: { symbol: '$BONK',     change: +8.4,  cap: '2.1M', hot: true  } },
  { id: 't-wif',      position: { x: 520,  y: 60  }, data: { symbol: '$WIF',      change: +12.1, cap: '4.8M', hot: true  } },
  { id: 't-popcat',   position: { x: 900,  y: 140 }, data: { symbol: '$POPCAT',   change: -3.2,  cap: '890K', hot: false } },
  { id: 't-trump',    position: { x: 200,  y: 380 }, data: { symbol: '$TRUMP',    change: +22.0, cap: '8.2M', hot: true  } },
  { id: 't-fartcoin', position: { x: 660,  y: 320 }, data: { symbol: '$FARTCOIN', change: -7.8,  cap: '340K', hot: false } },
  { id: 't-boden',    position: { x: 980,  y: 420 }, data: { symbol: '$BODEN',    change: +4.1,  cap: '1.2M', hot: false } },
  { id: 't-new',      position: { x: 440,  y: 220 }, data: { symbol: '🔥 NEW',    change: +91.0, cap: '45K',  hot: true  } },
];

const BOT_PALETTE = ['#ff6666', '#6699ff', '#66ff88', '#ffdd44', '#cc88ff', '#E8B45E'];
const BOT_EMOJI = ['🤖', '⚡', '🎯', '📈', '🔷', '💠'];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  }
  return Math.abs(h);
}

function now(): string {
  return new Date().toLocaleTimeString('en-US', { hour12: false });
}

// ─────────────────────────────────────────────
// Token node (unchanged visuals)
// ─────────────────────────────────────────────

interface TokenNodeData {
  symbol: string;
  change: number;
  cap: string;
  hot: boolean;
  godWallet?: boolean;
}

const TokenNode = memo(({ data }: NodeProps<TokenNodeData>) => {
  const size = data.hot ? 88 : 72;
  const isUp = data.change >= 0;
  const glowColor = data.godWallet ? '#E8B45E' : isUp ? '#4ade80' : '#f87171';
  const borderColor = data.godWallet ? '#E8B45E' : isUp ? '#4ade80' : '#f87171';

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      {(data.hot || data.godWallet) && (
        <div
          style={{
            position: 'absolute',
            inset: -8,
            borderRadius: '50%',
            border: `2px solid ${glowColor}`,
            opacity: 0.5,
            animation: 'token-pulse 2s ease-in-out infinite',
            pointerEvents: 'none',
          }}
        />
      )}

      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: data.godWallet
            ? 'radial-gradient(circle, rgba(232,180,94,0.25) 0%, rgba(5,5,5,0.95) 70%)'
            : isUp
            ? 'radial-gradient(circle, rgba(74,222,128,0.15) 0%, rgba(5,5,5,0.95) 70%)'
            : 'radial-gradient(circle, rgba(248,113,113,0.15) 0%, rgba(5,5,5,0.95) 70%)',
          border: `2px solid ${borderColor}`,
          boxShadow: `0 0 ${data.godWallet ? 24 : 12}px ${glowColor}66, inset 0 0 8px ${glowColor}22`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'default',
          transition: 'all 0.3s ease',
          gap: 1,
        }}
      >
        <div
          style={{
            fontSize: data.hot ? 9 : 8,
            fontWeight: 700,
            color: '#f9fafb',
            fontFamily: 'JetBrains Mono, monospace',
            textAlign: 'center',
            lineHeight: 1.2,
            maxWidth: size - 12,
            wordBreak: 'break-word',
            letterSpacing: '-0.02em',
          }}
        >
          {data.symbol.replace('$', '')}
        </div>
        <div
          style={{
            fontSize: 8,
            fontWeight: 700,
            color: glowColor,
            fontFamily: 'JetBrains Mono, monospace',
            lineHeight: 1,
          }}
        >
          {isUp ? '+' : ''}{data.change.toFixed(1)}%
        </div>
        <div
          style={{
            fontSize: 7,
            color: '#6b7280',
            fontFamily: 'JetBrains Mono, monospace',
            lineHeight: 1,
          }}
        >
          {data.cap}
        </div>
      </div>

      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
});
TokenNode.displayName = 'TokenNode';

// ─────────────────────────────────────────────
// Trading bot node (real bots)
// ─────────────────────────────────────────────

interface TradingBotNodeData {
  botId: string;
  name: string;
  color: string;
  emoji: string;
  statusLabel: string;
}

const TradingBotNode = memo(({ data }: NodeProps<TradingBotNodeData>) => {
  const short =
    data.name.length > 14 ? `${data.name.slice(0, 12)}…` : data.name;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        cursor: 'pointer',
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${data.color}33 0%, rgba(5,5,5,0.9) 70%)`,
          border: `2px solid ${data.color}`,
          boxShadow: `0 0 14px ${data.color}66, 0 0 28px ${data.color}22`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 20,
        }}
      >
        {data.emoji}
      </div>
      <div
        style={{
          fontSize: 9,
          fontFamily: 'JetBrains Mono, monospace',
          color: data.color,
          fontWeight: 700,
          textShadow: `0 0 6px ${data.color}88`,
          lineHeight: 1.1,
          maxWidth: 96,
          textAlign: 'center',
        }}
      >
        {short}
      </div>
      <div
        style={{
          fontSize: 8,
          fontFamily: 'JetBrains Mono, monospace',
          color: '#9ca3af',
          lineHeight: 1,
        }}
      >
        {data.statusLabel}
      </div>

      <Handle type="source" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
});
TradingBotNode.displayName = 'TradingBotNode';

const nodeTypes: NodeTypes = {
  tokenNode: TokenNode as unknown as NodeTypes[string],
  tradingBotNode: TradingBotNode as unknown as NodeTypes[string],
};

const TOKEN_NODES: Node[] = TOKEN_DATA.map((t) => ({
  id: t.id,
  type: 'tokenNode',
  position: t.position,
  data: t.data,
  draggable: false,
  selectable: false,
}));

function buildBotNodes(bots: Bot[]): Node[] {
  return bots.map((bot, index) => {
    const tokenIdx = hashString(bot.id) % TOKEN_DATA.length;
    const token = TOKEN_DATA[tokenIdx];
    const offsetX = (hashString(`${bot.id}a`) % 100) - 50;
    const offsetY = -58 + (hashString(`${bot.id}b`) % 40) - 20 + (index % 3) * 6;
    const color = BOT_PALETTE[hashString(bot.id) % BOT_PALETTE.length];
    const emoji = BOT_EMOJI[hashString(bot.id) % BOT_EMOJI.length];
    const statusLabel =
      bot.status === 'running'
        ? 'Running'
        : bot.status === 'paused'
          ? 'Paused'
          : bot.status === 'error'
            ? 'Error'
            : 'Stopped';

    return {
      id: `bot-${bot.id}`,
      type: 'tradingBotNode',
      position: { x: token.position.x + offsetX, y: token.position.y + offsetY },
      data: {
        botId: bot.id,
        name: bot.name,
        color,
        emoji,
        statusLabel,
      },
      draggable: false,
      selectable: true,
      zIndex: 10,
    };
  });
}

function buildBotEdges(bots: Bot[]): Edge[] {
  return bots.map((bot) => {
    const tokenIdx = hashString(bot.id) % TOKEN_DATA.length;
    const token = TOKEN_DATA[tokenIdx];
    const color = BOT_PALETTE[hashString(bot.id) % BOT_PALETTE.length];
    return {
      id: `edge-bot-${bot.id}`,
      source: `bot-${bot.id}`,
      target: token.id,
      animated: bot.status === 'running',
      style: { stroke: color, strokeWidth: 1.5, strokeDasharray: '5 3' },
      label: bot.status === 'running' ? 'active' : 'linked',
      labelStyle: { fill: color, fontSize: 9, fontFamily: 'JetBrains Mono, monospace' },
      labelBgStyle: { fill: 'rgba(5,5,5,0.8)', fillOpacity: 1 },
      type: 'default',
    };
  });
}

function AgentMapInner() {
  const { agent } = useAuthStore();
  const userId = agent?.id || 'local-dev-user';
  const { bots: botsRaw, fetchBots } = useBotStore();
  const bots = Array.isArray(botsRaw) ? botsRaw : [];

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [feedEntries, setFeedEntries] = useState<FeedEntry[]>([]);
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);

  useEffect(() => {
    fetchBots(userId);
  }, [fetchBots, userId]);

  useEffect(() => {
    setNodes([...TOKEN_NODES, ...buildBotNodes(bots)]);
    setEdges(buildBotEdges(bots));
  }, [bots, setNodes, setEdges]);

  useEffect(() => {
    if (bots.length === 0) return;
    setFeedEntries((prev) => {
      const entry: FeedEntry = {
        id: `map-bots-${bots.length}`,
        text: `🗺 ${bots.length} bot${bots.length === 1 ? '' : 's'} on map — click a node for P&L`,
        color: 'gold',
        timestamp: now(),
      };
      if (prev.some((p) => p.id === entry.id)) return prev;
      return [entry, ...prev].slice(0, 40);
    });
  }, [bots.length]);

  const onNodeClick: NodeMouseHandler = useCallback((_e, node) => {
    if (node.type === 'tradingBotNode' && node.data && typeof (node.data as TradingBotNodeData).botId === 'string') {
      setSelectedBotId((node.data as TradingBotNodeData).botId);
    }
  }, []);

  const selectedBot = useMemo(
    () => (selectedBotId ? bots.find((b) => b.id === selectedBotId) ?? null : null),
    [bots, selectedBotId]
  );

  // Subtle drift for bot nodes only
  useEffect(() => {
    const interval = setInterval(() => {
      setNodes((prev) =>
        prev.map((n) => {
          if (!n.id.startsWith('bot-')) return n;
          const drift = () => (Math.random() - 0.5) * 3;
          return {
            ...n,
            position: {
              x: n.position.x + drift(),
              y: n.position.y + drift(),
            },
          };
        })
      );
    }, 4000);
    return () => clearInterval(interval);
  }, [setNodes]);

  return (
    <div className="flex h-full w-full" style={{ background: '#050505' }}>
      <div className="flex-1 relative" style={{ minWidth: 0 }}>
        {bots.length === 0 && (
          <div
            className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none"
            style={{ background: 'rgba(5,5,5,0.45)' }}
          >
            <p className="text-[11px] font-mono text-white/45 text-center px-6 max-w-sm">
              No trading bots yet. Create one in the Command tab — it will appear here.
            </p>
          </div>
        )}

        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 10,
            backgroundImage:
              'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,0,0.015) 2px, rgba(0,255,0,0.015) 3px)',
          }}
        />

        <style>{`
          @keyframes token-pulse {
            0%, 100% { transform: scale(1); opacity: 0.5; }
            50% { transform: scale(1.15); opacity: 0.2; }
          }
          .react-flow__edge-path {
            animation: dash 1s linear infinite;
          }
        `}</style>

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          panOnScroll={false}
          zoomOnScroll={false}
          panOnDrag
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
          proOptions={{ hideAttribution: true }}
          style={{ background: '#050505' }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            color="rgba(255,255,255,0.06)"
            gap={24}
            size={1}
          />
        </ReactFlow>
      </div>

      <div
        className="flex-shrink-0 border-l h-full overflow-hidden w-[min(100%,280px)]"
        style={{ borderColor: 'rgba(232,180,94,0.15)' }}
      >
        <AgentMapFeed entries={feedEntries} />
      </div>

      <BotMapDetailSheet
        open={Boolean(selectedBot)}
        onOpenChange={(o) => {
          if (!o) setSelectedBotId(null);
        }}
        bot={selectedBot}
        userId={userId}
      />
    </div>
  );
}

export function AgentMap() {
  return (
    <ReactFlowProvider>
      <AgentMapInner />
    </ReactFlowProvider>
  );
}
