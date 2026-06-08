import { useQuery } from '@tanstack/react-query';
import { findActiveSession } from '@/lib/findActiveSession';
import { useAuthStore } from '@/stores/authStore';

export function useActiveSession() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['active-session', userId ?? 'anon'],
    queryFn: findActiveSession,
    enabled: !!userId,
    staleTime: 60_000,
  });
}
