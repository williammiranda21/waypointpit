import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createHotspot,
  createHotspotsBatch,
  deleteHotspot,
  listHotspotsForEvent,
  toggleHotspotResolved,
  updateHotspot,
  type CreateHotspotInput,
  type UpdateHotspotInput,
} from '@/lib/db/hotspots';

export const hotspotsKey = {
  all: ['hotspots'] as const,
  forEvent: (eventId: string) => ['hotspots', 'event', eventId] as const,
};

export function useHotspotsForEvent(eventId: string | undefined) {
  return useQuery({
    queryKey: eventId ? hotspotsKey.forEvent(eventId) : ['hotspots', 'event', 'none'],
    queryFn: () => listHotspotsForEvent(eventId!),
    enabled: !!eventId,
  });
}

export function useCreateHotspot(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<CreateHotspotInput, 'count_event_id'>) =>
      createHotspot({ ...input, count_event_id: eventId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: hotspotsKey.forEvent(eventId) }),
  });
}

export function useCreateHotspotsBatch(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (inputs: Array<Omit<CreateHotspotInput, 'count_event_id'>>) =>
      createHotspotsBatch(inputs.map((i) => ({ ...i, count_event_id: eventId }))),
    onSuccess: () => qc.invalidateQueries({ queryKey: hotspotsKey.forEvent(eventId) }),
  });
}

export function useUpdateHotspot(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateHotspotInput }) =>
      updateHotspot(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: hotspotsKey.forEvent(eventId) }),
  });
}

export function useToggleResolved(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => toggleHotspotResolved(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: hotspotsKey.forEvent(eventId) }),
  });
}

export function useDeleteHotspot(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteHotspot(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: hotspotsKey.forEvent(eventId) }),
  });
}
