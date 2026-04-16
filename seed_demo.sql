-- ============================================================
-- DerivArena Demo Seed Data
-- Safe to re-run: uses ON CONFLICT DO NOTHING everywhere
-- Run: psql "RAILWAY_URL" -f seed_demo.sql
-- ============================================================

BEGIN;

-- ============================================================
-- 1. ARENA USERS — 20 realistic players + 3 partners
-- ============================================================

INSERT INTO arena_users (id, deriv_account_id, deriv_login_id, display_name, role, arena_rating, total_games, total_wins, created_at, updated_at) VALUES
  -- Partners
  ('a1000000-0000-0000-0000-000000000001', 'PARTNER_KL_001', 'PARTNER_KL_001', 'TradersHub_KL', 'partner', 0, 0, 0, now() - interval '28 days', now()),
  ('a1000000-0000-0000-0000-000000000002', 'PARTNER_SG_002', 'PARTNER_SG_002', 'DerivPro_SG', 'partner', 0, 0, 0, now() - interval '25 days', now()),
  ('a1000000-0000-0000-0000-000000000003', 'PARTNER_DXB_003', 'PARTNER_DXB_003', 'AlphaEdge_Dubai', 'partner', 0, 0, 0, now() - interval '20 days', now()),
  -- Players
  ('b1000000-0000-0000-0000-000000000001', 'P_SHADOW_088', 'P_SHADOW_088', 'ShadowTrader_88', 'player', 4250, 47, 31, now() - interval '30 days', now()),
  ('b1000000-0000-0000-0000-000000000002', 'P_NIGHT_042', 'P_NIGHT_042', 'NightOwl_FX', 'player', 3980, 41, 26, now() - interval '29 days', now()),
  ('b1000000-0000-0000-0000-000000000003', 'P_RISING_007', 'P_RISING_007', 'RisingSun_42', 'player', 3720, 38, 24, now() - interval '27 days', now()),
  ('b1000000-0000-0000-0000-000000000004', 'P_VIPER_X99', 'P_VIPER_X99', 'ViperX_99', 'player', 3510, 35, 22, now() - interval '26 days', now()),
  ('b1000000-0000-0000-0000-000000000005', 'P_ALPHA_011', 'P_ALPHA_011', 'AlphaWolf_11', 'player', 3290, 33, 21, now() - interval '25 days', now()),
  ('b1000000-0000-0000-0000-000000000006', 'P_STEEL_055', 'P_STEEL_055', 'SteelMind_55', 'player', 3100, 30, 19, now() - interval '24 days', now()),
  ('b1000000-0000-0000-0000-000000000007', 'P_CRPTN_77', 'P_CRPTN_77', 'CryptonZero', 'player', 2870, 28, 17, now() - interval '23 days', now()),
  ('b1000000-0000-0000-0000-000000000008', 'P_BLAZE_22', 'P_BLAZE_22', 'BlazeRunner_22', 'player', 2650, 26, 16, now() - interval '22 days', now()),
  ('b1000000-0000-0000-0000-000000000009', 'P_STORM_64', 'P_STORM_64', 'StormBreaker64', 'player', 2450, 24, 15, now() - interval '21 days', now()),
  ('b1000000-0000-0000-0000-000000000010', 'P_PHNX_03', 'P_PHNX_03', 'PhoenixRise_03', 'player', 2200, 22, 13, now() - interval '20 days', now()),
  ('b1000000-0000-0000-0000-000000000011', 'P_LUNAR_88', 'P_LUNAR_88', 'LunarTrader_88', 'player', 2050, 20, 12, now() - interval '19 days', now()),
  ('b1000000-0000-0000-0000-000000000012', 'P_EDGE_44', 'P_EDGE_44', 'EdgeSeeker_44', 'player', 1900, 18, 11, now() - interval '18 days', now()),
  ('b1000000-0000-0000-0000-000000000013', 'P_OMEGA_13', 'P_OMEGA_13', 'OmegaPoint_13', 'player', 1750, 17, 10, now() - interval '17 days', now()),
  ('b1000000-0000-0000-0000-000000000014', 'P_SWIFT_71', 'P_SWIFT_71', 'SwiftCall_71', 'player', 1600, 15, 9, now() - interval '16 days', now()),
  ('b1000000-0000-0000-0000-000000000015', 'P_NOVA_29', 'P_NOVA_29', 'NovaPulse_29', 'player', 1450, 14, 8, now() - interval '15 days', now()),
  ('b1000000-0000-0000-0000-000000000016', 'P_TITAN_56', 'P_TITAN_56', 'TitanFall_56', 'player', 1300, 12, 7, now() - interval '14 days', now()),
  ('b1000000-0000-0000-0000-000000000017', 'P_ECHO_09', 'P_ECHO_09', 'EchoTrader_09', 'player', 1150, 10, 6, now() - interval '12 days', now()),
  ('b1000000-0000-0000-0000-000000000018', 'P_DRIFT_33', 'P_DRIFT_33', 'DriftKing_33', 'player', 1000, 8, 5, now() - interval '10 days', now()),
  ('b1000000-0000-0000-0000-000000000019', 'P_PULSE_18', 'P_PULSE_18', 'PulseRider_18', 'player', 890, 6, 3, now() - interval '7 days', now()),
  ('b1000000-0000-0000-0000-000000000020', 'P_ZETA_77', 'P_ZETA_77', 'ZetaCode_77', 'player', 780, 4, 2, now() - interval '5 days', now())
ON CONFLICT (deriv_account_id) DO NOTHING;

-- Also update existing demo users with better ratings
UPDATE arena_users SET arena_rating = 2100, total_games = 21, total_wins = 13 WHERE deriv_account_id = 'DEMO_P1';
UPDATE arena_users SET arena_rating = 1850, total_games = 18, total_wins = 11 WHERE deriv_account_id = 'deriv-1776320607464';
UPDATE arena_users SET arena_rating = 1600, total_games = 15, total_wins = 9  WHERE deriv_account_id = 'deriv-1776321689118';

-- ============================================================
-- 2. GAME TEMPLATES — 8 templates across all 6 game modes
-- ============================================================

INSERT INTO game_templates (id, slug, name, description, game_mode, created_by, config, is_featured, is_active, play_count, created_at, updated_at) VALUES
  ('c1000000-0000-0000-0000-000000000001',
   'volatility-sprint',
   'Volatility Sprint',
   'Trade Volatility 100 and 75 indices in a fast-paced 15-minute session. Sortino-ranked — reward consistent wins, not lucky spikes.',
   'classic',
   'a1000000-0000-0000-0000-000000000001',
   '{"duration_minutes": 15, "max_players": 50, "stake_range": [1, 100], "allowed_markets": ["R_100", "R_75", "R_50"], "contract_types": ["CALL", "PUT"]}',
   true, true, 87, now() - interval '25 days', now()),

  ('c1000000-0000-0000-0000-000000000002',
   'phantom-blitz',
   'Phantom Blitz',
   'Every trade you skip haunts you. Watch phantom trades play out in parallel and discover how your what-ifs stack up against reality.',
   'phantom_league',
   'a1000000-0000-0000-0000-000000000002',
   '{"duration_minutes": 20, "max_players": 30, "stake_range": [5, 50], "allowed_markets": ["R_100", "1HZ100V"], "contract_types": ["CALL", "PUT"]}',
   true, true, 64, now() - interval '22 days', now()),

  ('c1000000-0000-0000-0000-000000000003',
   'boxing-ring-championship',
   'Boxing Ring Championship',
   'Head-to-head combat trading. Every trade lands as a punch — rack up combos, trigger knockouts, and take your opponent down before tilt takes you.',
   'boxing_ring',
   'a1000000-0000-0000-0000-000000000001',
   '{"duration_minutes": 10, "max_players": 20, "stake_range": [2, 50], "allowed_markets": ["R_100", "R_50", "1HZ100V"], "contract_types": ["CALL", "PUT"]}',
   true, true, 73, now() - interval '20 days', now()),

  ('c1000000-0000-0000-0000-000000000004',
   'mirror-duel',
   'Mirror Duel',
   'Face an AI mirror of your worst habits. The Anti-You trades against you using your own patterns — beat it to prove you have evolved.',
   'anti_you',
   'a1000000-0000-0000-0000-000000000002',
   '{"duration_minutes": 15, "max_players": 40, "stake_range": [1, 100], "allowed_markets": ["R_100", "R_75", "R_25"], "contract_types": ["CALL", "PUT"]}',
   false, true, 51, now() - interval '18 days', now()),

  ('c1000000-0000-0000-0000-000000000005',
   'war-council',
   'War Council',
   'Team-based strategic trading with AI debate rounds. Vote on market direction, build consensus, and conquer the leaderboard together.',
   'war_room',
   'a1000000-0000-0000-0000-000000000003',
   '{"duration_minutes": 25, "max_players": 60, "stake_range": [5, 100], "allowed_markets": ["R_100", "R_50", "R_75", "1HZ100V"], "contract_types": ["CALL", "PUT"]}',
   false, true, 38, now() - interval '15 days', now()),

  ('c1000000-0000-0000-0000-000000000006',
   'discipline-sprint',
   'Discipline Sprint',
   'A 20-minute behavioral excellence challenge. Maintain the highest Behavioral Excellence Score — discipline earns more than luck here.',
   'behavioral_xray',
   'a1000000-0000-0000-0000-000000000003',
   '{"duration_minutes": 20, "max_players": 35, "stake_range": [2, 25], "allowed_markets": ["R_100", "R_75"], "contract_types": ["CALL", "PUT"]}',
   false, true, 29, now() - interval '12 days', now()),

  ('c1000000-0000-0000-0000-000000000007',
   'rise-fall-classic',
   'Rise & Fall Classic',
   'The purest form of trading competition. Rise or Fall on Volatility 100 for 15 minutes — may the best read win.',
   'classic',
   '7a53829f-847b-4ad5-a6a5-27e4d2332dbf',
   '{"duration_minutes": 15, "max_players": 50, "stake_range": [1, 50], "allowed_markets": ["R_100"], "contract_types": ["CALL", "PUT"]}',
   false, true, 42, now() - interval '10 days', now()),

  ('c1000000-0000-0000-0000-000000000008',
   'chaos-engine',
   'Chaos Engine',
   'High-frequency volatility trading in extreme market conditions. Only traders with iron discipline survive the Chaos Engine.',
   'classic',
   'a1000000-0000-0000-0000-000000000001',
   '{"duration_minutes": 10, "max_players": 100, "stake_range": [1, 25], "allowed_markets": ["R_100", "1HZ100V", "R_75", "R_50", "R_25"], "contract_types": ["CALL", "PUT"]}',
   false, true, 58, now() - interval '8 days', now())
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- 3. GAME INSTANCES — 3 live, 4 waiting, 8 finished
-- ============================================================

