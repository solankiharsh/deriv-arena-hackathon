"use strict";

import type { GameMode } from "./arena-types";

export interface ButtonGuide {
  label: string;
  description: string;
}

export interface GameInstructions {
  overview: string;
  howToPlay: string[];
  howToWin: string;
  buttons: ButtonGuide[];
  scoringFormula: string;
  proTips: string[];
  uniqueMechanics: string[];
}

export const GAME_INSTRUCTIONS: Record<GameMode, GameInstructions> = {
  classic: {
    overview:
      "Classic Arena is a real-time simulated trading competition. Pick an asset, predict whether the price will rise or fall, place your stake, and compete for the highest score on the leaderboard.",
    howToPlay: [
      "Select an asset from the symbol picker at the top of the trading panel.",
      "Choose your direction: Rise (CALL) if you think the price will go up, or Fall (PUT) if you think it will drop.",
      "Set your stake ($5, $10, $25, or $50) and pick a contract duration (1m, 5m, 15m, or 1h).",
      "Hit the Buy Rise or Buy Fall button to open a simulated trade.",
      "Watch the live chart — your P&L updates in real time based on price movement.",
      "Use Sell Early to close your position before expiry if you want to lock in profit or cut losses.",
      "Earn power-up credits (+1 per trade) and spend them on Lag Spike, Flash Crash, or Time Warp for strategic advantages.",
    ],
    howToWin:
      "Maximize your composite score by the end of the timer. Score weights: P&L (40%), win rate (25%), chaos bonus (20%), and power-up efficiency (15%). Trading during Chaos Events (Breaking News ticker) earns bonus multipliers.",
    buttons: [
      { label: "Rise / Fall", description: "Choose your price direction prediction — Rise means you think the price goes up, Fall means down." },
      { label: "Buy Rise / Buy Fall", description: "Execute your simulated trade with the selected stake and duration." },
      { label: "Sell Early", description: "Close your active position before it expires. Use this to lock in profits or limit losses." },
      { label: "$5 / $10 / $25 / $50", description: "Stake amount for your trade — how much virtual money you're risking." },
      { label: "1m / 5m / 15m / 1h", description: "Contract duration — how long until your trade resolves automatically." },
      { label: "Power-ups (Lag Spike, Flash Crash, Time Warp)", description: "Spend earned credits on strategic abilities. Each has a cooldown after use." },
    ],
    scoringFormula: "Score = P&L × 0.4 + Win Rate × 25 + Chaos Bonus × 0.2 + Power-up Efficiency × 0.15",
    proTips: [
      "Trade during Chaos Events for score multipliers — the Breaking News ticker signals when chaos is active.",
      "Don't blow all your power-ups early. Use them strategically when the market is volatile.",
      "A high win rate matters more than a few big wins. Consistency compounds your score.",
    ],
    uniqueMechanics: [
      "Chaos Engine: Random market events appear as a Breaking News ticker, adding noise to the chart. Trades placed during chaos earn bonus score.",
      "Power-ups: Earn 1 credit per completed trade. Spend credits on Lag Spike (2cr), Flash Crash (3cr), or Time Warp (4cr).",
      "Tilt tracking: Your emotional state is monitored. Staying composed yields better behavioral scores.",
    ],
  },

  boxing_ring: {
    overview:
      "Boxing Ring is an intense knockout-style trading duel. Every trade is a punch — win trades to deal damage, build combos, and aim to knock out your opponent by hitting the 20% profit target ($2,000 on a $10,000 notional balance).",
    howToPlay: [
      "Select an asset and choose Rise or Fall for your price prediction.",
      "Set your stake using the input field or quick presets ($10, $25, $50) and pick a duration.",
      "Press Simulate Trade to throw a punch — each trade is an attack in the ring.",
      "Win consecutive trades to trigger Heat Mode (3+ win streak) for 1.5x stake multiplier.",
      "Watch the KO Progress bar — it fills as your session P&L approaches the $2,000 target.",
      "Use Sell Early on open positions to tactically manage your P&L.",
    ],
    howToWin:
      "Achieve a Knockout by reaching +$2,000 session P&L (20% of $10,000 notional). If no KO, the highest composite score wins. Score weights: P&L (30%), health differential (20%), combo bonus (15%), Heat Mode seconds (10%), knockout bonus (25%).",
    buttons: [
      { label: "Rise / Fall", description: "Your directional prediction — Rise for price going up, Fall for down." },
      { label: "Simulate Trade", description: "Execute your trade (throw a punch). Disabled after knockout." },
      { label: "Sell Early", description: "Exit your current position before expiry." },
      { label: "$10 / $25 / $50", description: "Quick stake presets. You can also type a custom amount (1-1000)." },
      { label: "1m / 5m / 15m / 1h", description: "How long your trade contract lasts before auto-resolving." },
    ],
    scoringFormula: "Score = P&L × 0.3 + Health Diff × 0.2 + Combo × 0.15 + Heat Seconds × 0.1 + KO Bonus × 0.25",
    proTips: [
      "Chase the Knockout — landing it gives a massive 500-point bonus that dwarfs other scoring factors.",
      "Build win streaks to activate Heat Mode (1.5x stakes). The compounding effect is huge.",
      "Loss streaks increase damage cracks on the ring. Take a breath and reset if things go south.",
    ],
    uniqueMechanics: [
      "Knockout: Reach +$2,000 session P&L to end the round immediately with a massive score bonus. Trading is disabled after KO.",
      "Heat Mode: 3+ consecutive wins activates 1.5x stake multiplier with orange ring effects.",
      "Damage System: Loss streaks cause visual cracks on the boxing ring, signaling your vulnerability.",
      "Combo Counter: Consecutive wins build combo multipliers for bonus scoring.",
    ],
  },

  anti_you: {
    overview:
      "Anti-You Duel pits you against an adaptive AI shadow trader that learns your patterns and bets against you. Your shadow evolves through 4 stages: it starts as a simple mirror and eventually becomes a full behavioral inverse that exploits your weaknesses.",
    howToPlay: [
      "Trade as you normally would — select asset, direction (Rise/Fall), stake, and duration.",
      "Press Trade to execute. The Anti-You shadow automatically counter-trades based on its current evolution stage.",
      "Use the Decoy button to submit a fake direction signal. This costs no money but may trick the shadow into repositioning.",
      "Watch the dual equity chart — your P&L vs Anti-You's P&L. Stay ahead to avoid Glitch effects.",
      "Monitor the Evolution stage indicator — as Anti-You learns, its strategies become more sophisticated.",
      "Use Sell Early to close positions if the shadow is gaining on you.",
    ],
    howToWin:
      "Beat the Anti-You on P&L differential and maximize your composite score. Score weights: (Your P&L - Anti-You P&L) × 0.4 + Decoy Efficiency × 0.2 + Glitch Survival × 0.2 + Behavioral Score × 0.2.",
    buttons: [
      { label: "Rise / Fall", description: "Your directional prediction. At Glitch Level 2+, the buttons may visually swap to disorient you." },
      { label: "Trade", description: "Execute your simulated trade. The shadow will counter-trade simultaneously." },
      { label: "Decoy", description: "Send a fake directional signal to the shadow without risking money. Limited to 2 per round, 10 per session." },
      { label: "Sell Early", description: "Close your active position before expiry." },
      { label: "$10 / $25 / $50", description: "Stake presets, or type a custom amount." },
      { label: "1m / 5m / 15m / 1h", description: "Contract duration for your trade." },
    ],
    scoringFormula: "Score = (Your P&L - AY P&L) × 0.4 + Decoy Efficiency × 0.2 + Glitch Survival × 0.2 + Behavioral × 0.2",
    proTips: [
      "Use Decoys strategically — a well-timed decoy before a real trade can flip the shadow's plan entirely.",
      "Early stages (Mirror/Pattern) are predictable. Exploit them before the shadow evolves to Behavioral or Full Inverse.",
      "If Anti-You is ahead, expect Glitch effects: UI hue-shift, inverted chart, and at Level 3, full screen corruption. Stay calm.",
    ],
    uniqueMechanics: [
      "Shadow Evolution: Mirror (trades 1-4) → Pattern Mirror (5-14) → Behavioral Mirror (15-29) → Full Inverse (30+). Each stage uses more sophisticated counter-strategies.",
      "Decoy System: Fake directional signals to manipulate the shadow. Limited uses per round and session.",
      "Glitch Levels (0-3): When Anti-You leads, UI distortion intensifies — hue shifts, inverted charts, button swaps, and full-screen corruption.",
      "Anti-You Confidence: A visible meter showing how confident the shadow is in its predictions against you.",
    ],
  },

  phantom_league: {
    overview:
      "Phantom League is a race against 6 AI phantom traders. Trade to grow your P&L while capturing profit orbs that spawn when phantoms win. Reveal hidden phantom identities and climb the leaderboard to beat all 6 shadows.",
    howToPlay: [
      "Trade using the standard interface — select asset, direction, stake, duration, and press Simulate Trade.",
      "Watch the Shadow Market panel on the right — phantom traders are competing against you in real time.",
      "When a phantom wins a trade, a Profit Orb spawns. Click it within 5 seconds to capture 50% of that phantom's profit.",
      "Capturing an orb from an unrevealed phantom reveals its identity (name and archetype).",
      "Monitor the leaderboard — your rank is determined by P&L compared to all 6 phantoms.",
      "Missing orbs (not capturing in time) counts as missed opportunity P&L shown in the Shadow Market.",
    ],
    howToWin:
      "Reach #1 on the leaderboard by P&L and maximize the composite score. Score weights: Session P&L (30%), captured orb value (30%), phantoms revealed × 20 points each, behavioral score (20%).",
    buttons: [
      { label: "Rise / Fall", description: "Predict price direction — Rise for up, Fall for down." },
      { label: "Simulate Trade", description: "Open a simulated trade with your selected parameters." },
      { label: "Sell Early", description: "Close your active position before expiry." },
      { label: "Profit Orbs", description: "Tap/click spawned orbs to capture 50% of the phantom's profit. Each orb has a 5-second countdown." },
      { label: "$10 / $25 / $50", description: "Quick stake amounts for your trades." },
      { label: "1m / 5m / 15m / 1h", description: "Contract duration before auto-resolution." },
    ],
    scoringFormula: "Score = Session P&L × 0.3 + Captured Value × 0.3 + Phantoms Revealed × 20 + Behavioral × 0.2",
    proTips: [
      "Don't just trade — watch for orbs. Captured value is 30% of your score, equal to your own P&L.",
      "Revealing all 6 phantoms adds 120 points (6 × 20) to your score. Prioritize capturing diverse orbs.",
      "When you don't have an open position, phantom wins count against you as 'missed opportunity'. Stay active.",
    ],
    uniqueMechanics: [
      "6 AI Phantoms: Each has a unique archetype (Momentum Rider, Mean Reverter, Scalper, Contrarian, Whale, etc.) with distinct trading patterns.",
      "Profit Orbs: Spawn when phantoms profit. Max 3 visible at once. 5-second lifetime. Capture for 50% of the phantom's gain.",
      "Phantom Reveal: Identities start hidden (???). Capturing an orb from an unrevealed phantom reveals its name and strategy.",
      "Shadow P&L: Tracks missed opportunities — phantom wins while you had no open position.",
    ],
  },

  behavioral_xray: {
    overview:
      "Behavioral X-Ray Sprint is a discipline challenge. Trade to maintain the highest Behavioral Edge Score (BES) — a real-time composite of 5 dimensions: Discipline, Patience, Risk Management, Emotional Control, and Consistency.",
    howToPlay: [
      "Trade using the standard interface — select asset, direction, stake, duration, and press Simulate Trade.",
      "After each completed trade, the BES system analyzes your behavior and scores 5 dimensions (0-100 each).",
      "Watch for behavioral flags — the system detects rapid re-entry, revenge trading, stake escalation, and tilt stacking.",
      "Keep your BES above 50 to avoid Hallucination Mode, where fake alerts and flickering numbers appear.",
      "Your heart rate indicator (BPM) and tilt zone show your current emotional state.",
      "Use Sell Early to tactically manage positions when you spot behavioral red flags.",
    ],
    howToWin:
      "Maximize the composite score by keeping BES high while still generating positive P&L. Score = BES × 0.5 + Session P&L × 0.2 + Hallucination Resistance × 15. Winning trades while 'hallucinating' earns major bonus points.",
    buttons: [
      { label: "Rise / Fall", description: "Predict price direction for your trade." },
      { label: "Simulate Trade", description: "Execute your simulated trade. Each completed trade updates your BES." },
      { label: "Sell Early", description: "Close an active position before expiry. Strategic exits improve your Discipline dimension." },
      { label: "$10 / $25 / $50", description: "Stake presets. Consistent stake sizing improves Risk Management and Consistency dimensions." },
      { label: "1m / 5m / 15m / 1h", description: "Contract duration. Rushed re-entries reduce your Patience dimension." },
    ],
    scoringFormula: "Score = BES × 0.5 + Session P&L × 0.2 + Hallucination Resistance × 15",
    proTips: [
      "BES is 50% of your score — discipline matters more than raw profit in this mode.",
      "Wait between trades. Rapid-fire entries tank your Patience dimension and can trigger tilt flags.",
      "If you enter Hallucination Mode, don't panic. Winning a trade while hallucinating gives massive resistance points.",
    ],
    uniqueMechanics: [
      "5 BES Dimensions: Discipline, Patience, Risk Management, Emotional Control, Consistency — each scored 0-100, averaged for overall BES.",
      "Behavioral Flags: System detects patterns like revenge trading (trading immediately after a loss with higher stake) and tilt stacking.",
      "Hallucination Mode: When BES drops below threshold, fake alerts and number flickers appear. Winning trades during this state earns Hallucination Resistance bonus.",
      "Clarity Restored: Full-screen flash effect when you recover from hallucination state with BES back above 50.",
    ],
  },

  war_room: {
    overview:
      "War Room is a strategic team-based trading game with AI advisors (Bull, Bear, Owl). One advisor is secretly an Insider (mole) giving bad intel. Read the briefings, detect the mole, capture territory on the war map, and execute trades based on council consensus.",
    howToPlay: [
      "Read the War Council briefings — three AI advisors (Bull, Bear, Owl) give directional analysis and confidence levels.",
      "One advisor is a hidden Insider giving misleading intel. After every 5 trades, you can Suspect one advisor.",
      "Choose Rise or Fall based on council consensus (or go against it), set your stake and duration.",
      "Press Execute Order to place your trade. The system tracks whether you followed council consensus.",
      "Click territories on the War Map to place command tokens. When 3+ tokens align, consensus zones form.",
      "Winning trades secure territories (gold glow). Losing trades darken territories for 30 seconds.",
    ],
    howToWin:
      "Maximize the composite war score. Score weights: P&L (30%), Territory Control (25%), Mole Detection (20%), Consensus Accuracy (25%). Exposing the Insider adds 50 points. Ranks: S (80+), A (55+), B (30+), C (below 30).",
    buttons: [
      { label: "Rise / Fall", description: "Your directional call — decide if the market will rise or fall." },
      { label: "Execute Order", description: "Place your trade. Tracks whether you followed or defied council consensus." },
      { label: "Sell Early", description: "Close active position before expiry." },
      { label: "Suspect (N left)", description: "Accuse an advisor of being the Insider. 3 attempts total. Available every 5 trades. Correct = +50 score, wrong = -20 advisor confidence." },
      { label: "Briefing Refresh", description: "Get fresh analysis from all three advisors with updated confidence levels." },
      { label: "War Map Territories", description: "Click cells to place command tokens. 3+ tokens in a cell form consensus zones." },
      { label: "$10 / $25 / $50", description: "Stake presets for your trade." },
      { label: "1m / 5m / 15m / 1h", description: "Contract duration." },
    ],
    scoringFormula: "Score = P&L × 0.3 + Territory Control × 0.25 + Mole Detection × 0.2 + Consensus Accuracy × 0.25",
    proTips: [
      "Don't waste Suspect attempts early. Observe advisor patterns over 10+ trades before accusing.",
      "The Insider's advice will often contradict the other two. Look for the outlier.",
      "Following consensus when it's correct is worth 25% of your score. But ignore it if you've identified the mole is skewing it.",
    ],
    uniqueMechanics: [
      "Hidden Insider: One of Bull/Bear/Owl is secretly a mole giving misleading analysis. Their direction and reasoning can be completely fabricated.",
      "Accusation System: 3 attempts to identify the Insider. Available every 5 trades. Correct identification = 50 bonus points + 'MOLE EXPOSED' event.",
      "War Map: 6 clickable territories. Place command tokens, build consensus zones (3+ tokens), and secure gold territories with winning trades.",
      "Council Consensus: Bull vs Bear confidence determines direction consensus. Owl moderates when tied. Your agreement with consensus is tracked and scored.",
    ],
  },
};
