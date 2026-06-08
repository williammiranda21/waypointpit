import { supabase, supabaseConfigured } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { pointInPolygon } from '@/components/map/geo';
import {
  countActive as queueCountActive,
  enqueueSubmission,
  listForTeam as queueListForTeam,
  listAll as queueListAll,
  type QueuedSubmission,
  type QueueStatus,
} from '@/lib/queue/submissionQueue';
import { useOfflineQueueStore } from '@/stores/offlineQueueStore';
import type {
  AgeRange,
  Ethnicity,
  Gender,
  GeoJSONPolygon,
  LocationType,
  Race,
  SubmissionType,
  Tables,
  TablesInsert,
} from '@/lib/database.types';

export type Submission = Tables<'submissions'>;

/** A submission as returned by listSubmissionsForTeam / forEvent. When the
 * row is still in the queue, queueStatus reflects pending/syncing/failed.
 * When the row is already committed, queueStatus is omitted. */
export type SubmissionWithStatus = Submission & { queueStatus?: QueueStatus };

export interface CreateSubmissionInput {
  count_event_id: string;
  team_id: string;
  zone_id: string;
  submission_type: SubmissionType;
  person_count: number;
  location_type: LocationType;
  gps_lat: number;
  gps_lng: number;
  gps_accuracy_meters?: number | null;
  estimated_age_range?: AgeRange | null;
  observed_gender?: Gender | null;
  observed_race?: Race | null;
  observed_ethnicity?: Ethnicity | null;
  notes?: string | null;
  device_submitted_at?: string;
  /** Polygon + buffer used to compute outside_zone client-side (mirrors the server trigger). */
  zone_geometry?: GeoJSONPolygon | null;
  zone_buffer_meters?: number;
}

/**
 * Result of createSubmission: includes the queued row and a flag for whether
 * the queue is being flushed online or sitting offline.
 */
