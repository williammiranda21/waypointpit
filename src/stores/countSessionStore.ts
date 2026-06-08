import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ActiveCountSession {
  eventId: string;
  eventName: string;
  teamId: string;
  teamName: string;
  zoneId: string;
  zoneName: string;
  startedAt: string;
}

interface CountSessionState {
  session: ActiveCountSession | null;
  setSession: (session: ActiveCountSession | null) => void;
  clear: () => void;
}

export const useCountSessionStore = create<CountSessionState>()(
  persist(
    (set) => ({
      session: null,
      setSession: (session) => set({ session }),
      clear: () => set({ session: null }),
    }),
    { name: 'waypoint-pit-count-session' },
  ),
);