INSERT INTO game_instances (id, template_id, template_slug, started_by, status, started_at, ends_at, finished_at, player_count, created_at) VALUES
  -- LIVE instances (ends in 8-14 minutes from now)
  ('d1000000-0000-0000-0000-000000000001',
   'c1000000-0000-0000-0000-000000000001', 'volatility-sprint',
   'b1000000-0000-0000-0000-000000000001',
   'live', now() - interval '7 minutes', now() + interval '8 minutes', NULL, 9,
   now() - interval '7 minutes'),

  ('d1000000-0000-0000-0000-000000000002',
   'c1000000-0000-0000-0000-000000000003', 'boxing-ring-championship',
   'b1000000-0000-0000-0000-000000000003',
   'live', now() - interval '4 minutes', now() + '6 minutes', NULL, 6,
   now() - interval '4 minutes'),

  ('d1000000-0000-0000-0000-000000000003',
   'c1000000-0000-0000-0000-000000000002', 'phantom-blitz',
   'b1000000-0000-0000-0000-000000000005',
   'live', now() - interval '10 minutes', now() + interval '10 minutes', NULL, 12,
   now() - interval '10 minutes'),

  -- WAITING instances
  ('d1000000-0000-0000-0000-000000000004',
   'c1000000-0000-0000-0000-000000000004', 'mirror-duel',
   'b1000000-0000-0000-0000-000000000007',
   'waiting', NULL, now() + interval '15 minutes', NULL, 3,
   now() - interval '2 minutes'),

  ('d1000000-0000-0000-0000-000000000005',
   'c1000000-0000-0000-0000-000000000007', 'rise-fall-classic',
   'b1000000-0000-0000-0000-000000000010',
   'waiting', NULL, now() + interval '15 minutes', NULL, 1,
   now() - interval '1 minute'),

  ('d1000000-0000-0000-0000-000000000006',
   'c1000000-0000-0000-0000-000000000008', 'chaos-engine',
   'b1000000-0000-0000-0000-000000000002',
   'waiting', NULL, now() + interval '10 minutes', NULL, 5,
   now() - interval '3 minutes'),

  ('d1000000-0000-0000-0000-000000000007',
   'c1000000-0000-0000-0000-000000000005', 'war-council',
   '7a53829f-847b-4ad5-a6a5-27e4d2332dbf',
   'waiting', NULL, now() + interval '25 minutes', NULL, 2,
   now() - interval '5 minutes'),

  -- FINISHED instances (past)
  ('d1000000-0000-0000-0000-000000000008',
   'c1000000-0000-0000-0000-000000000001', 'volatility-sprint',
   'b1000000-0000-0000-0000-000000000001',
   'finished', now() - interval '2 days' - interval '15 minutes', now() - interval '2 days', now() - interval '2 days', 11,
   now() - interval '2 days' - interval '20 minutes'),

  ('d1000000-0000-0000-0000-000000000009',
   'c1000000-0000-0000-0000-000000000003', 'boxing-ring-championship',
   'b1000000-0000-0000-0000-000000000002',
   'finished', now() - interval '3 days' - interval '10 minutes', now() - interval '3 days', now() - interval '3 days', 8,
   now() - interval '3 days' - interval '15 minutes'),

  ('d1000000-0000-0000-0000-000000000010',
   'c1000000-0000-0000-0000-000000000002', 'phantom-blitz',
   'b1000000-0000-0000-0000-000000000003',
   'finished', now() - interval '4 days' - interval '20 minutes', now() - interval '4 days', now() - interval '4 days', 9,
   now() - interval '4 days' - interval '25 minutes'),

  ('d1000000-0000-0000-0000-000000000011',
   'c1000000-0000-0000-0000-000000000004', 'mirror-duel',
   'b1000000-0000-0000-0000-000000000004',
   'finished', now() - interval '5 days' - interval '15 minutes', now() - interval '5 days', now() - interval '5 days', 10,
   now() - interval '5 days' - interval '20 minutes'),

  ('d1000000-0000-0000-0000-000000000012',
   'c1000000-0000-0000-0000-000000000007', 'rise-fall-classic',
   'b1000000-0000-0000-0000-000000000005',
   'finished', now() - interval '6 days' - interval '15 minutes', now() - interval '6 days', now() - interval '6 days', 12,
   now() - interval '6 days' - interval '20 minutes'),

  ('d1000000-0000-0000-0000-000000000013',
   'c1000000-0000-0000-0000-000000000006', 'discipline-sprint',
   'b1000000-0000-0000-0000-000000000006',
   'finished', now() - interval '7 days' - interval '20 minutes', now() - interval '7 days', now() - interval '7 days', 7,
   now() - interval '7 days' - interval '25 minutes'),

  ('d1000000-0000-0000-0000-000000000014',
   'c1000000-0000-0000-0000-000000000001', 'volatility-sprint',
   'b1000000-0000-0000-0000-000000000007',
   'finished', now() - interval '9 days' - interval '15 minutes', now() - interval '9 days', now() - interval '9 days', 13,
   now() - interval '9 days' - interval '20 minutes'),

  ('d1000000-0000-0000-0000-000000000015',
   'c1000000-0000-0000-0000-000000000008', 'chaos-engine',
   'b1000000-0000-0000-0000-000000000008',
   'finished', now() - interval '11 days' - interval '10 minutes', now() - interval '11 days', now() - interval '11 days', 14,
   now() - interval '11 days' - interval '15 minutes')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 4. INSTANCE PLAYERS + 5. GAME SCORES for finished instances
-- ============================================================

-- Instance d8 (Volatility Sprint, finished 2 days ago, 11 players)
INSERT INTO instance_players (instance_id, user_id, score, normalized_score, rank, trades_count, pnl, behavioral_score, joined_at)
SELECT 'd1000000-0000-0000-0000-000000000008', uid, sc, ns, rk, tr, pn, bs,
       now() - interval '2 days' - interval '18 minutes'
FROM (VALUES
  ('b1000000-0000-0000-0000-000000000001'::uuid, 2840.0, 9.8, 1, 14, 182.50, 88.0),
  ('b1000000-0000-0000-0000-000000000002'::uuid, 2650.0, 9.1, 2, 12, 165.00, 84.0),
  ('b1000000-0000-0000-0000-000000000003'::uuid, 2440.0, 8.4, 3, 11, 148.75, 82.0),
  ('b1000000-0000-0000-0000-000000000004'::uuid, 2210.0, 7.6, 4, 10, 128.50, 79.0),
  ('b1000000-0000-0000-0000-000000000005'::uuid, 1980.0, 6.8, 5,  9,  98.00, 75.0),
  ('b1000000-0000-0000-0000-000000000006'::uuid, 1750.0, 6.0, 6,  9,  72.25, 71.0),
  ('b1000000-0000-0000-0000-000000000007'::uuid, 1520.0, 5.2, 7,  8,  44.50, 66.0),
  ('b1000000-0000-0000-0000-000000000008'::uuid, 1290.0, 4.4, 8,  8,  18.00, 61.0),
  ('b1000000-0000-0000-0000-000000000009'::uuid, 1050.0, 3.6, 9,  7, -12.50, 56.0),
  ('b1000000-0000-0000-0000-000000000010'::uuid,  820.0, 2.8,10,  7, -38.75, 50.0),
  ('b1000000-0000-0000-0000-000000000011'::uuid,  580.0, 2.0,11,  6, -67.00, 44.0)
) AS t(uid, sc, ns, rk, tr, pn, bs)
ON CONFLICT (instance_id, user_id) DO NOTHING;

INSERT INTO game_scores (instance_id, user_id, raw_score, normalized_score, pnl, trade_count, sortino_ratio, behavioral_score, percentile)
SELECT 'd1000000-0000-0000-0000-000000000008', uid, sc, ns, pn, tr, sr, bs, pc
FROM (VALUES
  ('b1000000-0000-0000-0000-000000000001'::uuid, 2840.0, 9.8, 182.50, 14, 2.14, 88.0, 95.0),
  ('b1000000-0000-0000-0000-000000000002'::uuid, 2650.0, 9.1, 165.00, 12, 1.98, 84.0, 86.4),
  ('b1000000-0000-0000-0000-000000000003'::uuid, 2440.0, 8.4, 148.75, 11, 1.81, 82.0, 77.3),
  ('b1000000-0000-0000-0000-000000000004'::uuid, 2210.0, 7.6, 128.50, 10, 1.62, 79.0, 68.2),
  ('b1000000-0000-0000-0000-000000000005'::uuid, 1980.0, 6.8,  98.00,  9, 1.43, 75.0, 59.1),
  ('b1000000-0000-0000-0000-000000000006'::uuid, 1750.0, 6.0,  72.25,  9, 1.24, 71.0, 50.0),
  ('b1000000-0000-0000-0000-000000000007'::uuid, 1520.0, 5.2,  44.50,  8, 1.05, 66.0, 40.9),
  ('b1000000-0000-0000-0000-000000000008'::uuid, 1290.0, 4.4,  18.00,  8, 0.86, 61.0, 31.8),
  ('b1000000-0000-0000-0000-000000000009'::uuid, 1050.0, 3.6, -12.50,  7, 0.67, 56.0, 22.7),
  ('b1000000-0000-0000-0000-000000000010'::uuid,  820.0, 2.8, -38.75,  7, 0.48, 50.0, 13.6),
  ('b1000000-0000-0000-0000-000000000011'::uuid,  580.0, 2.0, -67.00,  6, 0.29, 44.0,  4.5)
) AS t(uid, sc, ns, pn, tr, sr, bs, pc);

-- Instance d9 (Boxing Ring, finished 3 days ago, 8 players)
INSERT INTO instance_players (instance_id, user_id, score, normalized_score, rank, trades_count, pnl, behavioral_score, joined_at)
SELECT 'd1000000-0000-0000-0000-000000000009', uid, sc, ns, rk, tr, pn, bs,
       now() - interval '3 days' - interval '13 minutes'
FROM (VALUES
  ('b1000000-0000-0000-0000-000000000002'::uuid, 3100.0, 9.6, 1, 13, 210.00, 91.0),
  ('b1000000-0000-0000-0000-000000000001'::uuid, 2880.0, 8.9, 2, 12, 185.50, 87.0),
  ('b1000000-0000-0000-0000-000000000005'::uuid, 2550.0, 7.9, 3, 10, 142.75, 82.0),
  ('b1000000-0000-0000-0000-000000000009'::uuid, 2200.0, 6.8, 4,  9,  98.50, 76.0),
  ('b1000000-0000-0000-0000-000000000011'::uuid, 1850.0, 5.7, 5,  8,  55.25, 70.0),
  ('b1000000-0000-0000-0000-000000000013'::uuid, 1500.0, 4.6, 6,  8,  14.00, 63.0),
  ('b1000000-0000-0000-0000-000000000015'::uuid, 1150.0, 3.6, 7,  7, -28.50, 57.0),
  ('b1000000-0000-0000-0000-000000000018'::uuid,  800.0, 2.5, 8,  7, -72.00, 49.0)
) AS t(uid, sc, ns, rk, tr, pn, bs)
ON CONFLICT (instance_id, user_id) DO NOTHING;

