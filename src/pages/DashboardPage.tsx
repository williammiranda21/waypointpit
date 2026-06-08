import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LayoutGrid, Map as MapIcon, Users } from 'lucide-react';
import { MapView, type MapPolygon } from '@/components/map/MapView';
import type { MapMarker } from '@/components/map/markers';
import { Card } from '@/components/ui/Card';
import { Tabs } from '@/components/ui/Tabs';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatCards } from '@/components/dashboard/StatCards';
import { SilenceBanner, type AlertTeam } from '@/components/dashboard/SilenceBanner';
import { TeamsPanel, type TeamRowData } from '@/components/dashboard/TeamsPanel';
import { ZonesPanel, type ZoneCardData } from '@/components/dashboard/ZonesPanel';
import { SubmissionPopup } from '@/components/dashboard/SubmissionPopup';
import { useEventsList } from '@/hooks/useEvents';
import { useZonesForEvent, zonesKey } from '@/hooks/useZones';
import { useTeamsForEvent, useMembersForEvent } from '@/hooks/useTeams';
import { useSubmissionsForEvent } from '@/hooks/useSubmissions';
import { useDashboardRealtime } from '@/hooks/useDashboardRealtime';
import { updateZone } from '@/lib/db/zones';
import { computeTeamStatus } from '@/lib/teamStatus';
import type { Tables, ZoneStatus } from '@/lib/database.types';

type PanelTab = 'teams' | 'zones';

export function DashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: events = [], isLoading: eventsLoading } = useEventsList();

  // Active event: ?eventId=... or first active event, else most recent.
  const eventId = useMemo(() => {
    const fromParam = searchParams.get('eventId');
    if (fromParam) return fromParam;
    const active = events.find((e) => e.status === 'active');
    if (active) return active.id;
    return events[0]?.id;
  }, [events, searchParams]);

  const event = useMemo(
    () => events.find((e) => e.id === eventId) ?? null,
    [events, eventId],
  );

  useDashboardRealtime(eventId);

  if (eventsLoading) {
    return <p className="text-sm text-text-muted">Loading events…</p>;
  }

  if (!event) {
    return (
      <Card>
        <EmptyState
          icon={<MapIcon size={18} />}
          title="No events yet"
          description="Create a count event to see the coordinator dashboard."
        />
      </Card>
    );
  }

  return (
    <DashboardContent
      event={event}
      events={events}
      onEventChange={(id) => setSearchParams({ eventId: id })}
    />
  );
}

interface DashboardContentProps {
  event: Tables<'count_events'>;
  events: Tables<'count_events'>[];
  onEventChange: (id: string) => void;
}

