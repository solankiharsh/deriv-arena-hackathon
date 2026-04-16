"use client";

import { create } from "zustand";
import type { Session } from "../db/schema";

interface SessionState {
  currentSession: Session | null;
  sessionHistory: Session[];

  setCurrentSession: (session: Session | null) => void;
  updateCurrentSession: (updates: Partial<Session>) => void;
  addSessionToHistory: (session: Session) => void;
  setSessionHistory: (sessions: Session[]) => void;
}

export const useSessionStore = create<SessionState>()((set) => ({
  currentSession: null,
  sessionHistory: [],

  setCurrentSession: (currentSession) => set({ currentSession }),

  updateCurrentSession: (updates) =>
    set((state) => ({
      currentSession: state.currentSession
        ? { ...state.currentSession, ...updates }
        : null,
    })),

  addSessionToHistory: (session) =>
    set((state) => ({
      sessionHistory: [session, ...state.sessionHistory],
    })),

  setSessionHistory: (sessionHistory) => set({ sessionHistory }),
}));
