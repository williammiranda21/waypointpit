import { createZone, listZonesForEvent } from './zones';
import { createTeam, listTeamsForEvent } from './teams';
import { listMembersForTeams, setTeamMembers } from './teamMembers';
import { createHotspotsBatch, listHotspotsForEvent } from './hotspots';

export interface CloneSummary {
  zonesCopied: number;
  teamsCopied: number;
  membersCopied: number;
  hotspotsCopied: number;
}

/**
 * Copies the operational setup from one count event into another:
 *   - All zones (geometry + color + name + status reset to 'not_started')
 *   - All teams (with zone_id remapped to the new zone copies + same lead)
 *   - All team_members (with team_id remapped)
 *   - All UNRESOLVED hotspots (zone_id remapped; resolved=false reset; expected_count preserved)
 *
 * Submissions are intentionally NOT copied — each count is its own dataset.
 *
 * Runs sequentially in app code (vs. a SQL function) so it works identically
 * in real mode and demo mode. For very large events we could later move this
 * into a Postgres function to wrap it in a transaction.
 */
export async function cloneEventSetup(
  sourceEventId: string,
  targetEventId: string,
): Promise<CloneSummary> {
  // ---- Zones ----
  const sourceZones = await listZonesForEvent(sourceEventId);
  const zoneIdMap = new Map<string, string>();
  for (const z of sourceZones) {
    const created = await createZone({
      count_event_id: targetEventId,
      name: z.name,
      geometry: z.geometry,
      color: z.color,
      status: 'not_started', // fresh start
      template_id: z.template_id,
    });
    zoneIdMap.set(z.id, created.id);
  }

  // ---- Teams ----
  const sourceTeams = await listTeamsForEvent(sourceEventId);
  const teamIdMap = new Map<string, string>();
  for (const t of sourceTeams) {
    const newZoneId = zoneIdMap.get(t.zone_id);
    if (!newZoneId) continue; // shouldn't happen — source teams point at source zones
    const created = await createTeam({
      count_event_id: targetEventId,
      zone_id: newZoneId,
      name: t.name,
      team_lead_id: t.team_lead_id,
    });
    teamIdMap.set(t.id, created.id);
  }

  // ---- Team members ----
  let membersCopied = 0;
  const sourceTeamIds = Array.from(teamIdMap.keys());
  const sourceMembers = await listMembersForTeams(sourceTeamIds);
  // Group by source team_id
  const bySource = new Map<string, typeof sourceMembers>();
  for (const m of sourceMembers) {
    const arr = bySource.get(m.team_id) ?? [];
    arr.push(m);
    bySource.set(m.team_id, arr);
  }
  for (const [sourceTeamId, members] of bySource) {
    const newTeamId = teamIdMap.get(sourceTeamId);
    if (!newTeamId) continue;
    const created = await setTeamMembers({
      team_id: newTeamId,
      members: members.map((m) => ({ user_id: m.user_id, role_in_team: m.role_in_team })),
    });
    membersCopied += created.length;
  }

  // ---- Hotspots (unresolved only) ----
  const sourceHotspots = await listHotspotsForEvent(sourceEventId);
  const unresolved = sourceHotspots.filter((h) => !h.resolved);
  let hotspotsCopied = 0;
  if (unresolved.length > 0) {
    const created = await createHotspotsBatch(
      unresolved.map((h) => ({
        count_event_id: targetEventId,
        name: h.name,
        description: h.description,
        hotspot_type: h.hotspot_type,
        severity: h.severity,
        expected_count: h.expected_count,
        source: h.source,
        gps_lat: h.gps_lat,
        gps_lng: h.gps_lng,
        // zone_id auto-assigned by createHotspot via pointInPolygon against the new event's zones.
      })),
    );
    hotspotsCopied = created.length;
  }

  return {
    zonesCopied: sourceZones.length,
    teamsCopied: sourceTeams.length,
    membersCopied,
    hotspotsCopied,
  };
}
