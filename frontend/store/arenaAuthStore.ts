import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ArenaUser } from '@/lib/arena-types';
import { arenaApi } from '@/lib/arena-api';

interface ArenaAuthState {
  user: ArenaUser | null;
  isLoading: boolean;
  isHydrated: boolean;
  didLogout: boolean;

  fetchUser: () => Promise<ArenaUser | null>;
  setUser: (user: ArenaUser | null) => void;
  logout: () => Promise<void>;
  clearLogoutFlag: () => void;
  setHydrated: (v: boolean) => void;
}

export const useArenaAuth = create<ArenaAuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isLoading: false,
      isHydrated: false,
      didLogout: false,

      fetchUser: async () => {
        set({ isLoading: true });
        try {
          const { user } = await arenaApi.auth.me();
          set({ user, isLoading: false });
          return user;
        } catch {
          // No session: stay signed out. Demo/guest access is opt-in from /login (judge buttons),
          // not automatic — otherwise everyone was silently logged in as `player`.
          if (get().didLogout) {
            set({ user: null, isLoading: false });
            return null;
          }
          set({ user: null, isLoading: false });
          return null;
        }
      },

      setUser: (user) => set({ user }),

      logout: async () => {
        try {
          await arenaApi.auth.logout();
        } catch { /* ignore */ }
        set({ user: null, didLogout: true });
      },

      clearLogoutFlag: () => set({ didLogout: false }),

      setHydrated: (v) => set({ isHydrated: v }),
    }),
    {
      name: 'arena-auth',
      partialize: (s) => ({ user: s.user, didLogout: s.didLogout }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);
