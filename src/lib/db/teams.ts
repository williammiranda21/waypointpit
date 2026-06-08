import { supabase, supabaseConfigured } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/database.types';

export type Team = Tables<'teams'>;

export interface CreateTeamInput {
  count_event_id: string;
  zone_id: string;
  name: string;
  team_lead_id?: string | null;
}

export interface UpdateTeamInput {
  zone_id?: string;
  name?: string;
  team_lead_id?: string | null;
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

export async function listTeamsForEvent(countEventId: string): Promise<Team[]> {
  if (!supabaseConfigured) return demoList(countEventId);

  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .eq('count_event_id', countEventId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function getTeam(id: string): Promise<Team | null> {
  if (!supabaseConfigured) return demoGet(id);

  const { data, error } = await supabase.from('teams').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function createTeam(input: CreateTeamInput): Promise<Team> {
  const user = useAuthStore.getState().user;
  if (!user) throw new Error('Not signed in.');

  const row: TablesInsert<'teams'> = {
    count_event_id: input.count_event_id,
    org_id: user.orgId,
    zone_id: input.zone_id,
    name: input.name,
    team_lead_id: input.team_lead_id ?? null,
  };

  if (!supabaseConfigured) return demoCreate(row);

  const { data, error } = await supabase.from('teams').insert(row).select('*').single();
  if (error) throw error;
  return data;
}

export async function updateTeam(id: string, patch: UpdateTeamInput): Promise<Team> {
  if (!supabaseConfigured) return demoUpdate(id, patch);

  const update: TablesUpdate<'teams'> = patch;
  const { data, error } = await supabase.from('teams').update(update).eq('id', id).select('*').single();
  if (error) throw error;
  return data;
}

export async function deleteTeam(id: string): Promise<void> {
  if (!supabaseConfigured) {
    demoDelete(id);
    return;
  }
  const { error } = await supabase.from('teams').delete().eq('id', id);
  if (error) throw error;
}

// -----------------------------------------------------------------------------
// Demo-mode storage
// -----------------------------------------------------------------------------

const DEMO_KEY = 'waypoint-pit-demo-teams';

function demoReadAll(): Team[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(window.localStorage.getItem(DEMO_KEY) ?? '[]') as Team[];
  } catch {
    return [];
  }
}

function demoWriteAll(rows: Team[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(DEMO_KEY, JSON.stringify(rows));
}

function demoList(countEventId: string): Team[] {
  return demoReadAll()
    .filter((t) => t.count_event_id === countEventId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

function demoGet(id: string): Team | null {
  return demoReadAll().find((t) => t.id === id) ?? null;
}

function demoCreate(row: TablesInsert<'teams'>): Team {
  const now = new Date().toISOString();
  const team: Team = {
    id: row.id ?? crypto.randomUUID(),
    count_event_id: row.count_event_id,
    org_id: row.org_id,
    zone_id: row.zone_id,
    name: row.name,
    team_lead_id: row.team_lead_id ?? null,
    created_at: row.created_at ?? now,
  };
  const all = demoReadAll();
  all.push(team);
  demoWriteAll(all);
  return team;
}

function demoUpdate(id: string, patch: UpdateTeamInput): Team {
  const all = demoReadAll();
  const idx = all.findIndex((t) => t.id === id);
  if (idx < 0) throw new Error('Team not found.');
  const next: Team = {
    ...all[idx],
    name: patch.name ?? all[idx].name,
    zone_id: patch.zone_id ?? all[idx].zone_id,
    team_lead_id: patch.team_lead_id !== undefined ? patch.team_lead_id : all[idx].team_lead_id,
  };
  all[idx] = next;
  demoWriteAll(all);
  return next;
}

function demoDelete(id: string): void {
  const all = demoReadAll().filter((t) => t.id !== id);
  demoWriteAll(all);
}
