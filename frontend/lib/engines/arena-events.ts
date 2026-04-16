"use strict";

import { nanoid } from "nanoid";
import type { ArenaEventType, ArenaEvent } from "../db/schema";
import type { FighterAction } from "../stores/arena-store";
import { useArenaStore } from "../stores/arena-store";

interface ArenaEventDef {
  type: ArenaEventType;
  label: string;
  description: string;
  yourHealthDelta: number;
  antiYouHealthDelta: number;
  scoreDelta: number;
  isShake: boolean;
  side: ArenaEvent["side"];
  yourAction: FighterAction;
  antiYouAction: FighterAction;
}

export const ARENA_EVENT_DEFS: Record<ArenaEventType, Omit<ArenaEventDef, "type">> = {
  POW: {
    label: "POW!!",
    description: "You won a trade that Anti-You lost!",
    yourHealthDelta: 5,
    antiYouHealthDelta: -12,
    scoreDelta: 15,
    isShake: true,
    side: "center",
    yourAction: "uppercut",
    antiYouAction: "stagger",
  },
  EXECUTION_PERFECT: {
    label: "PERFECT!",
    description: "Flawless execution — held to expiry, correct sizing",
    yourHealthDelta: 3,
    antiYouHealthDelta: -5,
    scoreDelta: 10,
    isShake: false,
    side: "you",
    yourAction: "hook",
    antiYouAction: "hit",
  },
  BIAS_DETECTED: {
    label: "BIAS HIT!",
    description: "Anti-You scores — your trade showed a known bias pattern",
    yourHealthDelta: -8,
    antiYouHealthDelta: 5,
    scoreDelta: -8,
    isShake: true,
    side: "anti-you",
    yourAction: "stagger",
    antiYouAction: "body-blow",
  },
  TILT_DETECTED: {
    label: "TILT!!",
    description: "Tilt zone crossed — Anti-You gains ground",
    yourHealthDelta: -5,
    antiYouHealthDelta: 3,
    scoreDelta: -5,
    isShake: true,
    side: "anti-you",
    yourAction: "hit",
    antiYouAction: "uppercut",
  },
  REVENGE_BLOCKED: {
    label: "BLOCKED!",
    description: "Pre-Mortem intervention accepted — defense move",
    yourHealthDelta: 5,
    antiYouHealthDelta: -3,
    scoreDelta: 8,
    isShake: false,
    side: "you",
    yourAction: "dodge",
    antiYouAction: "jab",
  },
  PHANTOM_HIT: {
    label: "PHANTOM HIT!",
    description: "A high-confidence phantom resolved as a winner",
    yourHealthDelta: -8,
    antiYouHealthDelta: 0,
    scoreDelta: -10,
    isShake: true,
    side: "you",
    yourAction: "stagger",
    antiYouAction: "hook",
  },
  KNOCKOUT: {
    label: "K.O.!!",
    description: "Decisive session victory!",
    yourHealthDelta: 0,
    antiYouHealthDelta: 0,
    scoreDelta: 50,
    isShake: true,
    side: "center",
    yourAction: "uppercut",
    antiYouAction: "ko",
  },
  COMBO: {
    label: "COMBO!",
    description: "Three consecutive great behavioral decisions",
    yourHealthDelta: 8,
    antiYouHealthDelta: -8,
    scoreDelta: 20,
    isShake: true,
    side: "you",
    yourAction: "body-blow",
    antiYouAction: "stagger",
  },
  KNOCKOUT_FINISHER: {
    label: "K.O. FINISHER!",
    description: "20% profit target reached — devastating finishing blow!",
    yourHealthDelta: 0,
    antiYouHealthDelta: -100,
    scoreDelta: 100,
    isShake: true,
    side: "center",
    yourAction: "uppercut",
    antiYouAction: "ko",
  },
  HEAT_MODE_ACTIVATED: {
    label: "HEAT MODE!",
    description: "Win streak on fire — enhanced trading power!",
    yourHealthDelta: 5,
    antiYouHealthDelta: -5,
    scoreDelta: 15,
    isShake: true,
    side: "you",
    yourAction: "hook",
    antiYouAction: "stagger",
  },
  CHAOS_EVENT: {
    label: "BREAKING NEWS!",
    description: "Market chaos erupts — volatility spike incoming",
    yourHealthDelta: 0,
    antiYouHealthDelta: 0,
    scoreDelta: 0,
    isShake: true,
    side: "center",
    yourAction: "block",
    antiYouAction: "block",
  },
  HALLUCINATION_TRIGGERED: {
    label: "HALLUCINATION!",
    description: "Discipline slipping — reality distortion active",
    yourHealthDelta: -3,
    antiYouHealthDelta: 0,
    scoreDelta: -5,
    isShake: false,
    side: "anti-you",
    yourAction: "stagger",
    antiYouAction: "idle",
  },
  MOLE_EXPOSED: {
    label: "MOLE EXPOSED!",
    description: "The insider has been identified and eliminated!",
    yourHealthDelta: 10,
    antiYouHealthDelta: -10,
    scoreDelta: 50,
    isShake: true,
    side: "you",
    yourAction: "uppercut",
    antiYouAction: "ko",
  },
};

