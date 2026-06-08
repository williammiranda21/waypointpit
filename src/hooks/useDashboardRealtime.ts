import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { subscribeDashboard } from '@/lib/realtime/dashboardRealtime';
import { submissionsKey } from './useSubmissions';
import { zonesKey } from './useZones';
import { teamsKey } from './useTeams';

/**
 * Wires the dashboard to live data. On any change that affects the dashboard,
 * invalidates the relevant queries so React Query refetches them.
 *
 * In addition to the realtime channel/poll, runs a 60s wall-clock tick so
 * derived "silent / alert" team statuses (which depend on time-since-last-seen)
 * recompute even when nothing in the DB changed.
 */
export function useDashboardRealtime(eventId: string | undefined): void {
  const qc = useQueryClient();

  useEffect(() => {
    if (!eventId) return;

    const refresh = () => {
      qc.invalidateQueries({ queryKey: submissionsKey.forEvent(eventId) });
      qc.invalidateQueries({ queryKey: zonesKey.forEvent(eventId) });
      qc.invalidateQueries({ queryKey: teamsKey.membersForEvent(eventId) });
    };

    const teardown = subscribeDashboard(eventId, refresh);
    // 60s wall-clock recompute so status dots flip green→yellow→red without
    // any DB writes. (Spec calls for a 60s polling interval.)
    const wallClock = window.setInterval(refresh, 60_000);

    return () => {
      teardown();
      window.clearInterval(wallClock);
    };
  }, [eventId, qc]);
}
