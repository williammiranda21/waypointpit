import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { useEvent } from '@/hooks/useEvents';
import { useZonesForEvent } from '@/hooks/useZones';
import {
  useDeleteTeam,
  useMembersForEvent,
  useProfilesInOrg,
  useTeamsForEvent,
} from '@/hooks/useTeams';
import { TeamFormModal } from './TeamFormModal';

export function TeamsPage() {
  const { id: eventId } = useParams<{ id: string }>();
  const { data: event } = useEvent(eventId);
  const { data: zones = [] } = useZonesForEvent(eventId);
  const { data: profiles = [] } = useProfilesInOrg();
  const { data: teams = [], isLoading } = useTeamsForEvent(eventId);
  const teamIds = useMemo(() => teams.map((t) => t.id), [teams]);
  const { data: members = [] } = useMembersForEvent(eventId, teamIds);
  const deleteMutation = useDeleteTeam(eventId ?? '');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const zoneById = useMemo(() => new Map(zones.map((z) => [z.id, z])), [zones]);
  const profileById = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);
  const membersByTeam = useMemo(() => {
    const map = new Map<string, typeof members>();
    for (const m of members) {
      const list = map.get(m.team_id) ?? [];
      list.push(m);
      map.set(m.team_id, list);
    }
    return map;
  }, [members]);

  if (!eventId) {
    return <p className="text-sm text-status-alert">Missing event id.</p>;
  }

  return (
    <div className="max-w-6xl">
      <Link
        to={`/events/${eventId}`}
        className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-primary mb-3"
      >
        <ArrowLeft size={14} />
        Back to {event?.name ?? 'event'}
      </Link>

      <PageHeader
        title="Teams"
        description="2–6 volunteers each, one designated lead. One team per zone."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus size={16} />
            New Team
          </Button>
        }
      />

      <Card>
        {isLoading && <div className="px-6 py-8 text-sm text-text-muted">Loading teams…</div>}

        {!isLoading && teams.length === 0 && (
          <EmptyState
            icon={<Users size={18} />}
            title="No teams yet"
            description={
              zones.length === 0
                ? 'Add at least one zone first, then create a team to cover it.'
                : 'Create your first team and assign it to a zone.'
            }
            action={
              zones.length === 0 ? (
                <Link to={`/events/${eventId}/zones`}>
                  <Button size="sm">Set up zones</Button>
                </Link>
              ) : (
                <Button size="sm" onClick={() => setCreating(true)}>
                  <Plus size={14} />
                  New Team
                </Button>
              )
            }
          />
        )}

        {teams.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-wp-border">
                  <Th>Team</Th>
                  <Th>Zone</Th>
                  <Th>Lead</Th>
                  <Th>Members</Th>
                  <Th className="hidden md:table-cell">Last activity</Th>
                  <Th className="w-20 text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {teams.map((t) => {
                  const zone = zoneById.get(t.zone_id);
                  const lead = t.team_lead_id ? profileById.get(t.team_lead_id) : null;
                  const teamMembers = membersByTeam.get(t.id) ?? [];
                  const lastSeen = teamMembers
                    .map((m) => m.last_seen_at)
                    .filter((v): v is string => !!v)
                    .sort()
                    .pop();
                  const outOfRange = teamMembers.length < 2 || teamMembers.length > 6;
                  return (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <Td className="font-medium text-text-primary">{t.name}</Td>
                      <Td>
                        {zone ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span
                              className="inline-block h-3 w-3 rounded-sm"
                              style={{ backgroundColor: zone.color }}
                              aria-hidden
                            />
                            {zone.name}
                          </span>
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </Td>
                      <Td>{lead?.full_name ?? <span className="text-text-muted">—</span>}</Td>
                      <Td>
                        <span
                          className={
                            outOfRange
                              ? 'text-status-alert font-medium'
                              : 'text-text-body'
                          }
                          title={outOfRange ? 'Recommended 2–6 members per team' : undefined}
                        >
                          {teamMembers.length}
                        </span>
                      </Td>
                      <Td className="hidden md:table-cell text-text-muted">
                        {lastSeen ? formatRelative(lastSeen) : '—'}
                      </Td>
                      <Td className="text-right">
                        <button
                          type="button"
                          onClick={() => setEditingId(t.id)}
                          className="p-1.5 rounded text-text-muted hover:text-text-primary hover:bg-gray-100"
                          aria-label={`Edit ${t.name}`}
                          title="Edit"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Delete team "${t.name}"?`)) {
                              deleteMutation.mutate(t.id);
                            }
                          }}
                          className="p-1.5 rounded text-text-muted hover:text-status-alert hover:bg-gray-100"
                          aria-label={`Delete ${t.name}`}
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {creating && eventId && (
        <TeamFormModal eventId={eventId} onClose={() => setCreating(false)} />
      )}
      {editingId && eventId && (
        <TeamFormModal
          eventId={eventId}
          teamId={editingId}
          onClose={() => setEditingId(null)}
        />
      )}
    </div>
  );
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={
        'text-left px-6 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted ' +
        className
      }
    >
      {children}
    </th>
  );
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <td className={'px-6 py-3 align-middle border-b border-wp-border ' + className}>
      {children}
    </td>
  );
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
