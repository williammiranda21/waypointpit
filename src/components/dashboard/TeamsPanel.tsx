import { cn } from '@/lib/cn';
import {
  TEAM_STATUS_DOT,
  TEAM_STATUS_LABEL,
  computeTeamStatus,
  formatLastSeen,
  type TeamStatus,
} from '@/lib/teamStatus';
import type { Tables, ZoneStatus } from '@/lib/database.types';

export interface TeamRowData {
  teamId: string;
  teamName: string;
  zoneName: string;
  zoneColor: string;
  zoneStatus: ZoneStatus;
  personCount: number;
  submissionCount: number;
  lastSeenAt: string | null;
  members: Pick<Tables<'team_members'>, 'last_seen_at'>[];
}

interface TeamsPanelProps {
  rows: TeamRowData[];
  selectedTeamId?: string | null;
  onSelect?: (teamId: string | null) => void;
}

export function TeamsPanel({ rows, selectedTeamId, onSelect }: TeamsPanelProps) {
  if (rows.length === 0) {
    return (
      <p className="px-4 py-8 text-sm text-text-muted text-center">
        No teams assigned to this event yet.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-wp-border">
      {rows.map((r) => {
        const status: TeamStatus = computeTeamStatus({
          members: r.members,
          zoneStatus: r.zoneStatus,
        });
        const isSelected = selectedTeamId === r.teamId;
        return (
          <li key={r.teamId}>
            <button
              type="button"
              onClick={() => onSelect?.(isSelected ? null : r.teamId)}
              className={cn(
                'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors',
                isSelected ? 'bg-primary-light/50' : 'hover:bg-gray-50',
              )}
            >
              <span
                className={cn(
                  'mt-1.5 h-2.5 w-2.5 rounded-full shrink-0 ring-2 ring-white',
                  TEAM_STATUS_DOT[status],
                )}
                aria-label={TEAM_STATUS_LABEL[status]}
                title={TEAM_STATUS_LABEL[status]}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 justify-between">
                  <p className="text-sm font-semibold text-text-primary truncate">{r.teamName}</p>
                  <span className="text-xs text-text-muted shrink-0">
                    {r.personCount} persons
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium border"
                    style={{
                      borderColor: r.zoneColor,
                      color: r.zoneColor,
                      backgroundColor: r.zoneColor + '15',
                    }}
                  >
                    {r.zoneName}
                  </span>
                  <span className="text-[11px] text-text-muted">
                    {r.submissionCount} submission{r.submissionCount === 1 ? '' : 's'}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-text-muted">
                  Last seen {formatLastSeen(r.lastSeenAt)}
                </p>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
