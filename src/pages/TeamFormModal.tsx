import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { MultiSelect, type MultiSelectOption } from '@/components/ui/MultiSelect';
import { useZonesForEvent } from '@/hooks/useZones';
import {
  useCreateTeam,
  useMembersForTeam,
  useProfilesInOrg,
  useSetTeamMembers,
  useTeam,
  useUpdateTeam,
} from '@/hooks/useTeams';

interface TeamFormModalProps {
  eventId: string;
  /** If set, the modal is in edit mode. */
  teamId?: string;
  onClose: () => void;
}

export function TeamFormModal({ eventId, teamId, onClose }: TeamFormModalProps) {
  const editing = !!teamId;
  const { data: zones = [] } = useZonesForEvent(eventId);
  const { data: profiles = [] } = useProfilesInOrg();
  const { data: existingTeam } = useTeam(teamId);
  const { data: existingMembers = [] } = useMembersForTeam(teamId);
  const createMutation = useCreateTeam(eventId);
  const updateMutation = useUpdateTeam(eventId);
  const setMembersMutation = useSetTeamMembers(eventId);

  const [name, setName] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [leadId, setLeadId] = useState<string>('');
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Hydrate from existing team in edit mode (once).
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (!editing || hydrated) return;
    if (existingTeam) {
      setName(existingTeam.name);
      setZoneId(existingTeam.zone_id);
      setLeadId(existingTeam.team_lead_id ?? '');
    }
    if (existingTeam && existingMembers) {
      const ids = existingMembers
        .filter((m) => m.role_in_team === 'volunteer')
        .map((m) => m.user_id);
      // If a lead exists in members too, surface it as the lead picker value
      // (createTeam stores team_lead_id; setTeamMembers also stores them as 'lead' rows).
      setMemberIds(ids);
      setHydrated(true);
    }
  }, [editing, hydrated, existingTeam, existingMembers]);

  // Default the zone to the only one available in create mode (saves a click
  // when there's exactly one zone).
  useEffect(() => {
    if (!editing && zones.length === 1 && !zoneId) {
      setZoneId(zones[0].id);
    }
  }, [editing, zones, zoneId]);

  const memberOptions: MultiSelectOption[] = useMemo(
    () =>
      profiles.map((p) => ({
        id: p.id,
        label: p.full_name,
        sublabel: `${p.role.replace('_', ' ')} · ${p.email}`,
      })),
    [profiles],
  );

  const memberCount = memberIds.length + (leadId ? 1 : 0);
  const outOfRange = memberCount < 2 || memberCount > 6;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Team name is required.');
      return;
    }
    if (!zoneId) {
      setError('Pick a zone.');
      return;
    }

    try {
      let savedTeamId: string;
      if (editing && teamId) {
        await updateMutation.mutateAsync({
          id: teamId,
          patch: { name: name.trim(), zone_id: zoneId, team_lead_id: leadId || null },
        });
        savedTeamId = teamId;
      } else {
        const team = await createMutation.mutateAsync({
          name: name.trim(),
          zone_id: zoneId,
          team_lead_id: leadId || null,
        });
        savedTeamId = team.id;
      }

      const memberRows = [
        ...(leadId ? [{ user_id: leadId, role_in_team: 'lead' as const }] : []),
        ...memberIds.map((id) => ({ user_id: id, role_in_team: 'volunteer' as const })),
      ];
      await setMembersMutation.mutateAsync({ team_id: savedTeamId, members: memberRows });

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save team.');
    }
  };

  const pending = createMutation.isPending || updateMutation.isPending || setMembersMutation.isPending;

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-lg my-8">
        <div className="flex items-center justify-between border-b border-wp-border px-5 py-3">
          <h2 className="text-base font-semibold text-text-primary">
            {editing ? 'Edit team' : 'New team'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-text-muted hover:bg-gray-100"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <div>
            <label htmlFor="team_name" className="block text-sm font-medium text-text-body mb-1.5">
              Name <span className="text-status-alert">*</span>
            </label>
            <Input
              id="team_name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Team 7 — Wynwood"
              required
            />
          </div>

          <div>
            <label htmlFor="team_zone" className="block text-sm font-medium text-text-body mb-1.5">
              Zone <span className="text-status-alert">*</span>
            </label>
            <select
              id="team_zone"
              value={zoneId}
              onChange={(e) => setZoneId(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
              required
            >
              <option value="">Pick a zone…</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
            </select>
            {zones.length === 0 && (
              <p className="mt-1 text-xs text-status-alert">
                No zones exist for this event yet. Add a zone first.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="team_lead" className="block text-sm font-medium text-text-body mb-1.5">
              Team lead
            </label>
            <select
              id="team_lead"
              value={leadId}
              onChange={(e) => setLeadId(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">No lead</option>
              {profiles
                .filter((p) => p.role === 'team_lead' || p.role === 'coc_admin')
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name} ({p.role.replace('_', ' ')})
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-body mb-1.5">
              Volunteers
            </label>
            <MultiSelect
              options={memberOptions}
              selectedIds={memberIds}
              onChange={setMemberIds}
              excludeIds={leadId ? [leadId] : []}
              placeholder="Search by name or email…"
              maxHeight={240}
            />
            <p
              className={
                'mt-1 text-xs ' +
                (outOfRange ? 'text-status-alert' : 'text-text-muted')
              }
            >
              {memberCount} member{memberCount === 1 ? '' : 's'} selected.{' '}
              {outOfRange ? 'Recommended 2–6 per team.' : 'Within recommended 2–6 range.'}
            </p>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-status-alert" role="alert">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : editing ? 'Save changes' : 'Create team'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