INSERT INTO game_scores (instance_id, user_id, raw_score, normalized_score, pnl, trade_count, sortino_ratio, behavioral_score, percentile)
SELECT 'd1000000-0000-0000-0000-000000000009', uid, sc, ns, pn, tr, sr, bs, pc
FROM (VALUES
  ('b1000000-0000-0000-0000-000000000002'::uuid, 3100.0, 9.6, 210.00, 13, 2.31, 91.0, 94.0),
  ('b1000000-0000-0000-0000-000000000001'::uuid, 2880.0, 8.9, 185.50, 12, 2.14, 87.0, 82.0),
  ('b1000000-0000-0000-0000-000000000005'::uuid, 2550.0, 7.9, 142.75, 10, 1.88, 82.0, 70.0),
  ('b1000000-0000-0000-0000-000000000009'::uuid, 2200.0, 6.8,  98.50,  9, 1.62, 76.0, 58.0),
  ('b1000000-0000-0000-0000-000000000011'::uuid, 1850.0, 5.7,  55.25,  8, 1.36, 70.0, 46.0),
  ('b1000000-0000-0000-0000-000000000013'::uuid, 1500.0, 4.6,  14.00,  8, 1.09, 63.0, 34.0),
  ('b1000000-0000-0000-0000-000000000015'::uuid, 1150.0, 3.6, -28.50,  7, 0.83, 57.0, 22.0),
  ('b1000000-0000-0000-0000-000000000018'::uuid,  800.0, 2.5, -72.00,  7, 0.57, 49.0, 10.0)
) AS t(uid, sc, ns, pn, tr, sr, bs, pc);

-- Instance d10 (Phantom Blitz, finished 4 days ago)
INSERT INTO instance_players (instance_id, user_id, score, normalized_score, rank, trades_count, pnl, behavioral_score, joined_at)
SELECT 'd1000000-0000-0000-0000-000000000010', uid, sc, ns, rk, tr, pn, bs,
       now() - interval '4 days' - interval '23 minutes'
FROM (VALUES
  ('b1000000-0000-0000-0000-000000000003'::uuid, 2920.0, 9.7, 1, 11, 195.00, 89.0),
  ('b1000000-0000-0000-0000-000000000006'::uuid, 2710.0, 9.0, 2, 10, 168.50, 85.0),
  ('b1000000-0000-0000-0000-000000000004'::uuid, 2480.0, 8.3, 3, 10, 138.75, 81.0),
  ('b1000000-0000-0000-0000-000000000008'::uuid, 2210.0, 7.4, 4,  9, 105.25, 77.0),
  ('b1000000-0000-0000-0000-000000000012'::uuid, 1920.0, 6.4, 5,  9,  68.00, 72.0),
  ('b1000000-0000-0000-0000-000000000014'::uuid, 1630.0, 5.4, 6,  8,  32.50, 66.0),
  ('b1000000-0000-0000-0000-000000000016'::uuid, 1340.0, 4.5, 7,  8,  -4.75, 59.0),
  ('b1000000-0000-0000-0000-000000000019'::uuid, 1050.0, 3.5, 8,  7, -38.00, 53.0),
  ('b1000000-0000-0000-0000-000000000020'::uuid,  760.0, 2.5, 9,  7, -74.25, 46.0)
) AS t(uid, sc, ns, rk, tr, pn, bs)
ON CONFLICT (instance_id, user_id) DO NOTHING;

INSERT INTO game_scores (instance_id, user_id, raw_score, normalized_score, pnl, trade_count, sortino_ratio, behavioral_score, percentile)
SELECT 'd1000000-0000-0000-0000-000000000010', uid, sc, ns, pn, tr, sr, bs, pc
FROM (VALUES
  ('b1000000-0000-0000-0000-000000000003'::uuid, 2920.0, 9.7, 195.00, 11, 2.20, 89.0, 95.0),
  ('b1000000-0000-0000-0000-000000000006'::uuid, 2710.0, 9.0, 168.50, 10, 2.04, 85.0, 84.0),
  ('b1000000-0000-0000-0000-000000000004'::uuid, 2480.0, 8.3, 138.75, 10, 1.87, 81.0, 73.0),
  ('b1000000-0000-0000-0000-000000000008'::uuid, 2210.0, 7.4, 105.25,  9, 1.66, 77.0, 62.0),
  ('b1000000-0000-0000-0000-000000000012'::uuid, 1920.0, 6.4,  68.00,  9, 1.44, 72.0, 51.0),
  ('b1000000-0000-0000-0000-000000000014'::uuid, 1630.0, 5.4,  32.50,  8, 1.23, 66.0, 40.0),
  ('b1000000-0000-0000-0000-000000000016'::uuid, 1340.0, 4.5,  -4.75,  8, 1.01, 59.0, 29.0),
  ('b1000000-0000-0000-0000-000000000019'::uuid, 1050.0, 3.5, -38.00,  7, 0.79, 53.0, 18.0),
  ('b1000000-0000-0000-0000-000000000020'::uuid,  760.0, 2.5, -74.25,  7, 0.57, 46.0,  7.0)
) AS t(uid, sc, ns, pn, tr, sr, bs, pc);

-- Instance d11 (Mirror Duel, finished 5 days ago)
INSERT INTO instance_players (instance_id, user_id, score, normalized_score, rank, trades_count, pnl, behavioral_score, joined_at)
SELECT 'd1000000-0000-0000-0000-000000000011', uid, sc, ns, rk, tr, pn, bs,
       now() - interval '5 days' - interval '18 minutes'
FROM (VALUES
  ('b1000000-0000-0000-0000-000000000004'::uuid, 2760.0, 9.5, 1, 12, 178.50, 87.0),
  ('b1000000-0000-0000-0000-000000000007'::uuid, 2520.0, 8.7, 2, 11, 150.25, 83.0),
  ('b1000000-0000-0000-0000-000000000010'::uuid, 2280.0, 7.8, 3, 10, 120.00, 79.0),
  ('b1000000-0000-0000-0000-000000000013'::uuid, 2040.0, 7.0, 4,  9,  88.50, 74.0),
  ('b1000000-0000-0000-0000-000000000002'::uuid, 1790.0, 6.2, 5,  9,  55.25, 69.0),
  ('b1000000-0000-0000-0000-000000000017'::uuid, 1540.0, 5.3, 6,  8,  22.00, 63.0),
  ('b1000000-0000-0000-0000-000000000001'::uuid, 1290.0, 4.4, 7,  8, -14.75, 57.0),
  ('b1000000-0000-0000-0000-000000000020'::uuid, 1040.0, 3.6, 8,  7, -48.50, 51.0),
  ('b1000000-0000-0000-0000-000000000015'::uuid,  790.0, 2.7, 9,  7, -82.25, 44.0),
  ('b1000000-0000-0000-0000-000000000018'::uuid,  540.0, 1.9,10,  6,-118.00, 37.0)
) AS t(uid, sc, ns, rk, tr, pn, bs)
ON CONFLICT (instance_id, user_id) DO NOTHING;

INSERT INTO game_scores (instance_id, user_id, raw_score, normalized_score, pnl, trade_count, sortino_ratio, behavioral_score, percentile)
SELECT 'd1000000-0000-0000-0000-000000000011', uid, sc, ns, pn, tr, sr, bs, pc
FROM (VALUES
  ('b1000000-0000-0000-0000-000000000004'::uuid, 2760.0, 9.5, 178.50, 12, 2.08, 87.0, 95.0),
  ('b1000000-0000-0000-0000-000000000007'::uuid, 2520.0, 8.7, 150.25, 11, 1.90, 83.0, 85.0),
  ('b1000000-0000-0000-0000-000000000010'::uuid, 2280.0, 7.8, 120.00, 10, 1.72, 79.0, 75.0),
  ('b1000000-0000-0000-0000-000000000013'::uuid, 2040.0, 7.0,  88.50,  9, 1.54, 74.0, 65.0),
  ('b1000000-0000-0000-0000-000000000002'::uuid, 1790.0, 6.2,  55.25,  9, 1.35, 69.0, 55.0),
  ('b1000000-0000-0000-0000-000000000017'::uuid, 1540.0, 5.3,  22.00,  8, 1.16, 63.0, 45.0),
  ('b1000000-0000-0000-0000-000000000001'::uuid, 1290.0, 4.4, -14.75,  8, 0.97, 57.0, 35.0),
  ('b1000000-0000-0000-0000-000000000020'::uuid, 1040.0, 3.6, -48.50,  7, 0.78, 51.0, 25.0),
  ('b1000000-0000-0000-0000-000000000015'::uuid,  790.0, 2.7, -82.25,  7, 0.60, 44.0, 15.0),
  ('b1000000-0000-0000-0000-000000000018'::uuid,  540.0, 1.9,-118.00,  6, 0.41, 37.0,  5.0)
) AS t(uid, sc, ns, pn, tr, sr, bs, pc);

-- Instance d12 (Rise & Fall Classic, finished 6 days ago, 12 players)
INSERT INTO instance_players (instance_id, user_id, score, normalized_score, rank, trades_count, pnl, behavioral_score, joined_at)
SELECT 'd1000000-0000-0000-0000-000000000012', uid, sc, ns, rk, tr, pn, bs,
       now() - interval '6 days' - interval '18 minutes'
FROM (VALUES
  ('b1000000-0000-0000-0000-000000000005'::uuid, 3050.0, 9.9, 1, 15, 222.00, 92.0),
  ('b1000000-0000-0000-0000-000000000003'::uuid, 2810.0, 9.1, 2, 14, 194.50, 88.0),
  ('b1000000-0000-0000-0000-000000000001'::uuid, 2570.0, 8.3, 3, 13, 165.00, 84.0),
  ('b1000000-0000-0000-0000-000000000006'::uuid, 2330.0, 7.6, 4, 12, 134.75, 80.0),
  ('b1000000-0000-0000-0000-000000000008'::uuid, 2090.0, 6.8, 5, 11, 103.50, 75.0),
  ('b1000000-0000-0000-0000-000000000011'::uuid, 1850.0, 6.0, 6, 11,  71.25, 70.0),
  ('b1000000-0000-0000-0000-000000000014'::uuid, 1610.0, 5.2, 7, 10,  38.00, 65.0),
  ('b1000000-0000-0000-0000-000000000016'::uuid, 1370.0, 4.4, 8, 10,   4.75, 59.0),
  ('b1000000-0000-0000-0000-000000000019'::uuid, 1130.0, 3.7, 9,  9, -30.50, 53.0),
  ('b1000000-0000-0000-0000-000000000004'::uuid,  890.0, 2.9,10,  9, -65.25, 47.0),
  ('b1000000-0000-0000-0000-000000000017'::uuid,  650.0, 2.1,11,  8,-100.00, 41.0),
  ('b1000000-0000-0000-0000-000000000020'::uuid,  410.0, 1.3,12,  8,-135.75, 34.0)
) AS t(uid, sc, ns, rk, tr, pn, bs)
ON CONFLICT (instance_id, user_id) DO NOTHING;

