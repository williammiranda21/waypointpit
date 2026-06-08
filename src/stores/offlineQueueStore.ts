import { create } from 'zustand';

export type ConnectivityState = 'online' | 'offline' | 'syncing' | 'synced';

interface OfflineQueueState {
  connectivity: ConnectivityState;
  pendingCount: number;
  lastSyncAt: string | null;
  setConnectivity: (state: ConnectivityState) => void;
  setPendingCount: (count: number) => void;
  markSynced: () => void;
}

export const useOfflineQueueStore = create<OfflineQueueState>((set) => ({
  connectivity: typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'online',
  pendingCount: 0,
  lastSyncAt: null,
  setConnectivity: (connectivity) => set({ connectivity }),
  setPendingCount: (pendingCount) => set({ pendingCount }),
  markSynced: () => set({ connectivity: 'synced', lastSyncAt: new Date().toISOString() }),
}));

// Wire browser online/offline events into the store. Phase 8 will extend this with
// the IndexedDB queue itself; this listener just keeps the connectivity dot accurate.
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => useOfflineQueueStore.getState().setConnectivity('online'));
  window.addEventListener('offline', () => useOfflineQueueStore.getState().setConnectivity('offline'));
}
