import { openDB, type IDBPDatabase } from 'idb';
import type { Submission } from '@/lib/db/submissions';

export type QueueStatus = 'pending' | 'syncing' | 'synced' | 'failed';

export interface QueuedSubmission extends Submission {
  status: QueueStatus;
  lastAttemptAt: string | null;
  errorMessage: string | null;
}

const DB_NAME = 'waypoint-pit-queue';
const DB_VERSION = 1;
const STORE = 'submissions';

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('by-status', 'status');
        store.createIndex('by-team-id', 'team_id');
        store.createIndex('by-submitted-by', 'submitted_by');
      },
    });
  }
  return dbPromise;
}

/** Add a fresh submission to the queue with status='pending'. */
export async function enqueueSubmission(row: Submission): Promise<QueuedSubmission> {
  const queued: QueuedSubmission = {
    ...row,
    status: 'pending',
    lastAttemptAt: null,
    errorMessage: null,
  };
  const db = await getDb();
  await db.put(STORE, queued);
  return queued;
}

export async function markStatus(
  id: string,
  status: QueueStatus,
  error: string | null = null,
): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(STORE, 'readwrite');
  const existing = (await tx.store.get(id)) as QueuedSubmission | undefined;
  if (!existing) {
    await tx.done;
    return;
  }
  const next: QueuedSubmission = {
    ...existing,
    status,
    lastAttemptAt: new Date().toISOString(),
    errorMessage: error,
  };
  await tx.store.put(next);
  await tx.done;
}

export async function removeFromQueue(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE, id);
}

/** All rows currently in the queue (pending, syncing, failed). Synced rows are removed on commit. */
export async function listAll(): Promise<QueuedSubmission[]> {
  const db = await getDb();
  return (await db.getAll(STORE)) as QueuedSubmission[];
}

export async function listPending(): Promise<QueuedSubmission[]> {
  const db = await getDb();
  return (await db.getAllFromIndex(STORE, 'by-status', 'pending')) as QueuedSubmission[];
}

export async function listForTeam(teamId: string): Promise<QueuedSubmission[]> {
  const db = await getDb();
  return (await db.getAllFromIndex(STORE, 'by-team-id', teamId)) as QueuedSubmission[];
}

export async function listForUser(userId: string): Promise<QueuedSubmission[]> {
  const db = await getDb();
  return (await db.getAllFromIndex(STORE, 'by-submitted-by', userId)) as QueuedSubmission[];
}

/** Total count across all non-synced statuses (pending + syncing + failed). */
export async function countActive(): Promise<number> {
  const all = await listAll();
  return all.filter((r) => r.status !== 'synced').length;
}

/** Test helper: wipe everything. */
export async function clearAll(): Promise<void> {
  const db = await getDb();
  await db.clear(STORE);
}
