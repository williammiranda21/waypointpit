import { Card } from '@/components/ui/Card';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { cn } from '@/lib/cn';
import type { ZoneStatus } from '@/lib/database.types';

export interface ZoneCardData {
  zoneId: string;
  zoneName: string;
  zoneColor: string;
  zoneStatus: ZoneStatus;
  teamName: string | null;
  personCount: number;
  submissionCount: number;
}

interface ZonesPanelProps {
  rows: ZoneCardData[];
  selectedZoneId?: string | null;
  onSelect?: (zoneId: string | null) => void;
  onSetStatus?: (zoneId: string, status: ZoneStatus) => void;
  isUpdating?: boolean;
}

const ZONE_STATUS_LABEL: Record<ZoneStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  complete: 'Complete',
};

const ZONE_STATUS_TONE: Record<ZoneStatus, BadgeTone> = {
  not_started: 'neutral',
  in_progress: 'active',
  complete: 'pending',
};

const ZONE_STATUS_ORDER: ZoneStatus[] = ['not_started', 'in_progress', 'complete'];

export function ZonesPanel({
  rows,
  selectedZoneId,
  onSelect,
  onSetStatus,
  isUpdating,
}: ZonesPanelProps) {
  if (rows.length === 0) {
    return (
      <p className="px-4 py-8 text-sm text-text-muted text-center">No zones defined yet.</p>
    );
  }

  return (
    <div className="px-3 py-3 space-y-3">
      {rows.map((r) => {
        const isSelected = selectedZoneId === r.zoneId;
        return (
          <Card
            key={r.zoneId}
            className={cn(
              'px-4 py-3 cursor-pointer transition-colors',
              isSelected ? 'ring-2 ring-primary/50' : 'hover:bg-gray-50',
            )}
            onClick={() => onSelect?.(isSelected ? null : r.zoneId)}
          >
            <div className="flex items-start gap-3">
              <span
                className="h-3 w-3 rounded-full mt-1.5 shrink-0"
                style={{ backgroundColor: r.zoneColor }}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-text-primary truncate">{r.zoneName}</p>
                  <Badge tone={ZONE_STATUS_TONE[r.zoneStatus]}>
                    {ZONE_STATUS_LABEL[r.zoneStatus]}
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs text-text-muted">
                  {r.teamName ?? <span className="italic">Unassigned</span>}
                </p>
                <div className="mt-2 flex items-center gap-3 text-xs text-text-muted">
                  <span>{r.personCount} persons</span>
                  <span aria-hidden>·</span>
                  <span>
                    {r.submissionCount} submission{r.submissionCount === 1 ? '' : 's'}
                  </span>
                </div>
                {onSetStatus && (
                  <div
                    className="mt-2 inline-flex rounded-md border border-wp-border overflow-hidden"
                    role="group"
                    aria-label="Set zone status"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {ZONE_STATUS_ORDER.map((s) => (
                      <button
                        key={s}
                        type="button"
                        disabled={isUpdating || r.zoneStatus === s}
                        onClick={() => onSetStatus(r.zoneId, s)}
                        className={cn(
                          'px-2.5 h-7 text-[11px] font-medium transition-colors',
                          r.zoneStatus === s
                            ? 'bg-primary text-white'
                            : 'bg-white text-text-muted hover:bg-gray-50 disabled:opacity-50',
                        )}
                      >
                        {ZONE_STATUS_LABEL[s]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