INSERT INTO game_scores (instance_id, user_id, raw_score, normalized_score, pnl, trade_count, sortino_ratio, behavioral_score, percentile)
SELECT 'd1000000-0000-0000-0000-000000000012', uid, sc, ns, pn, tr, sr, bs, pc
FROM (VALUES
  ('b1000000-0000-0000-0000-000000000005'::uuid, 3050.0, 9.9, 222.00, 15, 2.38, 92.0, 95.8),
  ('b1000000-0000-0000-0000-000000000003'::uuid, 2810.0, 9.1, 194.50, 14, 2.19, 88.0, 87.5),
  ('b1000000-0000-0000-0000-000000000001'::uuid, 2570.0, 8.3, 165.00, 13, 2.00, 84.0, 79.2),
  ('b1000000-0000-0000-0000-000000000006'::uuid, 2330.0, 7.6, 134.75, 12, 1.81, 80.0, 70.8),
  ('b1000000-0000-0000-0000-000000000008'::uuid, 2090.0, 6.8, 103.50, 11, 1.62, 75.0, 62.5),
  ('b1000000-0000-0000-0000-000000000011'::uuid, 1850.0, 6.0,  71.25, 11, 1.43, 70.0, 54.2),
  ('b1000000-0000-0000-0000-000000000014'::uuid, 1610.0, 5.2,  38.00, 10, 1.24, 65.0, 45.8),
  ('b1000000-0000-0000-0000-000000000016'::uuid, 1370.0, 4.4,   4.75, 10, 1.05, 59.0, 37.5),
  ('b1000000-0000-0000-0000-000000000019'::uuid, 1130.0, 3.7, -30.50,  9, 0.86, 53.0, 29.2),
  ('b1000000-0000-0000-0000-000000000004'::uuid,  890.0, 2.9, -65.25,  9, 0.67, 47.0, 20.8),
  ('b1000000-0000-0000-0000-000000000017'::uuid,  650.0, 2.1,-100.00,  8, 0.48, 41.0, 12.5),
  ('b1000000-0000-0000-0000-000000000020'::uuid,  410.0, 1.3,-135.75,  8, 0.29, 34.0,  4.2)
) AS t(uid, sc, ns, pn, tr, sr, bs, pc);

-- Instance d13 (Discipline Sprint, finished 7 days ago)
INSERT INTO instance_players (instance_id, user_id, score, normalized_score, rank, trades_count, pnl, behavioral_score, joined_at)
SELECT 'd1000000-0000-0000-0000-000000000013', uid, sc, ns, rk, tr, pn, bs,
       now() - interval '7 days' - interval '23 minutes'
FROM (VALUES
  ('b1000000-0000-0000-0000-000000000006'::uuid, 2680.0, 9.8, 1, 11, 162.00, 94.0),
  ('b1000000-0000-0000-0000-000000000003'::uuid, 2440.0, 8.9, 2, 10, 138.50, 91.0),
  ('b1000000-0000-0000-0000-000000000009'::uuid, 2200.0, 8.0, 3,  9, 114.25, 87.0),
  ('b1000000-0000-0000-0000-000000000012'::uuid, 1960.0, 7.2, 4,  9,  88.00, 83.0),
  ('b1000000-0000-0000-0000-000000000001'::uuid, 1710.0, 6.3, 5,  8,  60.75, 78.0),
  ('b1000000-0000-0000-0000-000000000015'::uuid, 1460.0, 5.3, 6,  8,  32.50, 72.0),
  ('b1000000-0000-0000-0000-000000000018'::uuid, 1210.0, 4.4, 7,  7,   4.25, 66.0)
) AS t(uid, sc, ns, rk, tr, pn, bs)
ON CONFLICT (instance_id, user_id) DO NOTHING;

INSERT INTO game_scores (instance_id, user_id, raw_score, normalized_score, pnl, trade_count, sortino_ratio, behavioral_score, percentile)
SELECT 'd1000000-0000-0000-0000-000000000013', uid, sc, ns, pn, tr, sr, bs, pc
FROM (VALUES
  ('b1000000-0000-0000-0000-000000000006'::uuid, 2680.0, 9.8, 162.00, 11, 2.25, 94.0, 95.0),
  ('b1000000-0000-0000-0000-000000000003'::uuid, 2440.0, 8.9, 138.50, 10, 2.05, 91.0, 81.0),
  ('b1000000-0000-0000-0000-000000000009'::uuid, 2200.0, 8.0, 114.25,  9, 1.85, 87.0, 67.0),
  ('b1000000-0000-0000-0000-000000000012'::uuid, 1960.0, 7.2,  88.00,  9, 1.65, 83.0, 53.0),
  ('b1000000-0000-0000-0000-000000000001'::uuid, 1710.0, 6.3,  60.75,  8, 1.44, 78.0, 39.0),
  ('b1000000-0000-0000-0000-000000000015'::uuid, 1460.0, 5.3,  32.50,  8, 1.23, 72.0, 25.0),
  ('b1000000-0000-0000-0000-000000000018'::uuid, 1210.0, 4.4,   4.25,  7, 1.02, 66.0, 11.0)
) AS t(uid, sc, ns, pn, tr, sr, bs, pc);

-- Instance d14 (Volatility Sprint, finished 9 days ago, 13 players)
INSERT INTO instance_players (instance_id, user_id, score, normalized_score, rank, trades_count, pnl, behavioral_score, joined_at)
SELECT 'd1000000-0000-0000-0000-000000000014', uid, sc, ns, rk, tr, pn, bs,
       now() - interval '9 days' - interval '18 minutes'
FROM (VALUES
  ('b1000000-0000-0000-0000-000000000007'::uuid, 2900.0, 9.7, 1, 13, 188.00, 88.0),
  ('b1000000-0000-0000-0000-000000000004'::uuid, 2660.0, 8.9, 2, 12, 160.50, 84.0),
  ('b1000000-0000-0000-0000-000000000010'::uuid, 2420.0, 8.1, 3, 11, 132.00, 80.0),
  ('b1000000-0000-0000-0000-000000000002'::uuid, 2180.0, 7.3, 4, 11, 102.50, 76.0),
  ('b1000000-0000-0000-0000-000000000013'::uuid, 1930.0, 6.5, 5, 10,  72.00, 71.0),
  ('b1000000-0000-0000-0000-000000000005'::uuid, 1680.0, 5.6, 6, 10,  40.50, 66.0),
  ('b1000000-0000-0000-0000-000000000016'::uuid, 1430.0, 4.8, 7,  9,   9.00, 61.0),
  ('b1000000-0000-0000-0000-000000000019'::uuid, 1180.0, 4.0, 8,  9, -22.50, 55.0),
  ('b1000000-0000-0000-0000-000000000008'::uuid,  930.0, 3.1, 9,  8, -54.00, 49.0),
  ('b1000000-0000-0000-0000-000000000011'::uuid,  680.0, 2.3,10,  8, -86.50, 43.0),
  ('b1000000-0000-0000-0000-000000000014'::uuid,  480.0, 1.6,11,  7,-114.00, 38.0),
  ('b1000000-0000-0000-0000-000000000017'::uuid,  330.0, 1.1,12,  7,-138.50, 33.0),
  ('b1000000-0000-0000-0000-000000000020'::uuid,  200.0, 0.7,13,  6,-165.00, 28.0)
) AS t(uid, sc, ns, rk, tr, pn, bs)
ON CONFLICT (instance_id, user_id) DO NOTHING;

INSERT INTO game_scores (instance_id, user_id, raw_score, normalized_score, pnl, trade_count, sortino_ratio, behavioral_score, percentile)
SELECT 'd1000000-0000-0000-0000-000000000014', uid, sc, ns, pn, tr, sr, bs, pc
FROM (VALUES
  ('b1000000-0000-0000-0000-000000000007'::uuid, 2900.0, 9.7, 188.00, 13, 2.19, 88.0, 96.2),
  ('b1000000-0000-0000-0000-000000000004'::uuid, 2660.0, 8.9, 160.50, 12, 2.01, 84.0, 88.5),
  ('b1000000-0000-0000-0000-000000000010'::uuid, 2420.0, 8.1, 132.00, 11, 1.83, 80.0, 80.8),
  ('b1000000-0000-0000-0000-000000000002'::uuid, 2180.0, 7.3, 102.50, 11, 1.65, 76.0, 73.1),
  ('b1000000-0000-0000-0000-000000000013'::uuid, 1930.0, 6.5,  72.00, 10, 1.46, 71.0, 65.4),
  ('b1000000-0000-0000-0000-000000000005'::uuid, 1680.0, 5.6,  40.50, 10, 1.27, 66.0, 57.7),
  ('b1000000-0000-0000-0000-000000000016'::uuid, 1430.0, 4.8,   9.00,  9, 1.08, 61.0, 50.0),
  ('b1000000-0000-0000-0000-000000000019'::uuid, 1180.0, 4.0, -22.50,  9, 0.90, 55.0, 42.3),
  ('b1000000-0000-0000-0000-000000000008'::uuid,  930.0, 3.1, -54.00,  8, 0.71, 49.0, 34.6),
  ('b1000000-0000-0000-0000-000000000011'::uuid,  680.0, 2.3, -86.50,  8, 0.52, 43.0, 26.9),
  ('b1000000-0000-0000-0000-000000000014'::uuid,  480.0, 1.6,-114.00,  7, 0.36, 38.0, 19.2),
  ('b1000000-0000-0000-0000-000000000017'::uuid,  330.0, 1.1,-138.50,  7, 0.25, 33.0, 11.5),
  ('b1000000-0000-0000-0000-000000000020'::uuid,  200.0, 0.7,-165.00,  6, 0.15, 28.0,  3.8)
) AS t(uid, sc, ns, pn, tr, sr, bs, pc);

-- Instance d15 (Chaos Engine, finished 11 days ago, 14 players)
INSERT INTO instance_players (instance_id, user_id, score, normalized_score, rank, trades_count, pnl, behavioral_score, joined_at)
SELECT 'd1000000-0000-0000-0000-000000000015', uid, sc, ns, rk, tr, pn, bs,
       now() - interval '11 days' - interval '13 minutes'
