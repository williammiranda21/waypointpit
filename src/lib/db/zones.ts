import { supabase, supabaseConfigured } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import type {
  GeoJSONPolygon,
  Tables,
  TablesInsert,
  TablesUpdate,
  ZoneStatus,
} from '@/lib/database.types';

export type Zone = Tables<'zones'>;

export interface CreateZoneInput {
  count_event_id: string;
  name: string;
  geometry: GeoJSONPolygon;
  color?: string;
  status?: ZoneStatus;
  template_id?: string | null;
}

export interface UpdateZoneInput {
  name?: string;
  geometry?: GeoJSONPolygon;
  color?: string;
  status?: ZoneStatus;
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

export async function listZonesForEvent(countEventId: string): Promise<Zone[]> {
  if (!supabaseConfigured) return demoList(countEventId);

  const { data, error } = await supabase
    .from('zones')
    .select('*')
    .eq('count_event_id', countEventId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function createZone(input: CreateZoneInput): Promise<Zone> {
  const user = useAuthStore.getState().user;
  if (!user) throw new Error('Not signed in.');

  const row: TablesInsert<'zones'> = {
    count_event_id: input.count_event_id,
    org_id: user.orgId,
    name: input.name,
    geometry: input.geometry,
    color: input.color ?? '#22C55E',
    status: input.status ?? 'not_started',
    template_id: input.template_id ?? null,
  };

  if (!supabaseConfigured) return demoCreate(row);

  const { data, error } = await supabase
    .from('zones')
    .insert(row)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function updateZone(id: string, patch: UpdateZoneInput): Promise<Zone> {
  if (!supabaseConfigured) return demoUpdate(id, patch);

  const update: TablesUpdate<'zones'> = patch;
  const { data, error } = await supabase
    .from('zones')
    .update(update)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function deleteZone(id: string): Promise<void> {
  if (!supabaseConfigured) {
    demoDelete(id);
    return;
  }

  const { error } = await supabase.from('zones').delete().eq('id', id);
  if (error) throw error;
}

// -----------------------------------------------------------------------------
// Demo-mode storage
// -----------------------------------------------------------------------------

const DEMO_KEY = 'waypoint-pit-demo-zones';

function demoReadAll(): Zone[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(window.localStorage.getItem(DEMO_KEY) ?? '[]') as Zone[];
  } catch {
    return [];
  }
}

function demoWriteAll(rows: Zone[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(DEMO_KEY, JSON.stringify(rows));
}

function demoList(countEventId: string): Zone[] {
  return demoReadAll()
    .filter((z) => z.count_event_id === countEventId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

function demoCreate(row: TablesInsert<'zones'>): Zone {
  const now = new Date().toISOString();
  const zone: Zone = {
    id: row.id ?? crypto.randomUUID(),
    count_event_id: row.count_event_id,
    org_id: row.org_id,
    name: row.name,
    geometry: row.geometry,
    color: row.color ?? '#22C55E',
    status: row.status ?? 'not_started',
    template_id: row.template_id ?? null,
    created_at: row.created_at ?? now,
  };
  const all = demoReadAll();
  all.push(zone);
  demoWriteAll(all);
  return zone;
}

function demoUpdate(id: string, patch: UpdateZoneInput): Zone {
  const all = demoReadAll();
  const idx = all.findIndex((z) => z.id === id);
  if (idx < 0) throw new Error('Zone not found.');
  const next: Zone = {
    ...all[idx],
    name: patch.name ?? all[idx].name,
    geometry: patch.geometry ?? all[idx].geometry,
    color: patch.color ?? all[idx].color,
    status: patch.status ?? all[idx].status,
  };
  all[idx] = next;
  demoWriteAll(all);
  return next;
}

function demoDelete(id: string): void {
  const all = demoReadAll().filter((z) => z.id !== id);
  demoWriteAll(all);
}
