DELETE FROM deriv_miles_catalog WHERE id IN (
    'premium_trading_copilot',
    'ai_chart_analyst_5',
    'ai_chart_analyst_20',
    'pro_trading_signals'
);

DROP TABLE IF EXISTS deriv_trading_copilot_entitlements;