function DashboardContent({ event, events, onEventChange }: DashboardContentProps) {
  const eventId = event.id;
  const [tab, setTab] = useState<PanelTab>('teams');
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);

  const qc = useQueryClient();
  const { data: zones = [] } = useZonesForEvent(eventId);
  const { data: teams = [] } = useTeamsForEvent(eventId);
  const teamIds = useMemo(() => teams.map((t) => t.id), [teams]);
  const { data: members = [] } = useMembersForEvent(eventId, teamIds);
  const { data: submissions = [] } = useSubmissionsForEvent(eventId);

  const setStatusMutation = useMutation({
    mutationFn: ({ zoneId, status }: { zoneId: string; status: ZoneStatus }) =>
      updateZone(zoneId, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: zonesKey.forEvent(eventId) }),
  });

  // -------- Lookups --------
  const zoneById = useMemo(() => new Map(zones.map((z) => [z.id, z])), [zones]);
  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const membersByTeam = useMemo(() => {
    const m = new Map<string, typeof members>();
    for (const row of members) {
      const list = m.get(row.team_id) ?? [];
      list.push(row);
      m.set(row.team_id, list);
    }
    return m;
  }, [members]);
  const teamByZone = useMemo(() => {
    const m = new Map<string, (typeof teams)[number]>();
    for (const t of teams) m.set(t.zone_id, t);
    return m;
  }, [teams]);

  // -------- Per-team aggregates --------
  const teamAggregates = useMemo(() => {
    const out = new Map<string, { persons: number; submissions: number }>();
    for (const s of submissions) {
      const a = out.get(s.team_id) ?? { persons: 0, submissions: 0 };
      a.persons += s.person_count;
      a.submissions += 1;
      out.set(s.team_id, a);
    }
    return out;
  }, [submissions]);

  // -------- Stats --------
  const stats = useMemo(() => {
    const totalPersons = submissions.reduce((sum, s) => sum + s.person_count, 0);
    const zonesComplete = zones.filter((z) => z.status === 'complete').length;
    const teamsActive = teams.filter((t) => {
      const status = computeTeamStatus({
        members: membersByTeam.get(t.id) ?? [],
        zoneStatus: zoneById.get(t.zone_id)?.status ?? 'not_started',
      });
      return status === 'active';
    }).length;
    return {
      totalPersons,
      submissions: submissions.length,
      zonesComplete,
      zonesTotal: zones.length,
      teamsActive,
      teamsTotal: teams.length,
    };
  }, [submissions, zones, teams, membersByTeam, zoneById]);

  // -------- Silence alerts --------
  const alerts: AlertTeam[] = useMemo(() => {
    const out: AlertTeam[] = [];
    for (const t of teams) {
      const zone = zoneById.get(t.zone_id);
      if (!zone) continue;
      const teamMembers = membersByTeam.get(t.id) ?? [];
      const status = computeTeamStatus({
        members: teamMembers,
        zoneStatus: zone.status,
      });
      if (status !== 'alert') continue;
      const lastSeenAt =
        teamMembers
          .map((m) => m.last_seen_at)
          .filter((v): v is string => !!v)
          .sort()
          .reverse()[0] ?? null;
      out.push({
        teamId: t.id,
        teamName: t.name,
        zoneName: zone.name,
        lastSeenAt,
      });
    }
    return out;
  }, [teams, zoneById, membersByTeam]);

  // -------- Map data --------
  const polygons: MapPolygon[] = useMemo(
    () =>
      zones.map((z) => ({
        id: z.id,
        name: z.name,
        geometry: z.geometry,
        color: z.color,
      })),
    [zones],
  );

  const visibleSubmissions = useMemo(() => {
    if (selectedTeamId) return submissions.filter((s) => s.team_id === selectedTeamId);
    if (selectedZoneId) return submissions.filter((s) => s.zone_id === selectedZoneId);
    return submissions;
  }, [submissions, selectedTeamId, selectedZoneId]);

  const markers: MapMarker[] = useMemo(
    () =>
      visibleSubmissions.map((s) => ({
        id: s.id,
        lng: s.gps_lng,
        lat: s.gps_lat,
        // Green resource-style dot per spec.
        hotspot_type: 'resource',
        severity: 'low',
        expected_count: s.person_count,
        resolved: false,
        label: `${s.person_count} · ${s.location_type}`,
      })),
    [visibleSubmissions],
  );

  const selectedSubmission = useMemo(
    () =>
      selectedSubmissionId
        ? submissions.find((s) => s.id === selectedSubmissionId) ?? null
        : null,
    [submissions, selectedSubmissionId],
  );

  // -------- Team rows --------
  const teamRows: TeamRowData[] = useMemo(
    () =>
      teams.map((t) => {
        const zone = zoneById.get(t.zone_id);
        const teamMembers = membersByTeam.get(t.id) ?? [];
        const agg = teamAggregates.get(t.id) ?? { persons: 0, submissions: 0 };
        const lastSeenAt =
          teamMembers
            .map((m) => m.last_seen_at)
            .filter((v): v is string => !!v)
            .sort()
            .reverse()[0] ?? null;
        return {
          teamId: t.id,
          teamName: t.name,
          zoneName: zone?.name ?? 'Unknown',
          zoneColor: zone?.color ?? '#9CA3AF',
          zoneStatus: zone?.status ?? 'not_started',
          personCount: agg.persons,
          submissionCount: agg.submissions,
          lastSeenAt,
          members: teamMembers,
        };
      }),
    [teams, zoneById, membersByTeam, teamAggregates],
  );

  // -------- Zone cards --------
  const zoneCards: ZoneCardData[] = useMemo(
    () =>
      zones.map((z) => {
        const team = teamByZone.get(z.id);
        const agg = team ? teamAggregates.get(team.id) : undefined;
        return {
          zoneId: z.id,
          zoneName: z.name,
          zoneColor: z.color,
          zoneStatus: z.status,
          teamName: team?.name ?? null,
          personCount: agg?.persons ?? 0,
          submissionCount: agg?.submissions ?? 0,
        };
      }),
    [zones, teamByZone, teamAggregates],
  );

  const highlightId =
    selectedZoneId ??
    (selectedTeamId ? teamById.get(selectedTeamId)?.zone_id : undefined) ??
    undefined;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Coordinator Dashboard"
        description={`Live view — ${event.name} (${formatEventDate(event.count_date)})`}
        actions={
          events.length > 1 ? (
            <select
              value={event.id}
              onChange={(e) => onEventChange(e.target.value)}
              className="h-10 rounded-lg border border-wp-border bg-white px-3 text-sm"
              aria-label="Select event"
            >
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          ) : null
        }
      />

      <SilenceBanner alerts={alerts} />

      <StatCards stats={stats} />

      <div className="grid grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)] gap-4">
        <Card className="flex flex-col overflow-hidden lg:h-[calc(100vh-360px)] lg:min-h-[480px]">
          <div className="px-3 pt-3 pb-2 border-b border-wp-border">
            <Tabs
              activeId={tab}
              onChange={(id) => setTab(id as PanelTab)}
              items={[
                { id: 'teams', label: 'Teams', icon: <Users size={14} />, count: teamRows.length },
                { id: 'zones', label: 'Zones', icon: <LayoutGrid size={14} />, count: zoneCards.length },
              ]}
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            {tab === 'teams' ? (
              <TeamsPanel
                rows={teamRows}
                selectedTeamId={selectedTeamId}
                onSelect={(id) => {
                  setSelectedTeamId(id);
                  setSelectedZoneId(null);
                }}
              />
            ) : (
              <ZonesPanel
                rows={zoneCards}
                selectedZoneId={selectedZoneId}
                onSelect={(id) => {
                  setSelectedZoneId(id);
                  setSelectedTeamId(null);
                }}
                onSetStatus={(zoneId, status) =>
                  setStatusMutation.mutate({ zoneId, status })
                }
                isUpdating={setStatusMutation.isPending}
              />
            )}
          </div>
        </Card>

        <Card className="relative overflow-hidden lg:h-[calc(100vh-360px)] lg:min-h-[480px]">
          {zones.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<MapIcon size={18} />}
                title="No zones defined"
                description="Add zones to this event to populate the map."
              />
            </div>
          ) : (
            <>
              <MapView
                polygons={polygons}
                markers={markers}
                highlightId={highlightId}
                onMarkerClick={(id) => setSelectedSubmissionId(id)}
                className="absolute inset-0"
              />
              {selectedSubmission && (
                <SubmissionPopup
                  submission={selectedSubmission}
                  teamName={teamById.get(selectedSubmission.team_id)?.name ?? null}
                  zoneName={zoneById.get(selectedSubmission.zone_id)?.name ?? null}
                  onClose={() => setSelectedSubmissionId(null)}
                />
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

function formatEventDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
