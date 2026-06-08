import {
  countActive,
  listPending,
  markStatus,
  removeFromQueue,
} from './submissionQueue';
import { commitQueuedSubmission, refreshPendingCount } from '@/lib/db/submissions';
import { useOfflineQueueStore } from '@/stores/offlineQueueStore';
import { toast } from '@/stores/toastStore';
import { submissionsKey } from '@/hooks/useSubmissions';
import type { QueryClient } from '@tanstack/react-query';

const POLL_INTERVAL_MS = 60_000;
let started = false;
let pollTimer: number | null = null;
let queryClient: QueryClient | null = null;

/**
 * Boot the queue worker. Safe to call multiple times — only starts once.
 * Pass the React Query client so successful flushes can invalidate
 * submission lists for live UI updates.
 */
export function startQueueWorker(qc: QueryClient): void {
  if (started) return;
  started = true;
  queryClient = qc;

  if (typeof window !== 'undefined') {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
  }

  // Kick an initial flush (no-op when offline; also no-op when queue empty).
  void flushQueue();
  pollTimer = window.setInterval(() => void flushQueue(), POLL_INTERVAL_MS);
}

export function stopQueueWorker(): void {
  if (!started) return;
  started = false;
  if (pollTimer !== null) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  if (typeof window !== 'undefined') {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  }
}

function handleOnline() {
  useOfflineQueueStore.getState().setConnectivity('online');
  void flushQueue();
}

function handleOffline() {
  useOfflineQueueStore.getState().setConnectivity('offline');
}

let flushing = false;

/**
 * Walks pending rows in IndexedDB, commits each to the canonical store, and
 * removes successful ones from the queue. Failures stay in the queue with
 * status='failed' for inspection and the next retry.
 */
export async function flushQueue(): Promise<void> {
  if (flushing) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;

  const pending = await listPending();
  if (pending.length === 0) {
    await refreshPendingCount();
    return;
  }

  flushing = true;
  useOfflineQueueStore.getState().setConnectivity('syncing');

  let synced = 0;
  let failed = 0;

  for (const row of pending) {
    await markStatus(row.id, 'syncing');
    try {
      await commitQueuedSubmission(row);
      await removeFromQueue(row.id);
      synced++;
    } catch (err) {
      await markStatus(row.id, 'failed', err instanceof Error ? err.message : 'Sync failed');
      failed++;
    }
  }

  flushing = false;
  await refreshPendingCount();

  const remaining = await countActive();
  useOfflineQueueStore
    .getState()
    .setConnectivity(remaining === 0 ? 'synced' : navigator.onLine ? 'online' : 'offline');

  // Briefly flash the synced state, then fall back to online.
  if (remaining === 0) {
    setTimeout(() => {
      const cur = useOfflineQueueStore.getState();
      if (cur.connectivity === 'synced') cur.setConnectivity('online');
    }, 3000);
  }

  // Invalidate any open submission lists so they re-fetch from the merged source.
  if (queryClient) {
    queryClient.invalidateQueries({ queryKey: submissionsKey.forTeam('') });
    queryClient.invalidateQueries({ queryKey: ['submissions'] });
  }

  if (synced > 0) {
    toast({
      tone: 'success',
      message:
        synced === 1
          ? '1 submission synced'
          : `${synced} submissions synced`,
    });
  }
  if (failed > 0) {
    toast({
      tone: 'error',
      message: `${failed} submission${failed === 1 ? '' : 's'} failed to sync — will retry`,
      ttlMs: 6000,
    });
  }
}
