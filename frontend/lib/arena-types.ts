export type UserRole = 'player' | 'partner' | 'admin';

export type GameMode =
  | 'classic'
  | 'phantom_league'
  | 'boxing_ring'
  | 'anti_you'
  | 'war_room'
  | 'behavioral_xray';

export const GAME_MODE_LABELS: Record<GameMode, string> = {
  classic: 'Classic Arena',
  phantom_league: 'Phantom League',
  boxing_ring: 'Boxing Ring',
  anti_you: 'Anti-You Duel',
  war_room: 'War Room',
  behavioral_xray: 'Behavioral X-Ray Sprint',
};

export const GAME_MODE_DESCRIPTIONS: Record<GameMode, string> = {
  classic: 'Trade exotic contracts and climb the Sortino-ranked leaderboard.',
  phantom_league: 'Capture phantom trades and see how your "what-ifs" stack up against reality.',
  boxing_ring: 'Every trade is a punch. Knock out your opponent before tilt takes you down.',
  anti_you: 'Face a mirror of your worst habits. Beat the Anti-You to prove you\'ve evolved.',
  war_room: 'Team-based strategic trading with AI debate rounds and consensus votes.',
  behavioral_xray: 'Sprint challenge: maintain the highest behavioral discipline score.',
};

export interface ArenaUser {
  id: string;
  deriv_account_id: string;
  deriv_login_id: string;
  display_name: string;
  avatar_url: string | null;
  role: UserRole;
  arena_rating: number;
  total_games: number;
  total_wins: number;
  created_at: string;
  updated_at: string;
}

export interface GameTemplate {
  id: string;
  slug: string;
  name: string;
  description: string;
  game_mode: GameMode;
  created_by: string;
  config: TemplateConfig;
  is_featured: boolean;
  is_active: boolean;
  play_count: number;
  created_at: string;
  updated_at: string;
  creator_name?: string;
}

export interface TemplateConfig {
  duration_minutes: number;
  max_players: number;
  allowed_markets: string[];
  stake_range: [number, number];
  contract_types: string[];
  scoring_weights?: Record<string, number>;
}

export interface GameInstance {
  id: string;
  template_id: string;
  template_slug: string;
  started_by: string;
  status: 'waiting' | 'live' | 'finished' | 'cancelled';
  started_at: string | null;
  ends_at: string | null;
  finished_at: string | null;
  player_count: number;
  created_at: string;
  template?: GameTemplate;
  starter_name?: string;
}

export interface InstancePlayer {
  id: string;
  instance_id: string;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  score: number;
  normalized_score: number;
  rank: number;
  trades_count: number;
  pnl: number;
  behavioral_score: number;
  joined_at: string;
  is_active: boolean;
}

export interface GameScore {
  id: string;
  instance_id: string;
  user_id: string;
  raw_score: number;
  normalized_score: number;
  pnl: number;
  trade_count: number;
  sortino_ratio: number;
  behavioral_score: number;
  percentile: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface LeaderboardEntry {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  role: UserRole;
  score: number;
  rank: number;
  games_played: number;
  win_rate: number;
}

export interface GlobalLeaderboardEntry extends LeaderboardEntry {
  arena_rating: number;
  mode_ratings: Partial<Record<GameMode, number>>;
}

export interface ConversionEvent {
  id: string;
  user_id: string;
  partner_id: string | null;
  template_id: string | null;
  instance_id: string | null;
  event_type: 'signup_click' | 'redirect' | 'registration' | 'first_trade';
  percentile_at_trigger: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AdminStats {
  total_players: number;
  total_partners: number;
  total_templates: number;
  total_instances: number;
  active_instances: number;
  total_conversions: number;
  conversion_rate: number;
  top_partner: { name: string; conversions: number } | null;
}

export interface PartnerStats {
  partner_id: string;
  display_name: string;
  templates_created: number;
  total_instances: number;
  total_players_reached: number;
  total_conversions: number;
  conversion_rate: number;
}
