'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Info, ChevronDown, ChevronUp, Clock, Users, Crosshair, DollarSign, Layers,
  BookOpen, Trophy, Zap, Lightbulb, Gamepad2, Calculator,
} from 'lucide-react';
import {
  GAME_MODE_LABELS,
  GAME_MODE_DESCRIPTIONS,
  type GameMode,
  type TemplateConfig,
} from '@/lib/arena-types';
import { GAME_INSTRUCTIONS } from '@/lib/game-instructions';

interface GameInfoPanelProps {
  gameMode: string;
  templateName: string;
  templateDescription: string;
  config: Partial<TemplateConfig>;
  isFinished: boolean;
  showInstructions?: boolean;
}

export default function GameInfoPanel({
  gameMode,
  templateName,
  templateDescription,
  config,
  isFinished,
  showInstructions = false,
}: GameInfoPanelProps) {
  const [isExpanded, setIsExpanded] = useState(isFinished || showInstructions);

  const modeName = GAME_MODE_LABELS[gameMode as GameMode] ?? 'Classic Arena';
  const modeDescription = GAME_MODE_DESCRIPTIONS[gameMode as GameMode] ?? '';
  const instructions = GAME_INSTRUCTIONS[gameMode as GameMode] ?? GAME_INSTRUCTIONS.classic;

  return (
    <div className="bg-card border border-border rounded-card overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex flex-wrap items-center gap-2 p-3 sm:p-4 hover:bg-white/[0.02] transition-colors"
      >
        <Info className="w-4 h-4 text-text-muted shrink-0" />
        <h3 className="text-sm font-display font-bold uppercase tracking-wider text-text-primary min-w-0 truncate">
          About This Game
        </h3>
        <span className="text-[10px] font-mono text-text-muted px-2 py-0.5 border border-border rounded-pill shrink-0">
          {modeName}
        </span>
        {showInstructions && !isExpanded && (
          <span className="text-[10px] font-mono text-accent-primary px-2 py-0.5 bg-accent-primary/10 border border-accent-primary/20 rounded-pill shrink-0">
            Instructions moved here
          </span>
        )}
        <span className="ml-auto text-text-muted shrink-0">
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="px-4 pb-4"
          >
            {/* Template name + overview */}
            <h4 className="text-base font-display font-bold text-text-primary mb-2">
              {templateName}
            </h4>

            {templateDescription && (
              <p className="text-sm text-text-secondary mb-3 leading-relaxed">
                {templateDescription}
              </p>
            )}

            <p className="text-sm text-text-secondary mb-4 leading-relaxed">
              {instructions.overview}
            </p>

            {/* How it works (mode short description) */}
            {modeDescription && (
              <div className="bg-white/[0.02] border border-border rounded-lg px-3 py-2 mb-4">
                <span className="text-[10px] font-mono uppercase text-text-muted tracking-wider">
                  Mode
                </span>
                <p className="text-xs text-text-secondary mt-1">
                  {modeDescription}
                </p>
              </div>
            )}

            {/* How to Play */}
            <Section icon={Zap} title="How to Play" iconColor="text-cyan-400">
              <ol className="space-y-2">
                {instructions.howToPlay.map((step, i) => (
                  <li key={i} className="flex gap-2.5 text-xs text-text-secondary leading-relaxed">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-cyan-500/10 border border-cyan-500/20
                      flex items-center justify-center text-[10px] font-mono text-cyan-400 mt-0.5">
                      {i + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </Section>

            {/* How to Win */}
            <Section icon={Trophy} title="How to Win" iconColor="text-accent-primary">
              <p className="text-xs text-text-secondary leading-relaxed">
                {instructions.howToWin}
              </p>
            </Section>

            {/* Scoring */}
            <Section icon={Calculator} title="Scoring Formula" iconColor="text-purple-400">
              <code className="block text-[11px] font-mono text-purple-300 bg-purple-500/5 border border-purple-500/15 rounded-lg px-3 py-2 break-all leading-relaxed">
                {instructions.scoringFormula}
              </code>
            </Section>

            {/* Button Guide */}
            <Section icon={Gamepad2} title="Controls Guide" iconColor="text-emerald-400">
              <div className="space-y-2">
                {instructions.buttons.map((btn) => (
                  <div key={btn.label} className="flex gap-2">
                    <span className="flex-shrink-0 text-[10px] font-mono font-bold text-emerald-300
                      bg-emerald-500/10 border border-emerald-500/15 rounded-md px-2 py-1 leading-tight whitespace-nowrap">
                      {btn.label}
                    </span>
                    <span className="text-xs text-text-secondary leading-relaxed pt-0.5">
                      {btn.description}
                    </span>
                  </div>
                ))}
              </div>
            </Section>

            {/* Unique Mechanics */}
            <Section icon={BookOpen} title="Special Mechanics" iconColor="text-amber-400">
              <div className="space-y-2">
                {instructions.uniqueMechanics.map((mech, i) => {
                  const colonIdx = mech.indexOf(':');
                  const title = colonIdx > 0 ? mech.slice(0, colonIdx) : null;
                  const body = colonIdx > 0 ? mech.slice(colonIdx + 1).trim() : mech;
                  return (
                    <div key={i} className="text-xs text-text-secondary leading-relaxed">
                      {title && (
                        <span className="font-bold text-amber-300">{title}: </span>
                      )}
                      {body}
                    </div>
                  );
                })}
              </div>
            </Section>

            {/* Pro Tips */}
            <Section icon={Lightbulb} title="Pro Tips" iconColor="text-yellow-400">
              <ul className="space-y-1.5">
                {instructions.proTips.map((tip, i) => (
                  <li key={i} className="flex gap-2 text-xs text-text-secondary leading-relaxed">
                    <span className="flex-shrink-0 text-yellow-400 mt-0.5">&#9679;</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </Section>

            {/* Config grid */}
            <div className="mt-4 pt-4 border-t border-border">
              <span className="text-[10px] font-mono uppercase text-text-muted tracking-wider block mb-2">
                Game Configuration
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {config.duration_minutes != null && (
                  <ConfigItem icon={Clock} label="Duration" value={`${config.duration_minutes} min`} />
                )}
                {config.max_players != null && (
                  <ConfigItem icon={Users} label="Max Players" value={String(config.max_players)} />
                )}
                {config.stake_range && (
                  <ConfigItem icon={DollarSign} label="Stake Range" value={`$${config.stake_range[0]}–$${config.stake_range[1]}`} />
                )}
                {config.contract_types && config.contract_types.length > 0 && (
                  <ConfigItem icon={Crosshair} label="Contracts" value={config.contract_types.join(', ')} />
                )}
                {config.allowed_markets && config.allowed_markets.length > 0 && (
                  <ConfigItem
                    icon={Layers}
                    label="Markets"
                    value={config.allowed_markets.length > 3
                      ? `${config.allowed_markets.slice(0, 3).join(', ')}...`
                      : config.allowed_markets.join(', ')
                    }
                  />
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  iconColor,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  iconColor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${iconColor}`} />
        <h4 className="text-xs font-display font-bold uppercase tracking-wider text-text-primary">
          {title}
        </h4>
      </div>
      {children}
    </div>
  );
}

function ConfigItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-white/[0.02] border border-border rounded-lg px-2.5 py-2">
      <div className="flex items-center gap-1.5 mb-0.5">
        <Icon className="w-3 h-3 text-text-muted" />
        <span className="text-[10px] font-mono uppercase text-text-muted tracking-wider">{label}</span>
      </div>
      <span className="text-xs font-medium text-text-primary">{value}</span>
    </div>
  );
}
