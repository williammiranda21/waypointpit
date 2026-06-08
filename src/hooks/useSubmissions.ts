import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createSubmission,
  listSubmissionsForEvent,
  listSubmissionsForTeam,
  type CreateSubmissionInput,
} from '@/lib/db/submissions';

export const submissionsKey = {
  forTeam: (teamId: string) => ['submissions', 'team', teamId] as const,
  forEvent: (eventId: string) => ['submissions', 'event', eventId] as const,
};

export function useSubmissionsForTeam(teamId: string | undefined) {
  return useQuery({
    queryKey: teamId ? submissionsKey.forTeam(teamId) : ['submissions', 'team', 'none'],
    queryFn: () => listSubmissionsForTeam(teamId!),
    enabled: !!teamId,
  });
}

export function useSubmissionsForEvent(eventId: string | undefined) {
  return useQuery({
    queryKey: eventId ? submissionsKey.forEvent(eventId) : ['submissions', 'event', 'none'],
    queryFn: () => listSubmissionsForEvent(eventId!),
    enabled: !!eventId,
  });
}

export function useCreateSubmission(teamId: string, eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    // We have our own offline-first pipeline (IndexedDB queue), so don't let
    // TanStack Query's online manager pause this mutation when the browser
    // reports offline. createSubmission always succeeds locally; the syncer
    // handles the network side.
    networkMode: 'always',
    mutationFn: (input: CreateSubmissionInput) => createSubmission(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: submissionsKey.forTeam(teamId) });
      qc.invalidateQueries({ queryKey: submissionsKey.forEvent(eventId) });
    },
  });
}
