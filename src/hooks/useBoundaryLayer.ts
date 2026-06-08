import { useQuery } from '@tanstack/react-query';
import { getBoundaryLayer } from '@/lib/boundaries';
import type { BoundaryLayerId } from '@/lib/boundaries';

export const boundaryKey = {
  layer: (id: BoundaryLayerId) => ['boundary', id] as const,
};

export function useBoundaryLayer(id: BoundaryLayerId | null) {
  return useQuery({
    queryKey: id ? boundaryKey.layer(id) : ['boundary', 'none'],
    queryFn: () => (id ? getBoundaryLayer(id).load() : Promise.resolve([])),
    enabled: !!id,
    staleTime: Infinity, // layers don't change at runtime
  });
}
