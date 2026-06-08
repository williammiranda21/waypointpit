import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createEvent,
  deleteEvent,
  getEvent,
  listEvents,
  updateEvent,
  type CreateEventInput,
  type UpdateEventInput,
} from '@/lib/db/events';
import { useAuthStore } from '@/stores/authStore';

export const eventsKey = {
  all: ['events'] as const,
  list: (orgId: string) => ['events', 'list', orgId] as const,
  detail: (id: string) => ['events', 'detail', id] as const,
};

export function useEventsList() {
  const orgId = useAuthStore((s) => s.user?.orgId);
  return useQuery({
    queryKey: orgId ? eventsKey.list(orgId) : ['events', 'list', 'anon'],
    queryFn: () => listEvents(orgId!),
    enabled: !!orgId,
  });
}

export function useEvent(id: string | undefined) {
  return useQuery({
    queryKey: id ? eventsKey.detail(id) : ['events', 'detail', 'none'],
    queryFn: () => getEvent(id!),
    enabled: !!id,
  });
}

export function useCreateEvent() {
  const qc = useQueryClient();
  const orgId = useAuthStore((s) => s.user?.orgId);
  return useMutation({
    mutationFn: (input: CreateEventInput) => createEvent(input),
    onSuccess: (created) => {
      if (orgId) qc.invalidateQueries({ queryKey: eventsKey.list(orgId) });
      qc.setQueryData(eventsKey.detail(created.id), created);
    },
  });
}

export function useUpdateEvent(id: string) {
  const qc = useQueryClient();
  const orgId = useAuthStore((s) => s.user?.orgId);
  return useMutation({
    mutationFn: (patch: UpdateEventInput) => updateEvent(id, patch),
    onSuccess: (updated) => {
      if (orgId) qc.invalidateQueries({ queryKey: eventsKey.list(orgId) });
      qc.setQueryData(eventsKey.detail(id), updated);
    },
  });
}

export function useDeleteEvent() {
  const qc = useQueryClient();
  const orgId = useAuthStore((s) => s.user?.orgId);
  return useMutation({
    mutationFn: (id: string) => deleteEvent(id),
    onSuccess: (_data, id) => {
      if (orgId) qc.invalidateQueries({ queryKey: eventsKey.list(orgId) });
      qc.removeQueries({ queryKey: eventsKey.detail(id) });
    },
  });
}
