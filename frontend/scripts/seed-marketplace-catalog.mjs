#!/usr/bin/env node
/**
 * Upsert the marketplace catalog rows the frontend expects.
 *
 * Usage:
 *   DATABASE_URL=... DATABASE_SSL_UNVERIFIED=1 node scripts/seed-marketplace-catalog.mjs
 */
'use strict';

import pg from 'pg';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ...(process.env.DATABASE_SSL_UNVERIFIED === '1'
    ? { ssl: { rejectUnauthorized: false } }
    : {}),
});

const items = [
  {
    id: 'copilot_starter',
    category: 'premium_feature',
    name: 'Trading Copilot — Starter',
    description:
      'Short taste of the Trading Copilot: 30 message credits, 3-day access window. Sized to fit the first-login welcome bonus so every new user can try it immediately.',
    miles_cost: 300,
    metadata: {
      feature: 'trading_copilot',
      message_credits: 30,
      duration_days: 3,
    },
    sort_order: 39,
  },
  {
    id: 'premium_trading_copilot',
    category: 'premium_feature',
    name: 'Trading Copilot',
    description:
      'Full Trading Copilot pass: 600 message credits, 30-day access window with Deriv-aware analysis and charts.',
    miles_cost: 1200,
    metadata: {
      feature: 'trading_copilot',
      message_credits: 600,
      duration_days: 30,
    },
    sort_order: 40,
  },
  {
    id: 'ai_chart_analyst_5',
    category: 'third_party_tool',
    name: 'AI Chart Analyst — 5 credits',
    description: 'Partner voucher for five AI-powered chart analysis credits.',
    miles_cost: 250,
    metadata: { partner_url: 'https://deriv.com' },
    sort_order: 41,
  },
  {
    id: 'ai_chart_analyst_20',
    category: 'third_party_tool',
    name: 'AI Chart Analyst — 20 credits',
    description:
      'Partner voucher for twenty AI-powered chart analysis credits.',
    miles_cost: 900,
    metadata: { partner_url: 'https://deriv.com' },
    sort_order: 42,
  },
  {
    id: 'pro_trading_signals',
    category: 'third_party_tool',
    name: 'Pro Trading Signals (7 days)',
    description:
      'Partner voucher for seven days of curated Forex, Crypto & Indices signals.',
    miles_cost: 500,
    metadata: { partner_url: 'https://deriv.com' },
    sort_order: 43,
  },
];

try {
  for (const it of items) {
    const res = await pool.query(
      `INSERT INTO deriv_miles_catalog (id, category, name, description, miles_cost, stock_quantity, available, metadata, sort_order)
       VALUES ($1, $2, $3, $4, $5, NULL, true, $6::jsonb, $7)
       ON CONFLICT (id) DO UPDATE SET
         miles_cost = EXCLUDED.miles_cost,
         description = EXCLUDED.description,
         metadata = EXCLUDED.metadata
       RETURNING id, miles_cost, name`,
      [
        it.id,
        it.category,
        it.name,
        it.description,
        it.miles_cost,
        JSON.stringify(it.metadata),
        it.sort_order,
      ],
    );
    console.log(JSON.stringify(res.rows[0]));
  }
} finally {
  await pool.end();
}
