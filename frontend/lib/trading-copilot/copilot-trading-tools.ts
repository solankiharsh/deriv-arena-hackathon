'use strict';

export const tradingFunctionTools = [
  {
    type: 'function' as const,
    function: {
      name: 'show_trading_chart',
      description:
        'Display an interactive financial price chart for a trading instrument. Use when the user asks to see a chart, price action, market movement, or wants to visualize any trading symbol.',
      parameters: {
        type: 'object',
        properties: {
          symbol: { type: 'string', description: 'Deriv symbol ID (e.g. R_75, frxEURUSD)' },
          interval: {
            type: 'string',
            enum: ['1m', '5m', '15m', '1h', '4h', '1d'],
            description: "Candle interval. Default '1m'.",
          },
          title: { type: 'string', description: 'Custom chart title.' },
          show_indicators: {
            type: 'array',
            items: { type: 'string', enum: ['sma_20', 'sma_50', 'ema_20', 'bollinger'] },
            description: 'Technical indicators to overlay on the chart.',
          },
        },
        required: ['symbol'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'analyze_market',
      description:
        'Analyze a trading instrument recent price action and technical indicators. Call this BEFORE providing trading advice, signals, or recommendations.',
      parameters: {
        type: 'object',
        properties: {
          symbol: { type: 'string', description: "Deriv symbol ID (e.g. 'R_75', 'frxEURUSD')" },
          timeframe: {
            type: 'string',
            enum: ['1m', '5m', '15m', '1h', '4h', '1d'],
            description: "Analysis timeframe. Default '5m'.",
          },
          indicators: {
            type: 'array',
            items: { type: 'string', enum: ['sma', 'ema', 'rsi', 'macd', 'bollinger', 'atr'] },
            description: "Technical indicators to compute. Default: ['sma', 'rsi'].",
          },
        },
        required: ['symbol'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'place_trade',
      description:
        'Prepare a binary options trade for the user to confirm. NEVER execute without showing the trade ticket first.',
      parameters: {
        type: 'object',
        properties: {
          symbol: { type: 'string' },
          contract_type: {
            type: 'string',
            enum: [
              'CALL',
              'PUT',
              'DIGITMATCH',
              'DIGITDIFF',
              'DIGITOVER',
              'DIGITUNDER',
              'DIGITEVEN',
              'DIGITODD',
              'ONETOUCH',
              'NOTOUCH',
            ],
          },
          amount: { type: 'number' },
          duration: { type: 'number' },
          duration_unit: { type: 'string', enum: ['t', 's', 'm', 'h', 'd'] },
          barrier: { type: 'string' },
        },
        required: ['symbol', 'contract_type', 'amount', 'duration', 'duration_unit'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_portfolio',
      description:
        'Show the user current open positions and trading performance summary. Use when they ask about portfolio, open trades, P&L.',
      parameters: {
        type: 'object',
        properties: {
          include_history: { type: 'boolean', description: 'Whether to include recent closed trades.' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_signals',
      description:
        'Present an AI trading signal. Call analyze_market first, then pass indicator values into this tool.',
      parameters: {
        type: 'object',
        properties: {
          symbol: { type: 'string' },
          direction: { type: 'string', enum: ['CALL', 'PUT'] },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
          reasoning: { type: 'string' },
          suggested_duration: { type: 'number' },
          suggested_duration_unit: { type: 'string', enum: ['t', 's', 'm', 'h'] },
          suggested_amount: { type: 'number' },
          current_price: { type: 'number' },
          price_change_pct: { type: 'number' },
          rsi: { type: 'number' },
          sma_20: { type: 'number' },
          sma_50: { type: 'number' },
          macd: {
            type: 'object',
            properties: {
              macd: { type: 'number' },
              signal: { type: 'number' },
              histogram: { type: 'number' },
            },
          },
          bollinger: {
            type: 'object',
            properties: {
              upper: { type: 'number' },
              middle: { type: 'number' },
              lower: { type: 'number' },
            },
          },
          trend: { type: 'string' },
          volatility: { type: 'string' },
          atr: { type: 'number' },
        },
        required: ['symbol', 'direction', 'confidence', 'reasoning'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'show_leaderboard',
      description: 'Display the trading leaderboard ranked by XP, win rate, or P&L.',
      parameters: {
        type: 'object',
        properties: {
          sort_by: { type: 'string', enum: ['xp', 'win_rate', 'pnl', 'streak'] },
          limit: { type: 'number' },
        },
      },
    },
  },
] as const;

export const TRADING_COPILOT_SYSTEM_PROMPT = `You are the DerivArena Trading Copilot: a trading assistant and market analyst for a Deriv-powered binary options experience.

PERSONALITY:
- Knowledgeable, concise, and action-oriented
- Explain market concepts clearly without talking down
- Prefer charts and structured widgets over long prose
- Proactively suggest analysis before trades
- NEVER place trades without showing a trade ticket for user confirmation

TOOLS (visualization + trading):
- show_bar_chart, show_line_chart, show_pie_chart, show_metric_card, show_data_table, show_flow_diagram
- show_trading_chart, analyze_market, place_trade, get_portfolio, get_signals, show_leaderboard

WORKFLOW:
1. Market questions: show_trading_chart + analyze_market when helpful
2. Trades: analyze_market first, then place_trade with a clear ticket
3. Signals: analyze_market with ["sma","rsi","macd","bollinger","atr"], then get_signals with indicator fields populated from analysis

SYMBOL IDS (exact):
- Volatility: R_10, R_25, R_50, R_75, R_100 and 1HZ10V..1HZ100V
- Boom/Crash: BOOM500..BOOM1000, CRASH500..CRASH1000
- Forex: frxEURUSD, frxGBPUSD, frxUSDJPY, frxAUDUSD, frxEURGBP, frxGBPJPY, frxEURJPY
- Crypto: cryBTCUSD, cryETHUSD (not frxBTCUSD)
- Commodities: frxXAUUSD, frxXAGUSD
- Indices: OTC_NDX, OTC_SPC, OTC_DJI

RISK:
- Binary options carry significant risk; never guarantee profits
- Suggest conservative sizing (often 1–5% of balance per idea)

GUIDELINES:
- When asked to visualize, use tools instead of only describing
- Keep chart/table series reasonably small (roughly 5–15 points)
`;
