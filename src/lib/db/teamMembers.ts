import { supabase, supabaseConfigured } from '@/lib/supabase';
import type { Tables, TablesInsert } from '@/lib/database.types';

export type TeamMember = Tables<'team_members'>;

export interface SetMembersInput {
  team_id: string;
  /** User ids in the team. The lead is included here too with role_in_team='lead'. */
  members: Array<{ user_id: string; role_in_team: 'lead' | 'volunteer' }>;
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

export async function listMembersForTeam(teamId: string): Promise<TeamMember[]> {
  if (!supabaseConfigured) return demoListFor(teamId);

  const { data, error } = await supabase
    .from('team_members')
    .select('*')
    .eq('team_id', teamId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function listMembersForTeams(teamIds: string[]): Promise<TeamMember[]> {
  if (teamIds.length === 0) return [];
  if (!supabaseConfigured) return demoListForTeams(teamIds);

  const { data, error } = await supabase
    .from('team_members')
    .select('*')
    .in('team_id', teamIds);

  if (error) throw error;
  return data ?? [];
}

/**
 * Heartbeat: stamp `last_seen_at = now` for the given (team, user) row.
 * Used by the volunteer field app on a ~10-min interval so the coordinator
 * dashboard can show which teams are active/silent/alerting.
 */
export async function upsertLastSeen(teamId: string, userId: string): Promise<void> {
  const now = new Date().toISOString();

  if (!supabaseConfigured) {
    const all = demoReadAll();
    const idx = all.findIndex((m) => m.team_id === teamId && m.user_id === userId);
    if (idx >= 0) {
      all[idx] = { ...all[idx], last_seen_at: now };
    } else {
      // Volunteer fallback: synthesize a row so the demo dashboard works even
      // for users not pre-seeded as members of the team.
      all.push({
        id: crypto.randomUUID(),
        team_id: teamId,
        user_id: userId,
        role_in_team: 'volunteer',
        last_seen_at: now,
        created_at: now,
      });
    }
    demoWriteAll(all);
    return;
  }

  const { error } = await supabase
    .from('team_members')
    .update({ last_seen_at: now })
    .eq('team_id', teamId)
    .eq('user_id', userId);
  if (error) throw error;
}

/**
 * Full replace of a team's roster. Deletes any rows not in the new set and
 * inserts new ones. Simpler to reason about than partial diffs from the UI.
 */
export async function setTeamMembers(input: SetMembersInput): Promise<TeamMember[]> {
  if (!supabaseConfigured) return demoSetMembers(input);

  const { error: delErr } = await supabase
    .from('team_members')
    .delete()
    .eq('team_id', input.team_id);
  if (delErr) throw delErr;

  if (input.members.length === 0) return [];

  const rows: TablesInsert<'team_members'>[] = input.members.map((m) => ({
    team_id: input.team_id,
    user_id: m.user_id,
    role_in_team: m.role_in_team,
  }));
  const { data, error } = await supabase.from('team_members').insert(rows).select('*');
  if (error) throw error;
  return data ?? [];
}

// -----------------------------------------------------------------------------
// Demo-mode storage
// -----------------------------------------------------------------------------

const DEMO_KEY = 'waypoint-pit-demo-team-members';

function demoReadAll(): TeamMember[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(window.localStorage.getItem(DEMO_KEY) ?? '[]') as TeamMember[];
  } catch {
    return [];
  }
}

function demoWriteAll(rows: TeamMember[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(DEMO_KEY, JSON.stringify(rows));
}

function demoListFor(teamId: string): TeamMember[] {
  return demoReadAll().filter((m) => m.team_id === teamId);
}

function demoListForTeams(teamIds: string[]): TeamMember[] {
  const set = new Set(teamIds);
  return demoReadAll().filter((m) => set.has(m.team_id));
}

function demoSetMembers(input: SetMembersInput): TeamMember[] {
  const all = demoReadAll().filter((m) => m.team_id !== input.team_id);
  const now = new Date().toISOString();
  const next: TeamMember[] = input.members.map((m) => ({
    id: crypto.randomUUID(),
    team_id: input.team_id,
    user_id: m.user_id,
    role_in_team: m.role_in_team,
    last_seen_at: null,
    created_at: now,
  }));
  const combined = [...all, ...next];
  demoWriteAll(combined);
  return next;
}
