import { supabase, supabaseConfigured } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { listZonesForEvent } from './zones';
import { pointInPolygon } from '@/components/map/geo';
import type {
  HotspotType,
  Severity,
  Tables,
  TablesInsert,
  TablesUpdate,
} from '@/lib/database.types';

export type Hotspot = Tables<'hotspots'>;

export interface CreateHotspotInput {
  count_event_id: string;
  name: string;
  description?: string | null;
  hotspot_type?: HotspotType;
  severity?: Severity;
  expected_count?: number | null;
  source?: string | null;
  reported_at?: string | null;
  gps_lat: number;
  gps_lng: number;
  /** When omitted, the server (or this layer in demo mode) auto-assigns based on the event's zones. */
  zone_id?: string | null;
}

export interface UpdateHotspotInput {
  name?: string;
  description?: string | null;
  hotspot_type?: HotspotType;
  severity?: Severity;
  expected_count?: number | null;
  source?: string | null;
  gps_lat?: number;
  gps_lng?: number;
  zone_id?: string | null;
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

export async function listHotspotsForEvent(countEventId: string): Promise<Hotspot[]> {
  if (!supabaseConfigured) return demoList(countEventId);

  const { data, error } = await supabase
    .from('hotspots')
    .select('*')
    .eq('count_event_id', countEventId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function createHotspot(input: CreateHotspotInput): Promise<Hotspot> {
  const user = useAuthStore.getState().user;
  if (!user) throw new Error('Not signed in.');

  const zoneId = input.zone_id ?? (await autoAssignZone(input.count_event_id, input.gps_lng, input.gps_lat));

  const row: TablesInsert<'hotspots'> = {
    count_event_id: input.count_event_id,
    org_id: user.orgId,
    zone_id: zoneId,
    name: input.name,
    description: input.description ?? null,
    hotspot_type: input.hotspot_type ?? 'sighting',
    severity: input.severity ?? 'medium',
    expected_count: input.expected_count ?? null,
    source: input.source ?? null,
    reported_at: input.reported_at ?? null,
    gps_lat: input.gps_lat,
    gps_lng: input.gps_lng,
    created_by: user.id,
  };

  if (!supabaseConfigured) return demoCreate(row);

  const { data, error } = await supabase
    .from('hotspots')
    .insert(row)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function createHotspotsBatch(inputs: CreateHotspotInput[]): Promise<Hotspot[]> {
  // Use individual creates so auto-zone-assignment runs per row in demo mode.
  // Real Supabase mode could use a single insert([...]) once we move auto-zone to a trigger.
  const out: Hotspot[] = [];
  for (const input of inputs) {
    out.push(await createHotspot(input));
  }
  return out;
}

export async function updateHotspot(id: string, patch: UpdateHotspotInput): Promise<Hotspot> {
  if (!supabaseConfigured) return demoUpdate(id, patch);

  const update: TablesUpdate<'hotspots'> = patch;
  const { data, error } = await supabase
    .from('hotspots')
    .update(update)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function toggleHotspotResolved(id: string): Promise<Hotspot> {
  if (!supabaseConfigured) return demoToggleResolved(id);

  const { data, error } = await supabase.rpc('wp_resolve_hotspot', { p_hotspot_id: id });
  if (error) throw error;
  if (!data) throw new Error('Hotspot not found.');
  return data;
}

export async function deleteHotspot(id: string): Promise<void> {
  if (!supabaseConfigured) {
    demoDelete(id);
    return;
  }
  const { error } = await supabase.from('hotspots').delete().eq('id', id);
  if (error) throw error;
}

// -----------------------------------------------------------------------------
// Auto-zone assignment
// -----------------------------------------------------------------------------

async function autoAssignZone(
  countEventId: string,
  lng: number,
  lat: number,
): Promise<string | null> {
  const zones = await listZonesForEvent(countEventId);
  for (const z of zones) {
    if (pointInPolygon([lng, lat], z.geometry)) return z.id;
  }
  return null;
}

// -----------------------------------------------------------------------------
// Demo-mode storage
// -----------------------------------------------------------------------------

const DEMO_KEY = 'waypoint-pit-demo-hotspots';

function demoReadAll(): Hotspot[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(window.localStorage.getItem(DEMO_KEY) ?? '[]') as Hotspot[];
  } catch {
    return [];
  }
}

function demoWriteAll(rows: Hotspot[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(DEMO_KEY, JSON.stringify(rows));
}

function demoList(countEventId: string): Hotspot[] {
  return demoReadAll()
    .filter((h) => h.count_event_id === countEventId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

function demoCreate(row: TablesInsert<'hotspots'>): Hotspot {
  const now = new Date().toISOString();
  const hot: Hotspot = {
    id: row.id ?? crypto.randomUUID(),
    count_event_id: row.count_event_id,
    org_id: row.org_id,
    zone_id: row.zone_id ?? null,
    name: row.name,
    description: row.description ?? null,
    hotspot_type: row.hotspot_type ?? 'sighting',
    severity: row.severity ?? 'medium',
    expected_count: row.expected_count ?? null,
    source: row.source ?? null,
    reported_at: row.reported_at ?? null,
    gps_lat: row.gps_lat,
    gps_lng: row.gps_lng,
    location: { type: 'Point', coordinates: [row.gps_lng, row.gps_lat] },
    resolved: row.resolved ?? false,
    resolved_by: row.resolved_by ?? null,
    resolved_at: row.resolved_at ?? null,
    created_by: row.created_by ?? null,
    created_at: row.created_at ?? now,
  };
  const all = demoReadAll();
  all.push(hot);
  demoWriteAll(all);
  return hot;
}

function demoUpdate(id: string, patch: UpdateHotspotInput): Hotspot {
  const all = demoReadAll();
  const idx = all.findIndex((h) => h.id === id);
  if (idx < 0) throw new Error('Hotspot not found.');
  const next: Hotspot = {
    ...all[idx],
    name: patch.name ?? all[idx].name,
    description: patch.description !== undefined ? patch.description : all[idx].description,
    hotspot_type: patch.hotspot_type ?? all[idx].hotspot_type,
    severity: patch.severity ?? all[idx].severity,
    expected_count: patch.expected_count !== undefined ? patch.expected_count : all[idx].expected_count,
    source: patch.source !== undefined ? patch.source : all[idx].source,
    gps_lat: patch.gps_lat ?? all[idx].gps_lat,
    gps_lng: patch.gps_lng ?? all[idx].gps_lng,
    zone_id: patch.zone_id !== undefined ? patch.zone_id : all[idx].zone_id,
  };
  if (patch.gps_lat !== undefined || patch.gps_lng !== undefined) {
    next.location = { type: 'Point', coordinates: [next.gps_lng, next.gps_lat] };
  }
  all[idx] = next;
  demoWriteAll(all);
  return next;
}

function demoToggleResolved(id: string): Hotspot {
  const all = demoReadAll();
  const idx = all.findIndex((h) => h.id === id);
  if (idx < 0) throw new Error('Hotspot not found.');
  const userId = useAuthStore.getState().user?.id ?? null;
  const nowResolved = !all[idx].resolved;
  const next: Hotspot = {
    ...all[idx],
    resolved: nowResolved,
    resolved_by: nowResolved ? userId : null,
    resolved_at: nowResolved ? new Date().toISOString() : null,
  };
  all[idx] = next;
  demoWriteAll(all);
  return next;
}

function demoDelete(id: string): void {
  const all = demoReadAll().filter((h) => h.id !== id);
  demoWriteAll(all);
}
