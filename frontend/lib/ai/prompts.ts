"use strict";

// Sanitize user-provided content before injecting into prompts
function sanitize(text: string): string {
  return text
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\{/g, "&#123;")
    .replace(/\}/g, "&#125;")
    .slice(0, 2000); // Hard cap
}

export function buildNarrativePrompt(sessionData: {
  trades: Array<{
    asset: string;
    direction: string;
    stake: number;
    pnl: number;
    tiltScoreAtEntry: number;
    wasRevengeFlag: boolean;
    heldToExpiry: boolean;
    premortemText?: string;
  }>;
  phantoms: Array<{
    asset: string;
    confidenceTier: string;
    finalPnl?: number;
    type: string;
  }>;
  tiltPeak: number;
  sessionPnl: number;
  phantomPnl: number;
  antiYouPnl: number;
}): string {
  const safeData = JSON.stringify(sessionData);
  return `You are a trading psychologist and behavioural analyst writing a session debrief in second person (using "you" and "your"). 
  
Be direct, empathetic, and clinically precise. Identify the pivotal moment that defined the session. Quantify every behavioural mistake in dollar terms. Celebrate good decisions specifically.

Keep the response to 3-5 paragraphs. Use real numbers from the data. Do not use generic advice.

<session_data>
${sanitize(safeData)}
</session_data>`;
}

export function buildCautionPrompt(context: {
  tiltScore: number;
  consecutiveLosses: number;
  lossAmountLast3: number;
  historicalPatternMessage: string;
  asset: string;
  proposedStake: number;
}): string {
  return `You are a real-time trading coach issuing an urgent, data-driven warning. Be direct and specific. Cite exact numbers. No generic advice. Maximum 100 words.

Tilt score: ${context.tiltScore}/100
Consecutive losses: ${context.consecutiveLosses}
Loss amount (last 3 trades): $${context.lossAmountLast3.toFixed(2)}
Historical pattern: <pattern>${sanitize(context.historicalPatternMessage)}</pattern>
Proposed: ${context.asset} at $${context.proposedStake} stake

Write a direct, specific caution.`;
}

export function buildRecommendationPrompt(weekData: {
  besScore: number;
  phantomEfficiency: number;
  exitIntelligence: number;
  tiltResistance: number;
  topLeak: string;
  antiYouDelta: number;
  revengeTradeCount: number;
  earlyExitCount: number;
}): string {
  return `You are a trading behavioural coach. Based on this week's data, provide exactly 3 specific behavioural changes — not trade signals — with expected dollar impact per change. Be concrete and measurable.

<weekly_data>
BES Score: ${weekData.besScore.toFixed(0)}/100
Phantom Efficiency: ${weekData.phantomEfficiency.toFixed(0)}%
Exit Intelligence: ${weekData.exitIntelligence.toFixed(0)}%
Tilt Resistance: ${weekData.tiltResistance.toFixed(0)}%
Primary leak: ${sanitize(weekData.topLeak)}
Anti-You differential: $${weekData.antiYouDelta.toFixed(2)}
Revenge trades: ${weekData.revengeTradeCount}
Early exits: ${weekData.earlyExitCount}
</weekly_data>

Format each recommendation as: [Change] → [Expected impact in dollars/percentage]`;
}

export function buildBullDebatePrompt(marketContext: {
  asset: string;
  recentPrices: number[];
  priceChange: number;
  volume?: string;
}): string {
  return `You are the BULL agent — an aggressive momentum trader. You look for breakouts, volume spikes, and trend-following opportunities. Respond in JSON only.

Analyze this market and give your trading stance:
<market_context>
Asset: ${marketContext.asset}
Recent prices (newest first): ${marketContext.recentPrices.slice(0, 10).join(", ")}
Price change: ${marketContext.priceChange > 0 ? "+" : ""}${marketContext.priceChange.toFixed(4)}
</market_context>

Respond with ONLY valid JSON: {"direction": "CALL" or "PUT", "confidence": 0-100, "reasoning": "one sentence max 20 words"}`;
}

export function buildBearDebatePrompt(marketContext: {
  asset: string;
  recentPrices: number[];
  priceChange: number;
}): string {
  return `You are the BEAR agent — a skeptical contrarian trader. You look for overextensions, divergences, and reversal patterns. Respond in JSON only.

Analyze this market and give your trading stance:
<market_context>
Asset: ${marketContext.asset}
Recent prices (newest first): ${marketContext.recentPrices.slice(0, 10).join(", ")}
Price change: ${marketContext.priceChange > 0 ? "+" : ""}${marketContext.priceChange.toFixed(4)}
</market_context>

Respond with ONLY valid JSON: {"direction": "CALL" or "PUT", "confidence": 0-100, "reasoning": "one sentence max 20 words"}`;
}