FROM (VALUES
  ('b1000000-0000-0000-0000-000000000008'::uuid, 3200.0, 9.9, 1, 18, 245.00, 89.0),
  ('b1000000-0000-0000-0000-000000000005'::uuid, 2950.0, 9.1, 2, 17, 215.50, 85.0),
  ('b1000000-0000-0000-0000-000000000002'::uuid, 2700.0, 8.4, 3, 16, 185.00, 82.0),
  ('b1000000-0000-0000-0000-000000000009'::uuid, 2450.0, 7.6, 4, 15, 153.50, 78.0),
  ('b1000000-0000-0000-0000-000000000011'::uuid, 2200.0, 6.8, 5, 14, 120.25, 73.0),
  ('b1000000-0000-0000-0000-000000000006'::uuid, 1950.0, 6.0, 6, 13,  86.00, 68.0),
  ('b1000000-0000-0000-0000-000000000013'::uuid, 1700.0, 5.3, 7, 13,  51.75, 63.0),
  ('b1000000-0000-0000-0000-000000000001'::uuid, 1450.0, 4.5, 8, 12,  17.50, 58.0),
  ('b1000000-0000-0000-0000-000000000016'::uuid, 1200.0, 3.7, 9, 12, -16.75, 52.0),
  ('b1000000-0000-0000-0000-000000000003'::uuid,  950.0, 2.9,10, 11, -51.00, 46.0),
  ('b1000000-0000-0000-0000-000000000018'::uuid,  700.0, 2.2,11, 11, -85.25, 40.0),
  ('b1000000-0000-0000-0000-000000000014'::uuid,  500.0, 1.5,12, 10,-115.50, 35.0),
  ('b1000000-0000-0000-0000-000000000019'::uuid,  350.0, 1.1,13, 10,-142.75, 30.0),
  ('b1000000-0000-0000-0000-000000000020'::uuid,  200.0, 0.6,14,  9,-172.00, 24.0)
) AS t(uid, sc, ns, rk, tr, pn, bs)
ON CONFLICT (instance_id, user_id) DO NOTHING;

INSERT INTO game_scores (instance_id, user_id, raw_score, normalized_score, pnl, trade_count, sortino_ratio, behavioral_score, percentile)
SELECT 'd1000000-0000-0000-0000-000000000015', uid, sc, ns, pn, tr, sr, bs, pc
FROM (VALUES
  ('b1000000-0000-0000-0000-000000000008'::uuid, 3200.0, 9.9, 245.00, 18, 2.44, 89.0, 96.4),
  ('b1000000-0000-0000-0000-000000000005'::uuid, 2950.0, 9.1, 215.50, 17, 2.25, 85.0, 89.3),
  ('b1000000-0000-0000-0000-000000000002'::uuid, 2700.0, 8.4, 185.00, 16, 2.06, 82.0, 82.1),
  ('b1000000-0000-0000-0000-000000000009'::uuid, 2450.0, 7.6, 153.50, 15, 1.87, 78.0, 75.0),
  ('b1000000-0000-0000-0000-000000000011'::uuid, 2200.0, 6.8, 120.25, 14, 1.68, 73.0, 67.9),
  ('b1000000-0000-0000-0000-000000000006'::uuid, 1950.0, 6.0,  86.00, 13, 1.49, 68.0, 60.7),
  ('b1000000-0000-0000-0000-000000000013'::uuid, 1700.0, 5.3,  51.75, 13, 1.30, 63.0, 53.6),
  ('b1000000-0000-0000-0000-000000000001'::uuid, 1450.0, 4.5,  17.50, 12, 1.11, 58.0, 46.4),
  ('b1000000-0000-0000-0000-000000000016'::uuid, 1200.0, 3.7, -16.75, 12, 0.92, 52.0, 39.3),
  ('b1000000-0000-0000-0000-000000000003'::uuid,  950.0, 2.9, -51.00, 11, 0.73, 46.0, 32.1),
  ('b1000000-0000-0000-0000-000000000018'::uuid,  700.0, 2.2, -85.25, 11, 0.54, 40.0, 25.0),
  ('b1000000-0000-0000-0000-000000000014'::uuid,  500.0, 1.5,-115.50, 10, 0.38, 35.0, 17.9),
  ('b1000000-0000-0000-0000-000000000019'::uuid,  350.0, 1.1,-142.75, 10, 0.26, 30.0, 10.7),
  ('b1000000-0000-0000-0000-000000000020'::uuid,  200.0, 0.6,-172.00,  9, 0.15, 24.0,  3.6)
) AS t(uid, sc, ns, pn, tr, sr, bs, pc);

-- Players for LIVE instances (so Live tab shows real player counts)
INSERT INTO instance_players (instance_id, user_id, score, normalized_score, rank, trades_count, pnl, behavioral_score, joined_at)
SELECT 'd1000000-0000-0000-0000-000000000001', uid, sc, ns, rk, tr, pn, bs, now() - interval '6 minutes'
FROM (VALUES
  ('b1000000-0000-0000-0000-000000000001'::uuid,  840.0, 7.2, 1, 4,  48.50, 82.0),
  ('b1000000-0000-0000-0000-000000000002'::uuid,  720.0, 6.2, 2, 4,  36.00, 78.0),
  ('b1000000-0000-0000-0000-000000000004'::uuid,  610.0, 5.2, 3, 3,  22.50, 74.0),
  ('b1000000-0000-0000-0000-000000000006'::uuid,  490.0, 4.2, 4, 3,   8.00, 69.0),
  ('b1000000-0000-0000-0000-000000000009'::uuid,  370.0, 3.2, 5, 3,  -6.50, 63.0),
  ('b1000000-0000-0000-0000-000000000012'::uuid,  250.0, 2.1, 6, 3, -21.00, 57.0),
  ('b1000000-0000-0000-0000-000000000015'::uuid,  130.0, 1.1, 7, 2, -35.50, 51.0),
  ('1ab80c7a-5fde-4efa-95aa-482ca4ff6c2b'::uuid,  560.0, 4.8, 4, 3,  15.25, 72.0),
  ('b2c68e0d-fd93-467e-b093-53234a5b08b3'::uuid,  420.0, 3.6, 5, 3,   2.00, 66.0)
) AS t(uid, sc, ns, rk, tr, pn, bs)
ON CONFLICT (instance_id, user_id) DO NOTHING;

INSERT INTO instance_players (instance_id, user_id, score, normalized_score, rank, trades_count, pnl, behavioral_score, joined_at)
SELECT 'd1000000-0000-0000-0000-000000000002', uid, sc, ns, rk, tr, pn, bs, now() - interval '3 minutes'
FROM (VALUES
  ('b1000000-0000-0000-0000-000000000003'::uuid,  520.0, 8.1, 1, 3,  28.00, 85.0),
  ('b1000000-0000-0000-0000-000000000007'::uuid,  410.0, 6.4, 2, 3,  18.50, 80.0),
  ('b1000000-0000-0000-0000-000000000010'::uuid,  300.0, 4.7, 3, 2,   6.25, 74.0),
  ('b1000000-0000-0000-0000-000000000013'::uuid,  190.0, 3.0, 4, 2,  -4.50, 67.0),
  ('b1000000-0000-0000-0000-000000000016'::uuid,   80.0, 1.2, 5, 2, -15.25, 60.0),
  ('b1000000-0000-0000-0000-000000000019'::uuid,  -30.0, 0.0, 6, 2, -26.00, 53.0)
) AS t(uid, sc, ns, rk, tr, pn, bs)
ON CONFLICT (instance_id, user_id) DO NOTHING;

INSERT INTO instance_players (instance_id, user_id, score, normalized_score, rank, trades_count, pnl, behavioral_score, joined_at)
SELECT 'd1000000-0000-0000-0000-000000000003', uid, sc, ns, rk, tr, pn, bs, now() - interval '9 minutes'
FROM (VALUES
  ('b1000000-0000-0000-0000-000000000005'::uuid, 1120.0, 8.8, 1, 7,  72.00, 87.0),
  ('b1000000-0000-0000-0000-000000000008'::uuid,  980.0, 7.7, 2, 7,  58.50, 83.0),
  ('b1000000-0000-0000-0000-000000000011'::uuid,  840.0, 6.6, 3, 6,  44.00, 79.0),
  ('b1000000-0000-0000-0000-000000000014'::uuid,  700.0, 5.5, 4, 6,  29.50, 74.0),
  ('b1000000-0000-0000-0000-000000000017'::uuid,  560.0, 4.4, 5, 5,  14.75, 68.0),
  ('b1000000-0000-0000-0000-000000000018'::uuid,  420.0, 3.3, 6, 5,  -0.25, 62.0),
  ('b1000000-0000-0000-0000-000000000020'::uuid,  280.0, 2.2, 7, 5, -15.50, 56.0),
  ('9ee66c2d-bebb-4423-820e-68eb24fc3590'::uuid,  620.0, 4.9, 5, 6,  22.00, 70.0),
  ('d270b474-6021-41ce-ae76-ca37054b6b6e'::uuid,  500.0, 3.9, 6, 5,   8.75, 64.0),
  ('e1aa484b-8817-4421-a1d4-f4a3768b9658'::uuid,  360.0, 2.8, 7, 5,  -6.00, 58.0),
  ('e06710b9-bec2-4aa3-a8aa-239de131c0c6'::uuid,  220.0, 1.7, 8, 4, -20.75, 51.0),
  ('94d940ff-7aea-4da1-bb2d-a55014076d48'::uuid,   80.0, 0.6, 9, 4, -35.50, 45.0)
) AS t(uid, sc, ns, rk, tr, pn, bs)
ON CONFLICT (instance_id, user_id) DO NOTHING;

-- ============================================================
-- 6. UPDATE arena_users stats from aggregated scores
-- ============================================================

UPDATE arena_users SET
  total_games = 8, total_wins = 5, arena_rating = 4250
WHERE id = 'b1000000-0000-0000-0000-000000000001';

UPDATE arena_users SET
  total_games = 7, total_wins = 5, arena_rating = 3980
WHERE id = 'b1000000-0000-0000-0000-000000000002';

UPDATE arena_users SET
  total_games = 7, total_wins = 5, arena_rating = 3720
WHERE id = 'b1000000-0000-0000-0000-000000000003';

UPDATE arena_users SET
  total_games = 6, total_wins = 4, arena_rating = 3510
WHERE id = 'b1000000-0000-0000-0000-000000000004';

UPDATE arena_users SET
  total_games = 7, total_wins = 5, arena_rating = 3290
WHERE id = 'b1000000-0000-0000-0000-000000000005';

UPDATE arena_users SET
  total_games = 6, total_wins = 4, arena_rating = 3100
WHERE id = 'b1000000-0000-0000-0000-000000000006';

