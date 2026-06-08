import { listEvents } from '@/lib/db/events';
import { listTeamsForEvent } from '@/lib/db/teams';
import { listMembersForTeam } from '@/lib/db/teamMembers';
import { listZonesForEvent } from '@/lib/db/zones';
import { supabaseConfigured } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import type { CountEvent } from '@/lib/db/events';
import type { Team } from '@/lib/db/teams';
import type { Zone } from '@/lib/db/zones';

export interface ActiveSession {
  event: CountEvent;
  team: Team;
  zone: Zone;
}

/**
 * Resolves which event/team/zone a volunteer is working on right now.
 *
 * Real mode: walks active count_events in the user's org, finds the first team
 * the user is a member of. If the user is on multiple, picks the one in the
 * most recent count_date event.
 *
 * Demo mode: same lookup, but if the user has no team memberships, falls back
 * to the first team of the first active event so the demo UI is usable. (Real
 * mode never falls back — strict membership is required.)
 */
export async function findActiveSession(): Promise<ActiveSession | null> {
  const user = useAuthStore.getState().user;
  if (!user) return null;

  const events = await listEvents(user.orgId);
  const active = events
    .filter((e) => e.status === 'active')
    .sort((a, b) => b.count_date.localeCompare(a.count_date));

  for (const event of active) {
    const teams = await listTeamsForEvent(event.id);
    for (const team of teams) {
      const members = await listMembersForTeam(team.id);
      if (members.some((m) => m.user_id === user.id)) {
        const zones = await listZonesForEvent(event.id);
        const zone = zones.find((z) => z.id === team.zone_id);
        if (zone) return { event, team, zone };
      }
    }
  }

  // Demo-mode fallback: no membership found anywhere — return the first team
  // of the first active event so the demo experience isn't dead-end.
  if (!supabaseConfigured) {
    for (const event of active) {
      const teams = await listTeamsForEvent(event.id);
      const team = teams[0];
      if (!team) continue;
      const zones = await listZonesForEvent(event.id);
      const zone = zones.find((z) => z.id === team.zone_id);
      if (zone) return { event, team, zone };
    }
  }

  return null;
}
