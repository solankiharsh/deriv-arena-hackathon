-- Optional host-published limits and signal weights (JSON). Validated in Go on create + trade.
ALTER TABLE competitions
ADD COLUMN IF NOT EXISTS partner_rules JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN competitions.partner_rules IS 'PartnerRules JSON: max_stake_per_contract, max_loss_per_day, max_drawdown_percent, market_bias, data_source_weights';
