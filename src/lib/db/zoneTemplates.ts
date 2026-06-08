import { supabase, supabaseConfigured } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import type { Tables, GeoJSONPolygon } from '@/lib/database.types';

export type ZoneTemplate = Tables<'zone_templates'>;

export interface NewZoneTemplate {
  name: string;
  geometry: GeoJSONPolygon;
  color: string;
}

/**
 * Templates the current user can pick from when creating a zone.
 *
 * If the org has imported its OWN templates, we show only those (the generic
 * global starters drop out of view). Otherwise we fall back to the global set.
 * Real mode: org-scoped + global (NULL org_id), filtered here. Demo mode mirrors
 * supabase/seed.sql plus any org templates saved to localStorage.
 */
export async function listZoneTemplates(): Promise<ZoneTemplate[]> {
  if (!supabaseConfigured) return demoTemplates();

  const orgId = useAuthStore.getState().user?.orgId;
  const { data, error } = await supabase
    .from('zone_templates')
    .select('*')
    .or(orgId ? `org_id.is.null,org_id.eq.${orgId}` : 'org_id.is.null')
    .order('name', { ascending: true });

  if (error) throw error;
  const all = data ?? [];
  const orgOwned = all.filter((t) => t.org_id && t.org_id === orgId);
  return orgOwned.length > 0 ? orgOwned : all;
}

/** Save imported zones into the org's reusable template library. */
export async function createZoneTemplates(items: NewZoneTemplate[]): Promise<void> {
  const orgId = useAuthStore.getState().user?.orgId;
  if (!supabaseConfigured) {
    demoAddTemplates(items, orgId ?? 'demo-org');
    return;
  }
  if (!orgId) throw new Error('Not signed in.');
  const rows = items.map((it) => ({
    name: it.name,
    geometry: it.geometry,
    default_color: it.color,
    org_id: orgId,
  }));
  const { error } = await supabase.from('zone_templates').insert(rows);
  if (error) throw error;
}

export async function deleteZoneTemplate(id: string): Promise<void> {
  if (!supabaseConfigured) {
    demoDeleteTemplate(id);
    return;
  }
  const { error } = await supabase.from('zone_templates').delete().eq('id', id);
  if (error) throw error;
}

// -----------------------------------------------------------------------------
// Demo seed — must stay in sync with supabase/seed.sql
// -----------------------------------------------------------------------------

function poly(coords: number[][]): GeoJSONPolygon {
  // GeoJSON requires the polygon to close (first === last). The 5th vertex
  // here closes each rectangle back to the starting point.
  return { type: 'Polygon', coordinates: [coords] };
}

const DEMO_TEMPLATES: ZoneTemplate[] = [
  {
    id: 'tpl-downtown-miami',
    org_id: null,
    name: 'Downtown Miami',
    default_color: '#22C55E',
    created_at: '2026-05-27T00:00:00Z',
    geometry: poly([
      [-80.205, 25.755],
      [-80.18, 25.755],
      [-80.18, 25.785],
      [-80.205, 25.785],
      [-80.205, 25.755],
    ]),
  },
  {
    id: 'tpl-miami-beach',
    org_id: null,
    name: 'Miami Beach',
    default_color: '#3B82F6',
    created_at: '2026-05-27T00:00:00Z',
    geometry: poly([
      [-80.14, 25.76],
      [-80.12, 25.76],
      [-80.12, 25.87],
      [-80.14, 25.87],
      [-80.14, 25.76],
    ]),
  },
  {
    id: 'tpl-north-miami-dade',
    org_id: null,
    name: 'North Miami-Dade',
    default_color: '#8B5CF6',
    created_at: '2026-05-27T00:00:00Z',
    geometry: poly([
      [-80.3, 25.87],
      [-80.14, 25.87],
      [-80.14, 25.98],
      [-80.3, 25.98],
      [-80.3, 25.87],
    ]),
  },
  {
    id: 'tpl-south-dade',
    org_id: null,
    name: 'South Dade',
    default_color: '#F59E0B',
    created_at: '2026-05-27T00:00:00Z',
    geometry: poly([
      [-80.43, 25.45],
      [-80.25, 25.45],
      [-80.25, 25.62],
      [-80.43, 25.62],
      [-80.43, 25.45],
    ]),
  },
  {
    id: 'tpl-unincorporated-miami-dade',
    org_id: null,
    name: 'Unincorporated Miami-Dade',
    default_color: '#EC4899',
    created_at: '2026-05-27T00:00:00Z',
    geometry: poly([
      [-80.48, 25.62],
      [-80.205, 25.62],
      [-80.205, 25.84],
      [-80.48, 25.84],
      [-80.48, 25.62],
    ]),
  },
  {
    id: 'tpl-hialeah',
    org_id: null,
    name: 'Hialeah',
    default_color: '#14B8A6',
    created_at: '2026-05-27T00:00:00Z',
    geometry: poly([
      [-80.33, 25.84],
      [-80.26, 25.84],
      [-80.26, 25.89],
      [-80.33, 25.89],
      [-80.33, 25.84],
    ]),
  },
  {
    id: 'tpl-homestead-florida-city',
    org_id: null,
    name: 'Homestead/Florida City',
    default_color: '#EF4444',
    created_at: '2026-05-27T00:00:00Z',
    geometry: poly([
      [-80.5, 25.42],
      [-80.43, 25.42],
      [-80.43, 25.5],
      [-80.5, 25.5],
      [-80.5, 25.42],
    ]),
  },
  {
    id: 'tpl-key-biscayne-coconut-grove',
    org_id: null,
    name: 'Key Biscayne/Coconut Grove',
    default_color: '#06B6D4',
    created_at: '2026-05-27T00:00:00Z',
    geometry: poly([
      [-80.26, 25.69],
      [-80.14, 25.69],
      [-80.14, 25.755],
      [-80.26, 25.755],
      [-80.26, 25.69],
    ]),
  },
];

// Org templates saved in demo mode live in localStorage; once present they
// replace the global starters (mirrors the real-mode "prefer org" behavior).
const DEMO_ORG_TPL_KEY = 'waypoint-pit-demo-zone-templates';

function demoReadOrgTemplates(): ZoneTemplate[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(window.localStorage.getItem(DEMO_ORG_TPL_KEY) ?? '[]') as ZoneTemplate[];
  } catch {
    return [];
  }
}

function demoWriteOrgTemplates(rows: ZoneTemplate[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(DEMO_ORG_TPL_KEY, JSON.stringify(rows));
}

function demoAddTemplates(items: NewZoneTemplate[], orgId: string): void {
  const now = new Date().toISOString();
  const rows: ZoneTemplate[] = items.map((it) => ({
    id: crypto.randomUUID(),
    org_id: orgId,
    name: it.name,
    default_color: it.color,
    geometry: it.geometry,
    created_at: now,
  }));
  demoWriteOrgTemplates([...demoReadOrgTemplates(), ...rows]);
}

function demoDeleteTemplate(id: string): void {
  demoWriteOrgTemplates(demoReadOrgTemplates().filter((t) => t.id !== id));
}

function demoTemplates(): ZoneTemplate[] {
  const org = demoReadOrgTemplates();
  const base = org.length > 0 ? org : DEMO_TEMPLATES;
  return base.slice().sort((a, b) => a.name.localeCompare(b.name));
}