export function buildArenaEvent(
  type: ArenaEventType,
  sessionId: string
): Omit<ArenaEvent, "id"> {
  const def = ARENA_EVENT_DEFS[type];
  return {
    sessionId,
    timestamp: Date.now(),
    type,
    description: def.description,
    impact: def.scoreDelta,
    side: def.side,
  };
}

export function getEventLabel(type: ArenaEventType): string {
  return ARENA_EVENT_DEFS[type].label;
}

export const EVENT_COLORS: Record<ArenaEventType, string> = {
  POW: "#00D4AA",
  EXECUTION_PERFECT: "#22C55E",
  BIAS_DETECTED: "#F97316",
  TILT_DETECTED: "#EF4444",
  REVENGE_BLOCKED: "#22C55E",
  PHANTOM_HIT: "#8B5CF6",
  KNOCKOUT: "#FBBF24",
  COMBO: "#00D4AA",
  KNOCKOUT_FINISHER: "#FFD700",
  HEAT_MODE_ACTIVATED: "#FF6B00",
  CHAOS_EVENT: "#EF4444",
  HALLUCINATION_TRIGGERED: "#8B5CF6",
  MOLE_EXPOSED: "#FBBF24",
};

/**
 * Fire a full arena event: build it, apply health deltas,
 * trigger fighter animations, track combos, and detect KO.
 */
export function fireArenaEvent(type: ArenaEventType, sessionId: string): void {
  const def = ARENA_EVENT_DEFS[type];
  const store = useArenaStore.getState();

  const event: ArenaEvent = {
    id: nanoid(),
    ...buildArenaEvent(type, sessionId),
  };

  store.addEvent(event);

  if (def.yourHealthDelta !== 0) store.adjustYourHealth(def.yourHealthDelta);
  if (def.antiYouHealthDelta !== 0) store.adjustAntiYouHealth(def.antiYouHealthDelta);

  store.triggerFight(def.yourAction, def.antiYouAction);

  if (def.isShake) store.triggerShake();

  if (def.side === "you" && def.yourHealthDelta >= 0) {
    store.incrementCombo();
    const newCombo = useArenaStore.getState().comboCount;
    if (newCombo > 0 && newCombo % 3 === 0) {
      setTimeout(() => fireArenaEvent("COMBO", sessionId), 400);
    }
  } else if (def.side === "anti-you") {
    store.resetCombo();
  }

  const { yourHealth, antiYouHealth } = useArenaStore.getState();
  if (antiYouHealth <= 0 && type !== "KNOCKOUT") {
    setTimeout(() => {
      fireArenaEvent("KNOCKOUT", sessionId);
      useArenaStore.getState().setSessionResult("win");
    }, 600);
  } else if (yourHealth <= 0) {
    useArenaStore.getState().setSessionResult("loss");
  }
}
