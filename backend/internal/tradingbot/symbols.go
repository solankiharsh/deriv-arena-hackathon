package tradingbot

// TradingSymbols returns deduplicated symbol list: markets first, then assets, preserving order.
func TradingSymbols(cfg BotConfig) []string {
	seen := make(map[string]bool)
	out := make([]string, 0, len(cfg.MarketSelection)+len(cfg.AssetSelection))
	for _, s := range cfg.MarketSelection {
		if s == "" || seen[s] {
			continue
		}
		seen[s] = true
		out = append(out, s)
	}
	for _, s := range cfg.AssetSelection {
		if s == "" || seen[s] {
			continue
		}
		seen[s] = true
		out = append(out, s)
	}
	return out
}
