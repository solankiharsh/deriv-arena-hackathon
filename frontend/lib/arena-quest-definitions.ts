/**
 * Shared arena quest copy — matches marketing quests on the landing demo.
 * Icons stay in UI components; this module is safe to import from non-React code.
 */

export type ArenaQuestId =
  | 'join_competition'
  | 'first_game'
  | 'first_trade'
  | 'finish_match'
  | 'win_streak'
  | 'share_link'
  | 'referral';

export interface ArenaQuestDefinition {
  id: ArenaQuestId;
  title: string;
  shortTitle: string;
  points: number;
  desc: string;
}

export const ARENA_QUESTS: readonly ArenaQuestDefinition[] = [
  {
    id: 'join_competition',
    title: 'Join a Competition',
    shortTitle: 'Join',
    points: 100,
    desc: 'Enter any live partner challenge',
  },
  {
    id: 'first_game',
    title: 'Play Your First Game',
    shortTitle: 'First Game',
    points: 150,
    desc: 'Start your first arena session',
  },
  {
    id: 'first_trade',
    title: 'Complete Your First Trade',
    shortTitle: 'First Trade',
    points: 125,
    desc: 'Place one trade inside a game',
  },
  {
    id: 'finish_match',
    title: 'Finish a Match',
    shortTitle: 'Finish',
    points: 175,
    desc: 'Stay in until the results screen',
  },
  {
    id: 'win_streak',
    title: 'Win Streak',
    shortTitle: 'Streak',
    points: 200,
    desc: 'Chain back-to-back wins in the arena',
  },
  {
    id: 'share_link',
    title: 'Share Your Game Link',
    shortTitle: 'Share',
    points: 100,
    desc: 'Send your partner game URL to players',
  },
  {
    id: 'referral',
    title: 'Get a Referral Join',
    shortTitle: 'Referral',
    points: 250,
    desc: 'Bring in one player through your share link',
  },
] as const;