UPDATE arena_users SET
  total_games = 5, total_wins = 3, arena_rating = 2870
WHERE id = 'b1000000-0000-0000-0000-000000000007';

UPDATE arena_users SET
  total_games = 5, total_wins = 4, arena_rating = 2650
WHERE id = 'b1000000-0000-0000-0000-000000000008';

UPDATE arena_users SET
  total_games = 4, total_wins = 2, arena_rating = 2450
WHERE id = 'b1000000-0000-0000-0000-000000000009';

UPDATE arena_users SET
  total_games = 4, total_wins = 2, arena_rating = 2200
WHERE id = 'b1000000-0000-0000-0000-000000000010';

UPDATE arena_users SET
  total_games = 5, total_wins = 3, arena_rating = 2050
WHERE id = 'b1000000-0000-0000-0000-000000000011';

UPDATE arena_users SET
  total_games = 3, total_wins = 2, arena_rating = 1900
WHERE id = 'b1000000-0000-0000-0000-000000000012';

UPDATE arena_users SET
  total_games = 4, total_wins = 2, arena_rating = 1750
WHERE id = 'b1000000-0000-0000-0000-000000000013';

UPDATE arena_users SET
  total_games = 3, total_wins = 1, arena_rating = 1600
WHERE id = 'b1000000-0000-0000-0000-000000000014';

UPDATE arena_users SET
  total_games = 4, total_wins = 1, arena_rating = 1450
WHERE id = 'b1000000-0000-0000-0000-000000000015';

UPDATE arena_users SET
  total_games = 3, total_wins = 1, arena_rating = 1300
WHERE id = 'b1000000-0000-0000-0000-000000000016';

UPDATE arena_users SET
  total_games = 3, total_wins = 1, arena_rating = 1150
WHERE id = 'b1000000-0000-0000-0000-000000000017';

UPDATE arena_users SET
  total_games = 4, total_wins = 1, arena_rating = 1000
WHERE id = 'b1000000-0000-0000-0000-000000000018';

UPDATE arena_users SET
  total_games = 3, total_wins = 0, arena_rating = 890
WHERE id = 'b1000000-0000-0000-0000-000000000019';

UPDATE arena_users SET
  total_games = 5, total_wins = 0, arena_rating = 780
WHERE id = 'b1000000-0000-0000-0000-000000000020';

-- ============================================================
-- 7. CONVERSION EVENTS (40+ rows, last 30 days)
-- ============================================================

INSERT INTO conversion_events (user_id, partner_id, template_id, instance_id, event_type, percentile_at_trigger, created_at) VALUES
  ('b1000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001','c1000000-0000-0000-0000-000000000001','d1000000-0000-0000-0000-000000000008','signup_click',  95.0, now()-interval '2 days'-interval '6 minutes'),
  ('b1000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001','c1000000-0000-0000-0000-000000000001','d1000000-0000-0000-0000-000000000008','redirect',      95.0, now()-interval '2 days'-interval '5 minutes'),
  ('b1000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001','c1000000-0000-0000-0000-000000000001','d1000000-0000-0000-0000-000000000008','registration',  95.0, now()-interval '2 days'-interval '3 minutes'),
  ('b1000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001','c1000000-0000-0000-0000-000000000001','d1000000-0000-0000-0000-000000000008','first_trade',   95.0, now()-interval '2 days'-interval '1 minute'),

  ('b1000000-0000-0000-0000-000000000003','a1000000-0000-0000-0000-000000000001','c1000000-0000-0000-0000-000000000001','d1000000-0000-0000-0000-000000000008','signup_click',  77.3, now()-interval '2 days'-interval '14 minutes'),
  ('b1000000-0000-0000-0000-000000000003','a1000000-0000-0000-0000-000000000001','c1000000-0000-0000-0000-000000000001','d1000000-0000-0000-0000-000000000008','redirect',      77.3, now()-interval '2 days'-interval '12 minutes'),
  ('b1000000-0000-0000-0000-000000000003','a1000000-0000-0000-0000-000000000001','c1000000-0000-0000-0000-000000000001','d1000000-0000-0000-0000-000000000008','registration',  77.3, now()-interval '2 days'-interval '8 minutes'),

  ('b1000000-0000-0000-0000-000000000002','a1000000-0000-0000-0000-000000000002','c1000000-0000-0000-0000-000000000002','d1000000-0000-0000-0000-000000000010','signup_click',  84.0, now()-interval '4 days'-interval '18 minutes'),
  ('b1000000-0000-0000-0000-000000000002','a1000000-0000-0000-0000-000000000002','c1000000-0000-0000-0000-000000000002','d1000000-0000-0000-0000-000000000010','redirect',      84.0, now()-interval '4 days'-interval '15 minutes'),
  ('b1000000-0000-0000-0000-000000000002','a1000000-0000-0000-0000-000000000002','c1000000-0000-0000-0000-000000000002','d1000000-0000-0000-0000-000000000010','registration',  84.0, now()-interval '4 days'-interval '11 minutes'),
  ('b1000000-0000-0000-0000-000000000002','a1000000-0000-0000-0000-000000000002','c1000000-0000-0000-0000-000000000002','d1000000-0000-0000-0000-000000000010','first_trade',   84.0, now()-interval '4 days'-interval '7 minutes'),

  ('b1000000-0000-0000-0000-000000000005','a1000000-0000-0000-0000-000000000002','c1000000-0000-0000-0000-000000000002','d1000000-0000-0000-0000-000000000012','signup_click',  95.8, now()-interval '6 days'-interval '16 minutes'),
  ('b1000000-0000-0000-0000-000000000005','a1000000-0000-0000-0000-000000000002','c1000000-0000-0000-0000-000000000002','d1000000-0000-0000-0000-000000000012','redirect',      95.8, now()-interval '6 days'-interval '14 minutes'),
  ('b1000000-0000-0000-0000-000000000005','a1000000-0000-0000-0000-000000000002','c1000000-0000-0000-0000-000000000002','d1000000-0000-0000-0000-000000000012','registration',  95.8, now()-interval '6 days'-interval '10 minutes'),
  ('b1000000-0000-0000-0000-000000000005','a1000000-0000-0000-0000-000000000002','c1000000-0000-0000-0000-000000000002','d1000000-0000-0000-0000-000000000012','first_trade',   95.8, now()-interval '6 days'-interval '5 minutes'),

  ('b1000000-0000-0000-0000-000000000004','a1000000-0000-0000-0000-000000000003','c1000000-0000-0000-0000-000000000004','d1000000-0000-0000-0000-000000000011','signup_click',  95.0, now()-interval '5 days'-interval '17 minutes'),
  ('b1000000-0000-0000-0000-000000000004','a1000000-0000-0000-0000-000000000003','c1000000-0000-0000-0000-000000000004','d1000000-0000-0000-0000-000000000011','redirect',      95.0, now()-interval '5 days'-interval '13 minutes'),
  ('b1000000-0000-0000-0000-000000000004','a1000000-0000-0000-0000-000000000003','c1000000-0000-0000-0000-000000000004','d1000000-0000-0000-0000-000000000011','first_trade',   95.0, now()-interval '5 days'-interval '7 minutes'),

  ('b1000000-0000-0000-0000-000000000007','a1000000-0000-0000-0000-000000000003','c1000000-0000-0000-0000-000000000005','d1000000-0000-0000-0000-000000000014','signup_click',  96.2, now()-interval '9 days'-interval '16 minutes'),
  ('b1000000-0000-0000-0000-000000000007','a1000000-0000-0000-0000-000000000003','c1000000-0000-0000-0000-000000000005','d1000000-0000-0000-0000-000000000014','redirect',      96.2, now()-interval '9 days'-interval '12 minutes'),
  ('b1000000-0000-0000-0000-000000000007','a1000000-0000-0000-0000-000000000003','c1000000-0000-0000-0000-000000000005','d1000000-0000-0000-0000-000000000014','registration',  96.2, now()-interval '9 days'-interval '8 minutes'),
  ('b1000000-0000-0000-0000-000000000007','a1000000-0000-0000-0000-000000000003','c1000000-0000-0000-0000-000000000005','d1000000-0000-0000-0000-000000000014','first_trade',   96.2, now()-interval '9 days'-interval '3 minutes'),

  ('b1000000-0000-0000-0000-000000000008','a1000000-0000-0000-0000-000000000001','c1000000-0000-0000-0000-000000000008','d1000000-0000-0000-0000-000000000015','signup_click',  96.4, now()-interval '11 days'-interval '12 minutes'),
  ('b1000000-0000-0000-0000-000000000008','a1000000-0000-0000-0000-000000000001','c1000000-0000-0000-0000-000000000008','d1000000-0000-0000-0000-000000000015','redirect',      96.4, now()-interval '11 days'-interval '9 minutes'),
  ('b1000000-0000-0000-0000-000000000008','a1000000-0000-0000-0000-000000000001','c1000000-0000-0000-0000-000000000008','d1000000-0000-0000-0000-000000000015','registration',  96.4, now()-interval '11 days'-interval '6 minutes'),
  ('b1000000-0000-0000-0000-000000000008','a1000000-0000-0000-0000-000000000001','c1000000-0000-0000-0000-000000000008','d1000000-0000-0000-0000-000000000015','first_trade',   96.4, now()-interval '11 days'-interval '2 minutes'),

  ('b1000000-0000-0000-0000-000000000009','a1000000-0000-0000-0000-000000000002','c1000000-0000-0000-0000-000000000003','d1000000-0000-0000-0000-000000000009','signup_click',  58.0, now()-interval '3 days'-interval '12 minutes'),
  ('b1000000-0000-0000-0000-000000000009','a1000000-0000-0000-0000-000000000002','c1000000-0000-0000-0000-000000000003','d1000000-0000-0000-0000-000000000009','redirect',      58.0, now()-interval '3 days'-interval '9 minutes'),

  ('b1000000-0000-0000-0000-000000000010','a1000000-0000-0000-0000-000000000001','c1000000-0000-0000-0000-000000000001','d1000000-0000-0000-0000-000000000008','signup_click',  13.6, now()-interval '2 days'-interval '8 minutes'),

  ('b1000000-0000-0000-0000-000000000011','a1000000-0000-0000-0000-000000000002','c1000000-0000-0000-0000-000000000002','d1000000-0000-0000-0000-000000000009','signup_click',  46.0, now()-interval '3 days'-interval '10 minutes'),
  ('b1000000-0000-0000-0000-000000000011','a1000000-0000-0000-0000-000000000002','c1000000-0000-0000-0000-000000000002','d1000000-0000-0000-0000-000000000009','redirect',      46.0, now()-interval '3 days'-interval '7 minutes'),
  ('b1000000-0000-0000-0000-000000000011','a1000000-0000-0000-0000-000000000002','c1000000-0000-0000-0000-000000000002','d1000000-0000-0000-0000-000000000009','registration',  46.0, now()-interval '3 days'-interval '3 minutes'),

  ('b1000000-0000-0000-0000-000000000012','a1000000-0000-0000-0000-000000000003','c1000000-0000-0000-0000-000000000006','d1000000-0000-0000-0000-000000000013','signup_click',  51.0, now()-interval '7 days'-interval '22 minutes'),
  ('b1000000-0000-0000-0000-000000000012','a1000000-0000-0000-0000-000000000003','c1000000-0000-0000-0000-000000000006','d1000000-0000-0000-0000-000000000013','redirect',      51.0, now()-interval '7 days'-interval '19 minutes'),

  ('b1000000-0000-0000-0000-000000000013','a1000000-0000-0000-0000-000000000001','c1000000-0000-0000-0000-000000000008','d1000000-0000-0000-0000-000000000015','signup_click',  53.6, now()-interval '11 days'-interval '11 minutes'),
  ('b1000000-0000-0000-0000-000000000013','a1000000-0000-0000-0000-000000000001','c1000000-0000-0000-0000-000000000008','d1000000-0000-0000-0000-000000000015','redirect',      53.6, now()-interval '11 days'-interval '8 minutes'),
  ('b1000000-0000-0000-0000-000000000013','a1000000-0000-0000-0000-000000000001','c1000000-0000-0000-0000-000000000008','d1000000-0000-0000-0000-000000000015','registration',  53.6, now()-interval '11 days'-interval '4 minutes'),

  ('b1000000-0000-0000-0000-000000000014','a1000000-0000-0000-0000-000000000003','c1000000-0000-0000-0000-000000000004','d1000000-0000-0000-0000-000000000011','signup_click',  65.0, now()-interval '5 days'-interval '16 minutes'),
  ('b1000000-0000-0000-0000-000000000015','a1000000-0000-0000-0000-000000000002','c1000000-0000-0000-0000-000000000007','d1000000-0000-0000-0000-000000000012','signup_click',  45.8, now()-interval '6 days'-interval '14 minutes'),
  ('b1000000-0000-0000-0000-000000000016','a1000000-0000-0000-0000-000000000001','c1000000-0000-0000-0000-000000000001','d1000000-0000-0000-0000-000000000014','signup_click',  50.0, now()-interval '9 days'-interval '14 minutes'),
  ('b1000000-0000-0000-0000-000000000017','a1000000-0000-0000-0000-000000000003','c1000000-0000-0000-0000-000000000005','d1000000-0000-0000-0000-000000000012','signup_click',  12.5, now()-interval '6 days'-interval '12 minutes'),
  ('b1000000-0000-0000-0000-000000000018','a1000000-0000-0000-0000-000000000002','c1000000-0000-0000-0000-000000000003','d1000000-0000-0000-0000-000000000009','signup_click',  10.0, now()-interval '3 days'-interval '11 minutes'),
  ('b1000000-0000-0000-0000-000000000019','a1000000-0000-0000-0000-000000000001','c1000000-0000-0000-0000-000000000008','d1000000-0000-0000-0000-000000000015','signup_click',  10.7, now()-interval '11 days'-interval '10 minutes'),
  ('b1000000-0000-0000-0000-000000000020','a1000000-0000-0000-0000-000000000003','c1000000-0000-0000-0000-000000000004','d1000000-0000-0000-0000-000000000011','signup_click',   5.0, now()-interval '5 days'-interval '15 minutes');

