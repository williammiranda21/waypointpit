import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createZone,
  deleteZone,
  listZonesForEvent,
  updateZone,
  type CreateZoneInput,
  type UpdateZoneInput,
} from '@/lib/db/zones';
import { listZoneTemplates } from '@/lib/db/zoneTemplates';

export const zonesKey = {
  all: ['zones'] as const,
  forEvent: (eventId: string) => ['zones', 'event', eventId] as const,
  templates: ['zones', 'templates'] as const,
};

export function useZonesForEvent(eventId: string | undefined) {
  return useQuery({
    queryKey: eventId ? zonesKey.forEvent(eventId) : ['zones', 'event', 'none'],
    queryFn: () => listZonesForEvent(eventId!),
    enabled: !!eventId,
  });
}

export function useZoneTemplates() {
  return useQuery({
    queryKey: zonesKey.templates,
    queryFn: listZoneTemplates,
    staleTime: 5 * 60_000,
  });
}

export function useCreateZone(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<CreateZoneInput, 'count_event_id'>) =>
      createZone({ ...input, count_event_id: eventId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: zonesKey.forEvent(eventId) });
    },
  });
}

export function useUpdateZone(eventId: string, zoneId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: UpdateZoneInput) => updateZone(zoneId, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: zonesKey.forEvent(eventId) });
    },
  });
}

export function useDeleteZone(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (zoneId: string) => deleteZone(zoneId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: zonesKey.forEvent(eventId) });
    },
  });
}