export function buildOwlDebatePrompt(marketContext: {
  asset: string;
  recentPrices: number[];
  priceChange: number;
  timeOfDay: string;
}): string {
  return `You are the OWL agent — a patient macro strategist. You consider session timing, correlation shifts, and market-wide context. Respond in JSON only.

Analyze this market and give your trading stance:
<market_context>
Asset: ${marketContext.asset}
Recent prices (newest first): ${marketContext.recentPrices.slice(0, 10).join(", ")}
Price change: ${marketContext.priceChange > 0 ? "+" : ""}${marketContext.priceChange.toFixed(4)}
Time of day: ${marketContext.timeOfDay}
</market_context>

Respond with ONLY valid JSON: {"direction": "CALL" or "PUT", "confidence": 0-100, "reasoning": "one sentence max 20 words"}`;
}

export function buildGameAnalyticsPrompt(
  context: {
    symbol: string;
    symbolDisplayName: string;
    recentPrices: number[];
    direction: string;
    stake: number;
    sessionPnl: number;
    sessionTrades: number;
    sessionWins: number;
    winStreak: number;
    lossStreak: number;
    activePosition?: {
      direction: string;
      stake: number;
      entrySpot: number;
      currentSpot: number;
      currentPnl: number;
    };
    gameScore: number;
    percentile: number;
    tradeHistory: Array<{
      asset: string;
      direction: string;
      stake: number;
      pnl: number;
      status: string;
    }>;
    gameMode: string;
    gameModeName: string;
    gameModeDescription: string;
    templateDescription: string;
  },
  question: string
): string {
  const priceSlice = context.recentPrices.slice(0, 20).join(", ");
  const winRate = context.sessionTrades > 0
    ? ((context.sessionWins / context.sessionTrades) * 100).toFixed(1)
    : "0.0";

  const positionBlock = context.activePosition
    ? `\nOpen position: ${context.activePosition.direction} at ${context.activePosition.entrySpot} → current ${context.activePosition.currentSpot} (P&L: $${context.activePosition.currentPnl.toFixed(2)}, stake: $${context.activePosition.stake})`
    : "\nNo open position.";

  const recentTrades = context.tradeHistory.slice(0, 10).map(
    (t, i) => `  ${i + 1}. ${t.asset} ${t.direction} $${t.stake} → $${(t.pnl ?? 0).toFixed(2)} (${t.status})`
  ).join("\n");

  return `You are a real-time game analytics coach for a competitive trading arena. Be concise, data-driven, and actionable. Always start your response with a context line in this exact format:

**${sanitize(context.symbolDisplayName)} | Session P&L: $${context.sessionPnl.toFixed(2)} | ${context.sessionTrades} trades**

Then answer the player's question using the data below. Cite specific numbers. Keep your response under 150 words.

<game_context>
Game mode: ${sanitize(context.gameModeName)} — ${sanitize(context.gameModeDescription)}
Game description: ${sanitize(context.templateDescription)}
Symbol: ${sanitize(context.symbol)} (${sanitize(context.symbolDisplayName)})
Selected direction: ${context.direction}
Stake: $${context.stake}
Recent prices (newest first): ${priceSlice}
Session P&L: $${context.sessionPnl.toFixed(2)}
Trades: ${context.sessionTrades} (wins: ${context.sessionWins}, win rate: ${winRate}%)
Win streak: ${context.winStreak} | Loss streak: ${context.lossStreak}
Game score: ${context.gameScore.toFixed(1)} | Percentile: top ${context.percentile.toFixed(0)}%${positionBlock}
Recent trades:
${recentTrades || "  None yet."}
</game_context>

<question>${sanitize(question)}</question>`;
}

export function buildAntiYouInsightPrompt(personality: {
  yourTradesPerDay: number;
  antiYouTradesPerDay: number;
  yourHoldDuration: number;
  antiYouHoldDuration: number;
  yourAfterLoss: string;
  antiYouAfterLoss: string;
  weeklyDelta: number;
}): string {
  return `You are a trading psychology analyst. In 2-3 sentences, explain what the Anti-You personality profile reveals about the trader's core behavioural pattern. Be specific and insightful, not generic.

<profile_comparison>
Your trades/day: ${personality.yourTradesPerDay}
Anti-You trades/day: ${personality.antiYouTradesPerDay}
Your avg hold: ${personality.yourHoldDuration}s
Anti-You avg hold: ${personality.antiYouHoldDuration}s
Your after-loss: ${sanitize(personality.yourAfterLoss)}
Anti-You after-loss: ${sanitize(personality.antiYouAfterLoss)}
Weekly P&L delta (you vs shadow): $${personality.weeklyDelta.toFixed(2)}
</profile_comparison>`;
}