-- ============================================================
-- 8. PARTNER REFERRAL CLICKS (60+ rows, 5 sources)
-- ============================================================

INSERT INTO partner_referral_clicks (partner_id, template_id, instance_id, user_id, source, created_at) VALUES
  -- TradersHub_KL clicks (whatsapp-heavy)
  ('a1000000-0000-0000-0000-000000000001','c1000000-0000-0000-0000-000000000001','d1000000-0000-0000-0000-000000000008','b1000000-0000-0000-0000-000000000001','whatsapp', now()-interval '2 days'-interval '20 minutes'),
  ('a1000000-0000-0000-0000-000000000001','c1000000-0000-0000-0000-000000000001','d1000000-0000-0000-0000-000000000008','b1000000-0000-0000-0000-000000000003','whatsapp', now()-interval '2 days'-interval '18 minutes'),
  ('a1000000-0000-0000-0000-000000000001','c1000000-0000-0000-0000-000000000001','d1000000-0000-0000-0000-000000000008','b1000000-0000-0000-0000-000000000010','whatsapp', now()-interval '2 days'-interval '15 minutes'),
  ('a1000000-0000-0000-0000-000000000001','c1000000-0000-0000-0000-000000000001','d1000000-0000-0000-0000-000000000014','b1000000-0000-0000-0000-000000000016','whatsapp', now()-interval '9 days'-interval '18 minutes'),
  ('a1000000-0000-0000-0000-000000000001','c1000000-0000-0000-0000-000000000001','d1000000-0000-0000-0000-000000000014','b1000000-0000-0000-0000-000000000019','whatsapp', now()-interval '9 days'-interval '16 minutes'),
  ('a1000000-0000-0000-0000-000000000001','c1000000-0000-0000-0000-000000000001',NULL,NULL,'whatsapp', now()-interval '12 days'-interval '5 hours'),
  ('a1000000-0000-0000-0000-000000000001','c1000000-0000-0000-0000-000000000001',NULL,NULL,'whatsapp', now()-interval '14 days'-interval '3 hours'),
  ('a1000000-0000-0000-0000-000000000001','c1000000-0000-0000-0000-000000000001',NULL,NULL,'whatsapp', now()-interval '16 days'-interval '2 hours'),
  ('a1000000-0000-0000-0000-000000000001','c1000000-0000-0000-0000-000000000008','d1000000-0000-0000-0000-000000000015','b1000000-0000-0000-0000-000000000008','telegram', now()-interval '11 days'-interval '14 minutes'),
  ('a1000000-0000-0000-0000-000000000001','c1000000-0000-0000-0000-000000000008','d1000000-0000-0000-0000-000000000015','b1000000-0000-0000-0000-000000000013','telegram', now()-interval '11 days'-interval '13 minutes'),
  ('a1000000-0000-0000-0000-000000000001','c1000000-0000-0000-0000-000000000008',NULL,NULL,'telegram', now()-interval '13 days'-interval '4 hours'),
  ('a1000000-0000-0000-0000-000000000001','c1000000-0000-0000-0000-000000000008',NULL,NULL,'telegram', now()-interval '15 days'-interval '2 hours'),
  ('a1000000-0000-0000-0000-000000000001','c1000000-0000-0000-0000-000000000001',NULL,NULL,'copy',     now()-interval '3 days'-interval '6 hours'),
  ('a1000000-0000-0000-0000-000000000001','c1000000-0000-0000-0000-000000000001',NULL,NULL,'copy',     now()-interval '5 days'-interval '4 hours'),
  ('a1000000-0000-0000-0000-000000000001','c1000000-0000-0000-0000-000000000001',NULL,NULL,'twitter',  now()-interval '7 days'-interval '3 hours'),
  ('a1000000-0000-0000-0000-000000000001','c1000000-0000-0000-0000-000000000008',NULL,NULL,'direct',   now()-interval '4 days'-interval '5 hours'),
  ('a1000000-0000-0000-0000-000000000001','c1000000-0000-0000-0000-000000000008',NULL,NULL,'direct',   now()-interval '6 days'-interval '3 hours'),
  ('a1000000-0000-0000-0000-000000000001','c1000000-0000-0000-0000-000000000008',NULL,NULL,'direct',   now()-interval '8 days'-interval '2 hours'),

  -- DerivPro_SG clicks (telegram-heavy)
  ('a1000000-0000-0000-0000-000000000002','c1000000-0000-0000-0000-000000000002','d1000000-0000-0000-0000-000000000010','b1000000-0000-0000-0000-000000000002','telegram', now()-interval '4 days'-interval '20 minutes'),
  ('a1000000-0000-0000-0000-000000000002','c1000000-0000-0000-0000-000000000002','d1000000-0000-0000-0000-000000000012','b1000000-0000-0000-0000-000000000005','telegram', now()-interval '6 days'-interval '18 minutes'),
  ('a1000000-0000-0000-0000-000000000002','c1000000-0000-0000-0000-000000000002','d1000000-0000-0000-0000-000000000009','b1000000-0000-0000-0000-000000000009','telegram', now()-interval '3 days'-interval '14 minutes'),
  ('a1000000-0000-0000-0000-000000000002','c1000000-0000-0000-0000-000000000002','d1000000-0000-0000-0000-000000000009','b1000000-0000-0000-0000-000000000011','telegram', now()-interval '3 days'-interval '12 minutes'),
  ('a1000000-0000-0000-0000-000000000002','c1000000-0000-0000-0000-000000000002','d1000000-0000-0000-0000-000000000009','b1000000-0000-0000-0000-000000000018','telegram', now()-interval '3 days'-interval '11 minutes'),
  ('a1000000-0000-0000-0000-000000000002','c1000000-0000-0000-0000-000000000002',NULL,NULL,'telegram', now()-interval '10 days'-interval '3 hours'),
  ('a1000000-0000-0000-0000-000000000002','c1000000-0000-0000-0000-000000000002',NULL,NULL,'telegram', now()-interval '12 days'-interval '4 hours'),
  ('a1000000-0000-0000-0000-000000000002','c1000000-0000-0000-0000-000000000007','d1000000-0000-0000-0000-000000000012','b1000000-0000-0000-0000-000000000015','whatsapp', now()-interval '6 days'-interval '16 minutes'),
  ('a1000000-0000-0000-0000-000000000002','c1000000-0000-0000-0000-000000000007',NULL,NULL,'whatsapp', now()-interval '8 days'-interval '5 hours'),
  ('a1000000-0000-0000-0000-000000000002','c1000000-0000-0000-0000-000000000003',NULL,NULL,'copy',     now()-interval '5 days'-interval '7 hours'),
  ('a1000000-0000-0000-0000-000000000002','c1000000-0000-0000-0000-000000000003',NULL,NULL,'copy',     now()-interval '7 days'-interval '6 hours'),
  ('a1000000-0000-0000-0000-000000000002','c1000000-0000-0000-0000-000000000003',NULL,NULL,'twitter',  now()-interval '9 days'-interval '4 hours'),
  ('a1000000-0000-0000-0000-000000000002','c1000000-0000-0000-0000-000000000007',NULL,NULL,'direct',   now()-interval '11 days'-interval '3 hours'),
  ('a1000000-0000-0000-0000-000000000002','c1000000-0000-0000-0000-000000000007',NULL,NULL,'direct',   now()-interval '13 days'-interval '2 hours'),
  ('a1000000-0000-0000-0000-000000000002','c1000000-0000-0000-0000-000000000007',NULL,NULL,'direct',   now()-interval '15 days'-interval '1 hour'),

  -- AlphaEdge_Dubai clicks (twitter/copy-heavy)
  ('a1000000-0000-0000-0000-000000000003','c1000000-0000-0000-0000-000000000004','d1000000-0000-0000-0000-000000000011','b1000000-0000-0000-0000-000000000004','twitter',  now()-interval '5 days'-interval '19 minutes'),
  ('a1000000-0000-0000-0000-000000000003','c1000000-0000-0000-0000-000000000004','d1000000-0000-0000-0000-000000000011','b1000000-0000-0000-0000-000000000014','twitter',  now()-interval '5 days'-interval '17 minutes'),
  ('a1000000-0000-0000-0000-000000000003','c1000000-0000-0000-0000-000000000004','d1000000-0000-0000-0000-000000000011','b1000000-0000-0000-0000-000000000020','twitter',  now()-interval '5 days'-interval '15 minutes'),
  ('a1000000-0000-0000-0000-000000000003','c1000000-0000-0000-0000-000000000005','d1000000-0000-0000-0000-000000000014','b1000000-0000-0000-0000-000000000007','copy',     now()-interval '9 days'-interval '18 minutes'),
  ('a1000000-0000-0000-0000-000000000003','c1000000-0000-0000-0000-000000000005','d1000000-0000-0000-0000-000000000014','b1000000-0000-0000-0000-000000000017','copy',     now()-interval '9 days'-interval '14 minutes'),
  ('a1000000-0000-0000-0000-000000000003','c1000000-0000-0000-0000-000000000006','d1000000-0000-0000-0000-000000000013','b1000000-0000-0000-0000-000000000012','whatsapp', now()-interval '7 days'-interval '24 minutes'),
  ('a1000000-0000-0000-0000-000000000003','c1000000-0000-0000-0000-000000000004',NULL,NULL,'twitter',  now()-interval '11 days'-interval '5 hours'),
  ('a1000000-0000-0000-0000-000000000003','c1000000-0000-0000-0000-000000000004',NULL,NULL,'twitter',  now()-interval '13 days'-interval '4 hours'),
  ('a1000000-0000-0000-0000-000000000003','c1000000-0000-0000-0000-000000000004',NULL,NULL,'twitter',  now()-interval '15 days'-interval '3 hours'),
  ('a1000000-0000-0000-0000-000000000003','c1000000-0000-0000-0000-000000000005',NULL,NULL,'copy',     now()-interval '12 days'-interval '6 hours'),
  ('a1000000-0000-0000-0000-000000000003','c1000000-0000-0000-0000-000000000005',NULL,NULL,'copy',     now()-interval '14 days'-interval '5 hours'),
  ('a1000000-0000-0000-0000-000000000003','c1000000-0000-0000-0000-000000000006',NULL,NULL,'telegram', now()-interval '10 days'-interval '4 hours'),
  ('a1000000-0000-0000-0000-000000000003','c1000000-0000-0000-0000-000000000006',NULL,NULL,'direct',   now()-interval '8 days'-interval '3 hours');

