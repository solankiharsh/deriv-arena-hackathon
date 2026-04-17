import { create } from "zustand";

/**
 * Tiny client-only "auth nudge" channel.
 *
 * When an unauthenticated user clicks a gated action (join a game, start a
 * match, open a partner-only page), we block the API call and bump
 * `nudgeToken`. The top-nav Sign In button subscribes to this token and
 * flashes three times to catch the user's attention, instead of silently
 * 401-ing.
 *
 * This store intentionally holds no secrets, no user data, and never makes a
 * network call. It is purely a UI attention primitive.
 */
interface AuthNudgeState {
  nudgeToken: number;
  nudge: () => void;
}

export const useAuthNudge = create<AuthNudgeState>((set) => ({
  nudgeToken: 0,
  nudge: () =>
    set((s) => {
      const next = s.nudgeToken + 1;
      if (process.env.NODE_ENV !== "production") {
        console.debug("[auth-nudge] fired", { nudgeToken: next });
      }
      return { nudgeToken: next };
    }),
}));
