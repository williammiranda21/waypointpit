import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/cn';
import type { Tables } from '@/lib/database.types';

interface EventSelectorProps {
  events: Tables<'count_events'>[];
  selectedIds: string[];
  onToggle: (eventId: string) => void;
  /** Title prefix shown above the chip list. */
  title?: string;
}

const statusTone = {
  active: 'active',
  draft: 'draft',
  closed: 'closed',
} as const;

export function EventSelector({
  events,
  selectedIds,
  onToggle,
  title = 'Events',
}: EventSelectorProps) {
  if (events.length === 0) {
    return (
      <Card className="px-4 py-3 text-sm text-text-muted">No events to analyze yet.</Card>
    );
  }
  return (
    <Card className="px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">{title}</p>
        <p className="text-[11px] text-text-muted">
          {selectedIds.length} of {events.length} selected
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {events.map((e) => {
          const active = selectedIds.includes(e.id);
          return (
            <button
              key={e.id}
              type="button"
              onClick={() => onToggle(e.id)}
              aria-pressed={active}
              className={cn(
                'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                active
                  ? 'bg-primary text-white border-primary'
                  : 'border-wp-border bg-white text-text-body hover:bg-gray-50',
              )}
            >
              <span>{e.name}</span>
              <span className={active ? 'opacity-80' : 'text-text-muted'}>
                ({formatShortDate(e.count_date)})
              </span>
              <Badge
                tone={active ? 'neutral' : statusTone[e.status]}
                className={active ? 'bg-white/20 text-white' : ''}
              >
                {e.status}
              </Badge>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function formatShortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: '2-digit',
  });
}
