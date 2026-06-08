import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { SupportedLanguage } from '@/i18n';

export type Role = 'super_admin' | 'coc_admin' | 'team_lead' | 'volunteer';

/**
 * 'loading' — restoring session on boot; guards should wait
 * 'ready'   — initialization complete (user is either set or null)
 */
export type AuthStatus = 'loading' | 'ready';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  orgId: string;
  preferredLanguage: SupportedLanguage;
}

interface AuthState {
  user: AuthUser | null;
  status: AuthStatus;
  isAuthenticated: boolean;
  setUser: (user: AuthUser | null) => void;
  setStatus: (status: AuthStatus) => void;
  setLanguage: (lang: SupportedLanguage) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      status: 'loading',
      isAuthenticated: false,
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setStatus: (status) => set({ status }),
      setLanguage: (lang) => {
        const current = get().user;
        if (!current) return;
        set({ user: { ...current, preferredLanguage: lang } });
      },
      clear: () => set({ user: null, isAuthenticated: false }),
    }),
    {
      name: 'waypoint-pit-auth',
      storage: createJSONStorage(() => localStorage),
      // Persist user only — status is always 'loading' on boot until restoreSession resolves.
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    },
  ),
);