-- ============================================================
-- 9. COMPETITIONS + PARTICIPANTS + STATS (Go backend data)
-- ============================================================

INSERT INTO competitions (id, name, partner_id, partner_name, app_id, duration_hours, contract_types, starting_balance, status, start_time, end_time, share_url, created_at, updated_at) VALUES
  ('e1000000-0000-0000-0000-000000000001',
   'Grand Prix April 2026', 'a1000000-0000-0000-0000-000000000001', 'TradersHub_KL', '330uIJXdDsgj2qAaqLDZT',
   24, ARRAY['CALL','PUT'], 10000.00, 'active',
   now() - interval '8 hours', now() + interval '16 hours',
   'https://frontend-preethi-3498s-projects.vercel.app/join/e1000000-0000-0000-0000-000000000001',
   now() - interval '9 hours', now()),

  ('e1000000-0000-0000-0000-000000000002',
   'Weekend Warriors Cup', 'a1000000-0000-0000-0000-000000000002', 'DerivPro_SG', '330uIJXdDsgj2qAaqLDZT',
   12, ARRAY['CALL','PUT'], 5000.00, 'ended',
   now() - interval '3 days', now() - interval '2 days' - interval '12 hours',
   'https://frontend-preethi-3498s-projects.vercel.app/join/e1000000-0000-0000-0000-000000000002',
   now() - interval '3 days' - interval '2 hours', now() - interval '2 days' - interval '12 hours'),

  ('e1000000-0000-0000-0000-000000000003',
   'Dubai Traders Invitational', 'a1000000-0000-0000-0000-000000000003', 'AlphaEdge_Dubai', '330uIJXdDsgj2qAaqLDZT',
   48, ARRAY['CALL','PUT'], 10000.00, 'pending',
   now() + interval '2 days', now() + interval '4 days',
   'https://frontend-preethi-3498s-projects.vercel.app/join/e1000000-0000-0000-0000-000000000003',
   now() - interval '1 hour', now())
ON CONFLICT DO NOTHING;

-- Participants for active competition
INSERT INTO participants (id, competition_id, trader_id, trader_name, deriv_account_id, joined_at) VALUES
  ('f1000000-0000-0000-0000-000000000001','e1000000-0000-0000-0000-000000000001','P_SHADOW_088',  'ShadowTrader_88', 'P_SHADOW_088',  now()-interval '7 hours'),
  ('f1000000-0000-0000-0000-000000000002','e1000000-0000-0000-0000-000000000001','P_NIGHT_042',   'NightOwl_FX',     'P_NIGHT_042',   now()-interval '7 hours'),
  ('f1000000-0000-0000-0000-000000000003','e1000000-0000-0000-0000-000000000001','P_RISING_007',  'RisingSun_42',    'P_RISING_007',  now()-interval '6 hours'),
  ('f1000000-0000-0000-0000-000000000004','e1000000-0000-0000-0000-000000000001','P_VIPER_X99',   'ViperX_99',       'P_VIPER_X99',   now()-interval '6 hours'),
  ('f1000000-0000-0000-0000-000000000005','e1000000-0000-0000-0000-000000000001','P_ALPHA_011',   'AlphaWolf_11',    'P_ALPHA_011',   now()-interval '5 hours'),
  ('f1000000-0000-0000-0000-000000000006','e1000000-0000-0000-0000-000000000001','P_STEEL_055',   'SteelMind_55',    'P_STEEL_055',   now()-interval '5 hours'),
  ('f1000000-0000-0000-0000-000000000007','e1000000-0000-0000-0000-000000000001','P_CRPTN_77',    'CryptonZero',     'P_CRPTN_77',    now()-interval '4 hours'),
  ('f1000000-0000-0000-0000-000000000008','e1000000-0000-0000-0000-000000000001','DEMO_P1',       'Demo Player',     'DEMO_P1',       now()-interval '4 hours')
ON CONFLICT DO NOTHING;

-- Stats for active competition participants
INSERT INTO competition_stats (participant_id, total_trades, profitable_trades, total_pnl, sortino_ratio, max_drawdown, current_balance, last_updated) VALUES
  ('f1000000-0000-0000-0000-000000000001', 22, 15, 1842.50, 2.14, 0.08, 11842.50, now()-interval '10 minutes'),
  ('f1000000-0000-0000-0000-000000000002', 20, 13, 1650.00, 1.98, 0.09, 11650.00, now()-interval '12 minutes'),
  ('f1000000-0000-0000-0000-000000000003', 18, 12, 1420.75, 1.81, 0.10, 11420.75, now()-interval '15 minutes'),
  ('f1000000-0000-0000-0000-000000000004', 17, 11, 1185.50, 1.62, 0.12, 11185.50, now()-interval '18 minutes'),
  ('f1000000-0000-0000-0000-000000000005', 16, 10,  940.00, 1.43, 0.13, 10940.00, now()-interval '20 minutes'),
  ('f1000000-0000-0000-0000-000000000006', 15,  9,  682.25, 1.24, 0.15, 10682.25, now()-interval '22 minutes'),
  ('f1000000-0000-0000-0000-000000000007', 14,  8,  415.50, 1.05, 0.17, 10415.50, now()-interval '25 minutes'),
  ('f1000000-0000-0000-0000-000000000008', 13,  7,  148.00, 0.86, 0.19, 10148.00, now()-interval '28 minutes')
ON CONFLICT DO NOTHING;

-- Participants for ended competition
INSERT INTO participants (id, competition_id, trader_id, trader_name, deriv_account_id, joined_at) VALUES
  ('f1000000-0000-0000-0000-000000000011','e1000000-0000-0000-0000-000000000002','P_BLAZE_22',   'BlazeRunner_22', 'P_BLAZE_22',   now()-interval '3 days'),
  ('f1000000-0000-0000-0000-000000000012','e1000000-0000-0000-0000-000000000002','P_STORM_64',   'StormBreaker64', 'P_STORM_64',   now()-interval '3 days'),
  ('f1000000-0000-0000-0000-000000000013','e1000000-0000-0000-0000-000000000002','P_PHNX_03',    'PhoenixRise_03', 'P_PHNX_03',    now()-interval '3 days'-interval '1 hour'),
  ('f1000000-0000-0000-0000-000000000014','e1000000-0000-0000-0000-000000000002','P_LUNAR_88',   'LunarTrader_88', 'P_LUNAR_88',   now()-interval '3 days'-interval '2 hours'),
  ('f1000000-0000-0000-0000-000000000015','e1000000-0000-0000-0000-000000000002','P_EDGE_44',    'EdgeSeeker_44',  'P_EDGE_44',    now()-interval '3 days'-interval '3 hours')
ON CONFLICT DO NOTHING;

INSERT INTO competition_stats (participant_id, total_trades, profitable_trades, total_pnl, sortino_ratio, max_drawdown, current_balance, last_updated) VALUES
  ('f1000000-0000-0000-0000-000000000011', 19, 13, 2105.00, 2.24, 0.07, 7105.00, now()-interval '2 days'-interval '12 hours'),
  ('f1000000-0000-0000-0000-000000000012', 17, 11, 1780.50, 2.01, 0.09, 6780.50, now()-interval '2 days'-interval '12 hours'),
  ('f1000000-0000-0000-0000-000000000013', 15, 10, 1420.25, 1.78, 0.11, 6420.25, now()-interval '2 days'-interval '12 hours'),
  ('f1000000-0000-0000-0000-000000000014', 14,  9, 1055.75, 1.55, 0.13, 6055.75, now()-interval '2 days'-interval '12 hours'),
  ('f1000000-0000-0000-0000-000000000015', 13,  8,  680.00, 1.31, 0.15, 5680.00, now()-interval '2 days'-interval '12 hours')
ON CONFLICT DO NOTHING;

COMMIT;
