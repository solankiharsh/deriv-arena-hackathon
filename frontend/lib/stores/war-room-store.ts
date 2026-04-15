"use client";

import { create } from "zustand";
import type { WarRoomDebate } from "../db/schema";
import type { TradeDirection } from "../db/schema";

export interface AgentMessage {
  agent: "BULL" | "BEAR" | "OWL";
  content: string;
  timestamp: number;
  isStreaming: boolean;
}

export interface AgentAccuracy {
  agent: "BULL" | "BEAR" | "OWL";
  wins: number;
  total: number;
  winRate: number;
}

interface WarRoomState {
  isDebating: boolean;
  debateMessages: AgentMessage[];
  bullDirection: TradeDirection | null;
  bullConfidence: number;
  bullReasoning: string;
  bearDirection: TradeDirection | null;
  bearConfidence: number;
  bearReasoning: string;
  owlDirection: TradeDirection | null;
  owlConfidence: number;
  owlReasoning: string;
  consensusDirection: TradeDirection | null;
  consensusConfidence: number;
  hasConsensus: boolean;
  recentDebates: WarRoomDebate[];
  agentAccuracy: AgentAccuracy[];

  startDebate: () => void;
  endDebate: () => void;
  addMessage: (message: AgentMessage) => void;
  updateMessage: (agent: string, content: string) => void;
  setAgentResult: (
    agent: "BULL" | "BEAR" | "OWL",
    direction: TradeDirection,
    confidence: number,
    reasoning: string
  ) => void;
  calculateConsensus: (threshold: number) => void;
  setRecentDebates: (debates: WarRoomDebate[]) => void;
  setAgentAccuracy: (accuracy: AgentAccuracy[]) => void;
  reset: () => void;
}

export const useWarRoomStore = create<WarRoomState>()((set, get) => ({
  isDebating: false,
  debateMessages: [],
  bullDirection: null,
  bullConfidence: 0,
  bullReasoning: "",
  bearDirection: null,
  bearConfidence: 0,
  bearReasoning: "",
  owlDirection: null,
  owlConfidence: 0,
  owlReasoning: "",
  consensusDirection: null,
  consensusConfidence: 0,
  hasConsensus: false,
  recentDebates: [],
  agentAccuracy: [
    { agent: "BULL", wins: 0, total: 0, winRate: 0 },
    { agent: "BEAR", wins: 0, total: 0, winRate: 0 },
    { agent: "OWL", wins: 0, total: 0, winRate: 0 },
  ],

  startDebate: () =>
    set({
      isDebating: true,
      debateMessages: [],
      bullDirection: null,
      bullConfidence: 0,
      bearDirection: null,
      bearConfidence: 0,
      owlDirection: null,
      owlConfidence: 0,
      consensusDirection: null,
      consensusConfidence: 0,
      hasConsensus: false,
    }),

  endDebate: () => set({ isDebating: false }),

  addMessage: (message) =>
    set((state) => ({
      debateMessages: [...state.debateMessages, message],
    })),

  updateMessage: (agent, content) =>
    set((state) => ({
      debateMessages: state.debateMessages.map((m) =>
        m.agent === agent ? { ...m, content, isStreaming: false } : m
      ),
    })),

  setAgentResult: (agent, direction, confidence, reasoning) => {
    const key = agent.toLowerCase() as "bull" | "bear" | "owl";
    set({
      [`${key}Direction`]: direction,
      [`${key}Confidence`]: confidence,
      [`${key}Reasoning`]: reasoning,
    });
  },

  calculateConsensus: (threshold) => {
    const state = get();
    const directions = [state.bullDirection, state.bearDirection, state.owlDirection].filter(Boolean);
    const confidences = [state.bullConfidence, state.bearConfidence, state.owlConfidence];

    const callCount = directions.filter((d) => d === "CALL").length;
    const putCount = directions.filter((d) => d === "PUT").length;

    const majorityDir: TradeDirection | null =
      callCount >= 2 ? "CALL" : putCount >= 2 ? "PUT" : null;
    const avgConfidence =
      confidences.reduce((a, b) => a + b, 0) / confidences.length;
    const hasConsensus = majorityDir !== null && avgConfidence >= threshold;

    set({
      consensusDirection: majorityDir,
      consensusConfidence: avgConfidence,
      hasConsensus,
    });
  },

  setRecentDebates: (recentDebates) => set({ recentDebates }),
  setAgentAccuracy: (agentAccuracy) => set({ agentAccuracy }),

  reset: () =>
    set({
      isDebating: false,
      debateMessages: [],
      bullDirection: null,
      bullConfidence: 0,
      bearDirection: null,
      bearConfidence: 0,
      owlDirection: null,
      owlConfidence: 0,
      consensusDirection: null,
      consensusConfidence: 0,
      hasConsensus: false,
    }),
}));