export interface CreateResult {
  submission: Submission;
  queuedOffline: boolean;
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Enqueues a submission for sync. Always writes to IndexedDB first so the
 * row survives network failure / app close. The sync worker (started at
 * app boot) flushes the queue when online.
 */
export async function createSubmission(input: CreateSubmissionInput): Promise<CreateResult> {
  const user = useAuthStore.getState().user;
  if (!user) throw new Error('Not signed in.');

  const { outsideZone, distanceMeters } = computeZoneCheck(
    input.gps_lng,
    input.gps_lat,
    input.zone_geometry,
    input.zone_buffer_meters ?? 25,
  );

  const now = new Date().toISOString();
  const offline = typeof navigator !== 'undefined' && !navigator.onLine;

  const row: Submission = {
    id: crypto.randomUUID(),
    count_event_id: input.count_event_id,
    team_id: input.team_id,
    zone_id: input.zone_id,
    org_id: user.orgId,
    submitted_by: user.id,
    submission_type: input.submission_type,
    person_count: input.person_count,
    location_type: input.location_type,
    gps_lat: input.gps_lat,
    gps_lng: input.gps_lng,
    gps_accuracy_meters: input.gps_accuracy_meters ?? null,
    location: { type: 'Point', coordinates: [input.gps_lng, input.gps_lat] },
    estimated_age_range: input.estimated_age_range ?? null,
    observed_gender: input.observed_gender ?? null,
    observed_race: input.observed_race ?? null,
    observed_ethnicity: input.observed_ethnicity ?? null,
    notes: input.notes ?? null,
    device_submitted_at: input.device_submitted_at ?? now,
    server_submitted_at: now,
    is_offline_submission: offline,
    outside_zone: outsideZone,
    distance_to_zone_meters: distanceMeters,
  };

  await enqueueSubmission(row);
  // Refresh the visible pending count immediately.
  await refreshPendingCount();
  return { submission: row, queuedOffline: offline };
}

/**
 * Commits a single queued submission to the canonical store (Supabase in
 * real mode, demo localStorage in demo mode). Called by the sync worker.
 * Throws on failure so the caller can mark the queue row failed.
 */
export async function commitQueuedSubmission(queued: QueuedSubmission): Promise<void> {
  const { status: _status, lastAttemptAt: _l, errorMessage: _e, location: _loc, server_submitted_at: _ssa, ...rest } = queued;
  const row: TablesInsert<'submissions'> = {
    ...rest,
    is_offline_submission: queued.is_offline_submission,
  };

  if (!supabaseConfigured) {
    demoAppend({ ...queued, server_submitted_at: new Date().toISOString() });
    return;
  }

  const { error } = await supabase.from('submissions').insert(row);
  if (error) throw error;
}

export async function listSubmissionsForTeam(teamId: string): Promise<SubmissionWithStatus[]> {
  const canonical = supabaseConfigured
    ? await fetchCanonicalForTeam(teamId)
    : demoList((s) => s.team_id === teamId);

  const queued = (await queueListForTeam(teamId)).filter((q) => q.status !== 'synced');
  return mergeQueueAndCanonical(queued, canonical);
}

export async function listSubmissionsForEvent(countEventId: string): Promise<SubmissionWithStatus[]> {
  const canonical = supabaseConfigured
    ? await fetchCanonicalForEvent(countEventId)
    : demoList((s) => s.count_event_id === countEventId);

  const queued = (await queueListAll())
    .filter((q) => q.count_event_id === countEventId && q.status !== 'synced');
  return mergeQueueAndCanonical(queued, canonical);
}

async function fetchCanonicalForTeam(teamId: string): Promise<Submission[]> {
  const { data, error } = await supabase
    .from('submissions')
    .select('*')
    .eq('team_id', teamId)
    .order('server_submitted_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

async function fetchCanonicalForEvent(eventId: string): Promise<Submission[]> {
  const { data, error } = await supabase
    .from('submissions')
    .select('*')
    .eq('count_event_id', eventId)
    .order('server_submitted_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

function mergeQueueAndCanonical(
  queued: QueuedSubmission[],
  canonical: Submission[],
): SubmissionWithStatus[] {
  // Queue rows are authoritative for non-synced submissions. Canonical rows
  // are authoritative for everything that's been committed.
  const queuedIds = new Set(queued.map((q) => q.id));
  const canonicalFiltered = canonical.filter((c) => !queuedIds.has(c.id));
  const combined: SubmissionWithStatus[] = [
    ...queued.map(toSubmissionWithStatus),
    ...canonicalFiltered,
  ];
  return combined.sort((a, b) =>
    b.device_submitted_at.localeCompare(a.device_submitted_at),
  );
}

function toSubmissionWithStatus(q: QueuedSubmission): SubmissionWithStatus {
  const { status, lastAttemptAt: _l, errorMessage: _e, ...rest } = q;
  return { ...rest, queueStatus: status };
}

/** Refreshes the offlineQueueStore.pendingCount from IndexedDB. */
export async function refreshPendingCount(): Promise<void> {
  try {
    const count = await queueCountActive();
    useOfflineQueueStore.getState().setPendingCount(count);
  } catch {
    // IndexedDB unavailable (private mode, etc.) — leave count as-is.
  }
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const M_PER_DEG_LAT = 111_320;
const M_PER_DEG_LNG_AT_MIAMI = 100_300;

function computeZoneCheck(
  lng: number,
  lat: number,
  zone: GeoJSONPolygon | null | undefined,
  bufferMeters: number,
): { outsideZone: boolean; distanceMeters: number } {
  if (!zone) return { outsideZone: false, distanceMeters: 0 };

  const inside = pointInPolygon([lng, lat], zone);
  if (inside) return { outsideZone: false, distanceMeters: 0 };

  const ring = zone.coordinates[0];
  let minDistMeters = Infinity;
  for (let i = 0; i < ring.length - 1; i++) {
    const d = distancePointToSegmentMeters(
      [lng, lat],
      ring[i] as [number, number],
      ring[i + 1] as [number, number],
    );
    if (d < minDistMeters) minDistMeters = d;
  }
  return { outsideZone: minDistMeters > bufferMeters, distanceMeters: minDistMeters };
}

function distancePointToSegmentMeters(
  p: [number, number],
  a: [number, number],
  b: [number, number],
): number {
  const px = p[0] * M_PER_DEG_LNG_AT_MIAMI;
  const py = p[1] * M_PER_DEG_LAT;
  const ax = a[0] * M_PER_DEG_LNG_AT_MIAMI;
  const ay = a[1] * M_PER_DEG_LAT;
  const bx = b[0] * M_PER_DEG_LNG_AT_MIAMI;
  const by = b[1] * M_PER_DEG_LAT;
  const abx = bx - ax;
  const aby = by - ay;
  const len2 = abx * abx + aby * aby;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * abx + (py - ay) * aby) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * abx;
  const cy = ay + t * aby;
  return Math.hypot(px - cx, py - cy);
}

// -----------------------------------------------------------------------------
// Demo-mode canonical storage
// -----------------------------------------------------------------------------

const DEMO_KEY = 'waypoint-pit-demo-submissions';

function demoReadAll(): Submission[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(window.localStorage.getItem(DEMO_KEY) ?? '[]') as Submission[];
  } catch {
    return [];
  }
}

function demoWriteAll(rows: Submission[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(DEMO_KEY, JSON.stringify(rows));
}

function demoList(filter: (s: Submission) => boolean): Submission[] {
  return demoReadAll()
    .filter(filter)
    .sort((a, b) => b.server_submitted_at.localeCompare(a.server_submitted_at));
}

function demoAppend(row: Submission): void {
  const all = demoReadAll();
  all.push(row);
  demoWriteAll(all);
}
