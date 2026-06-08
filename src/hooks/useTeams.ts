import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createTeam,
  deleteTeam,
  getTeam,
  listTeamsForEvent,
  updateTeam,
  type CreateTeamInput,
  type UpdateTeamInput,
} from '@/lib/db/teams';
import {
  listMembersForTeam,
  listMembersForTeams,
  setTeamMembers,
  type SetMembersInput,
} from '@/lib/db/teamMembers';
import { listProfilesInOrg } from '@/lib/db/profiles';
import { useAuthStore } from '@/stores/authStore';

export const teamsKey = {
  all: ['teams'] as const,
  forEvent: (eventId: string) => ['teams', 'event', eventId] as const,
  detail: (id: string) => ['teams', 'detail', id] as const,
  membersForTeam: (teamId: string) => ['teams', 'members', teamId] as const,
  membersForEvent: (eventId: string) => ['teams', 'members-event', eventId] as const,
};

export const profilesKey = {
  inOrg: (orgId: string) => ['profiles', 'org', orgId] as const,
};

// -------- Profiles --------

export function useProfilesInOrg() {
  const orgId = useAuthStore((s) => s.user?.orgId);
  return useQuery({
    queryKey: orgId ? profilesKey.inOrg(orgId) : ['profiles', 'org', 'anon'],
    queryFn: () => listProfilesInOrg(orgId!),
    enabled: !!orgId,
    staleTime: 5 * 60_000,
  });
}

// -------- Teams --------

export function useTeamsForEvent(eventId: string | undefined) {
  return useQuery({
    queryKey: eventId ? teamsKey.forEvent(eventId) : ['teams', 'event', 'none'],
    queryFn: () => listTeamsForEvent(eventId!),
    enabled: !!eventId,
  });
}

export function useTeam(id: string | undefined) {
  return useQuery({
    queryKey: id ? teamsKey.detail(id) : ['teams', 'detail', 'none'],
    queryFn: () => getTeam(id!),
    enabled: !!id,
  });
}

export function useCreateTeam(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<CreateTeamInput, 'count_event_id'>) =>
      createTeam({ ...input, count_event_id: eventId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: teamsKey.forEvent(eventId) }),
  });
}

export function useUpdateTeam(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateTeamInput }) => updateTeam(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: teamsKey.forEvent(eventId) }),
  });
}

export function useDeleteTeam(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTeam(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teamsKey.forEvent(eventId) });
      qc.invalidateQueries({ queryKey: teamsKey.membersForEvent(eventId) });
    },
  });
}

// -------- Members --------

export function useMembersForTeam(teamId: string | undefined) {
  return useQuery({
    queryKey: teamId ? teamsKey.membersForTeam(teamId) : ['teams', 'members', 'none'],
    queryFn: () => listMembersForTeam(teamId!),
    enabled: !!teamId,
  });
}

/** Fetches members for every team in an event in one go (used by the list page for counts). */
export function useMembersForEvent(eventId: string | undefined, teamIds: string[]) {
  const key = eventId ? teamsKey.membersForEvent(eventId) : ['teams', 'members-event', 'none'];
  return useQuery({
    queryKey: [...key, teamIds.join(',')],
    queryFn: () => listMembersForTeams(teamIds),
    enabled: !!eventId && teamIds.length > 0,
  });
}

export function useSetTeamMembers(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SetMembersInput) => setTeamMembers(input),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: teamsKey.membersForTeam(vars.team_id) });
      qc.invalidateQueries({ queryKey: teamsKey.membersForEvent(eventId) });
    },
  });
}
