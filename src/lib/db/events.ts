import { supabase, supabaseConfigured } from '@/lib/supabase';
import type { Tables, TablesInsert, EventStatus, SubmissionMode } from '@/lib/database.types';
import { useAuthStore } from '@/stores/authStore';

export type CountEvent = Tables<'count_events'>;

export interface CreateEventInput {
  name: string;
  count_date: string; // YYYY-MM-DD
  description?: string | null;
  enforce_zone_boundary?: boolean;
  zone_buffer_meters?: number;
  submission_mode?: SubmissionMode;
  cloned_from_event_id?: string | null;
}

export interface UpdateEventInput {
  name?: string;
  count_date?: string;
  description?: string | null;
  status?: EventStatus;
  enforce_zone_boundary?: boolean;
  zone_buffer_meters?: number;
  submission_mode?: SubmissionMode;
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

export async function listEvents(orgId: string): Promise<CountEvent[]> {
  if (!supabaseConfigured) return demoList(orgId);

  const { data, error } = await supabase
    .from('count_events')
    .select('*')
    .eq('org_id', orgId)
    .order('count_date', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getEvent(id: string): Promise<CountEvent | null> {
  if (!supabaseConfigured) return demoGet(id);

  const { data, error } = await supabase
    .from('count_events')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createEvent(input: CreateEventInput): Promise<CountEvent> {
  const user = useAuthStore.getState().user;
  if (!user) throw new Error('Not signed in.');

  const row: TablesInsert<'count_events'> = {
    org_id: user.orgId,
    name: input.name,
    count_date: input.count_date,
    description: input.description ?? null,
    status: 'draft',
    enforce_zone_boundary: input.enforce_zone_boundary ?? false,
    zone_buffer_meters: input.zone_buffer_meters ?? 25,
    submission_mode: input.submission_mode ?? 'tally_only',
    cloned_from_event_id: input.cloned_from_event_id ?? null,
    created_by: user.id,
  };

  if (!supabaseConfigured) return demoCreate(row);

  const { data, error } = await supabase
    .from('count_events')
    .insert(row)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function updateEvent(id: string, patch: UpdateEventInput): Promise<CountEvent> {
  if (!supabaseConfigured) return demoUpdate(id, patch);

  const { data, error } = await supabase
    .from('count_events')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

// -----------------------------------------------------------------------------
// Demo-mode storage (localStorage, scoped per org_id)
// -----------------------------------------------------------------------------

const DEMO_KEY = 'waypoint-pit-demo-events';

function demoReadAll(): CountEvent[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = JSON.parse(window.localStorage.getItem(DEMO_KEY) ?? '[]') as CountEvent[];
    // Backfill submission_mode for events created before the column existed.
    return raw.map((e) => ({ ...e, submission_mode: e.submission_mode ?? 'tally_only' }));
  } catch {
    return [];
  }
}

function demoWriteAll(events: CountEvent[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(DEMO_KEY, JSON.stringify(events));
}

function demoList(orgId: string): CountEvent[] {
  return demoReadAll()
    .filter((e) => e.org_id === orgId)
    .sort((a, b) => b.count_date.localeCompare(a.count_date));
}

function demoGet(id: string): CountEvent | null {
  return demoReadAll().find((e) => e.id === id) ?? null;
}

function demoCreate(row: TablesInsert<'count_events'>): CountEvent {
  const now = new Date().toISOString();
  const event: CountEvent = {
    id: row.id ?? crypto.randomUUID(),
    org_id: row.org_id,
    name: row.name,
    count_date: row.count_date,
    description: row.description ?? null,
    status: row.status ?? 'draft',
    enforce_zone_boundary: row.enforce_zone_boundary ?? false,
    zone_buffer_meters: row.zone_buffer_meters ?? 25,
    submission_mode: row.submission_mode ?? 'tally_only',
    cloned_from_event_id: row.cloned_from_event_id ?? null,
    created_by: row.created_by ?? null,
    created_at: row.created_at ?? now,
    closed_at: row.closed_at ?? null,
  };
  const all = demoReadAll();
  all.push(event);
  demoWriteAll(all);
  return event;
}

function demoUpdate(id: string, patch: UpdateEventInput): CountEvent {
  const all = demoReadAll();
  const idx = all.findIndex((e) => e.id === id);
  if (idx < 0) throw new Error('Event not found.');
  const next: CountEvent = {
    ...all[idx],
    ...patch,
    description: patch.description ?? all[idx].description,
    closed_at:
      patch.status === 'closed' && !all[idx].closed_at
        ? new Date().toISOString()
        : all[idx].closed_at,
  };
  all[idx] = next;
  demoWriteAll(all);
  return next;
}
