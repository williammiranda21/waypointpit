import { supabase, supabaseConfigured } from '@/lib/supabase';
import type { Tables } from '@/lib/database.types';

export type Profile = Tables<'profiles'>;

/**
 * Profiles in the current org. Used by the team manager to populate
 * lead and member pickers.
 */
export async function listProfilesInOrg(orgId: string): Promise<Profile[]> {
  if (!supabaseConfigured) return demoProfiles(orgId);

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('org_id', orgId)
    .order('full_name', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

// -----------------------------------------------------------------------------
// Demo mode: a fixed roster so the team manager is usable without Supabase.
// -----------------------------------------------------------------------------

const DEMO_NOW = '2026-05-27T00:00:00Z';

function profile(
  id: string,
  fullName: string,
  email: string,
  role: Profile['role'],
  orgId: string,
): Profile {
  return {
    id,
    org_id: orgId,
    full_name: fullName,
    email,
    role,
    preferred_language: 'en',
    created_at: DEMO_NOW,
  };
}

function demoProfiles(orgId: string): Profile[] {
  return [
    profile('demo-lead-aiyana',    'Aiyana Cole',       'aiyana.cole@example.org',     'team_lead', orgId),
    profile('demo-lead-marcus',    'Marcus Reyes',      'marcus.reyes@example.org',    'team_lead', orgId),
    profile('demo-lead-priya',     'Priya Shah',        'priya.shah@example.org',      'team_lead', orgId),
    profile('demo-vol-juan',       'Juan Diaz',         'juan.diaz@example.org',       'volunteer', orgId),
    profile('demo-vol-tasha',      'Tasha Williams',    'tasha.williams@example.org',  'volunteer', orgId),
    profile('demo-vol-leon',       'Leon Park',         'leon.park@example.org',       'volunteer', orgId),
    profile('demo-vol-sofia',      'Sofia Rivera',      'sofia.rivera@example.org',    'volunteer', orgId),
    profile('demo-vol-omar',       'Omar Hassan',       'omar.hassan@example.org',     'volunteer', orgId),
    profile('demo-vol-niko',       'Niko Petrakis',     'niko.petrakis@example.org',   'volunteer', orgId),
    profile('demo-vol-elena',      'Elena Morales',     'elena.morales@example.org',   'volunteer', orgId),
    profile('demo-vol-mira',       'Mira Cohen',        'mira.cohen@example.org',      'volunteer', orgId),
    profile('demo-vol-darnell',    'Darnell Brooks',    'darnell.brooks@example.org',  'volunteer', orgId),
  ];
}
