import { supabase, supabaseConfigured } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import type { Tables, GeoJSONPolygon } from '@/lib/database.types';

export type ZoneTemplate = Tables<'zone_templates'>;

/**
 * Templates the current user can pick from when creating a zone.
 *
 * Real mode: org-scoped + global (NULL org_id). RLS already enforces this.
 * Demo mode: hardcoded mirror of supabase/seed.sql so the UI is usable
 * without a real Supabase project.
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
  return data ?? [];
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

function demoTemplates(): ZoneTemplate[] {
  return DEMO_TEMPLATES.slice().sort((a, b) => a.name.localeCompare(b.name));
}
