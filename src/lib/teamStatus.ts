import type { Tables, ZoneStatus } from '@/lib/database.types';

export type TeamStatus = 'active' | 'silent' | 'alert' | 'complete' | 'idle';

export interface TeamStatusInput {
  members: Pick<Tables<'team_members'>, 'last_seen_at'>[];
  zoneStatus: ZoneStatus;
}

/**
 * Derive the dashboard status dot color for a team.
 *
 *   complete (blue)  — zone status is complete
 *   active   (green) — at least one member last seen < 10 min ago
 *   silent   (yellow)— last seen 10–20 min ago
 *   alert    (red)   — last seen > 20 min ago
 *   idle     (gray)  — no member has ever checked in (no heartbeat yet)
 */
export function computeTeamStatus(
  input: TeamStatusInput,
  now: number = Date.now(),
): TeamStatus {
  if (input.zoneStatus === 'complete') return 'complete';

  const lastSeen = input.members
    .map((m) => (m.last_seen_at ? new Date(m.last_seen_at).getTime() : 0))
    .reduce((max, t) => Math.max(max, t), 0);
  if (lastSeen === 0) return 'idle';

  const minutes = (now - lastSeen) / 60_000;
  if (minutes < 10) return 'active';
  if (minutes < 20) return 'silent';
  return 'alert';
}

export const TEAM_STATUS_LABEL: Record<TeamStatus, string> = {
  active: 'Active',
  silent: 'Silent',
  alert: 'Alert',
  complete: 'Complete',
  idle: 'Idle',
};

/**
 * Tailwind background color class for the status dot.
 * Green/yellow/red/blue per spec; gray for idle.
 */
export const TEAM_STATUS_DOT: Record<TeamStatus, string> = {
  active: 'bg-status-active',
  silent: 'bg-amber-400',
  alert: 'bg-status-alert',
  complete: 'bg-status-pending',
  idle: 'bg-gray-300',
};

/** Badge tone for the team status (used in the Zones tab and Teams rows). */
export const TEAM_STATUS_BADGE_TONE: Record<
  TeamStatus,
  'active' | 'pending' | 'alert' | 'closed' | 'neutral' | 'draft'
> = {
  active: 'active',
  silent: 'draft',
  alert: 'alert',
  complete: 'pending',
  idle: 'neutral',
};

export function formatLastSeen(iso: string | null, now: number = Date.now()): string {
  if (!iso) return 'never';
  const minutes = Math.floor((now - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString();
}
