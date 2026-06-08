import { useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { upsertLastSeen } from '@/lib/db/teamMembers';

const HEARTBEAT_INTERVAL_MS = 10 * 60_000; // 10 minutes per spec.

/**
 * While a volunteer has an active count session, stamp `team_members.last_seen_at`
 * once on mount + every 10 minutes. The coordinator dashboard reads this to
 * render active/silent/alert dots and the silence banner.
 *
 * Uses networkMode: 'always' so the heartbeat fires even when the browser
 * reports offline — failures are silently swallowed (next tick retries).
 */
export function useHeartbeat(teamId: string | undefined, userId: string | undefined): void {
  const mutation = useMutation({
    networkMode: 'always',
    mutationFn: ({ team, user }: { team: string; user: string }) => upsertLastSeen(team, user),
  });

  useEffect(() => {
    if (!teamId || !userId) return;
    const beat = () => {
      mutation.mutate(
        { team: teamId, user: userId },
        { onError: () => void 0 }, // best-effort; next tick will retry
      );
    };
    beat();
    const id = window.setInterval(beat, HEARTBEAT_INTERVAL_MS);
    return () => window.clearInterval(id);
    // mutation is stable from react-query; we intentionally don't include it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, userId]);
}
