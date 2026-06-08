import { Link, useNavigate } from 'react-router-dom';
import { CalendarRange, Plus, ShieldCheck, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { useEventsList } from '@/hooks/useEvents';
import type { EventStatus } from '@/lib/database.types';

const statusTone: Record<EventStatus, BadgeTone> = {
  draft: 'draft',
  active: 'active',
  closed: 'closed',
};

const statusLabel: Record<EventStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  closed: 'Closed',
};

export function EventsListPage() {
  const navigate = useNavigate();
  const { data: events, isLoading, error } = useEventsList();

  const showEmpty = !isLoading && (!events || events.length === 0);

  return (
    <div className="max-w-6xl">
      <PageHeader
        title="Count Events"
        description={
          <>
            PIT count events for your CoC. Create one per count night.{' '}
            <span className="font-medium text-text-body">
              Click an event to manage its Zones, Teams, and Hotspots.
            </span>
          </>
        }
        actions={
          <Link to="/events/new">
            <Button>
              <Plus size={16} />
              New Event
            </Button>
          </Link>
        }
      />

      <Card>
        {error && (
          <div className="px-6 py-4 text-sm text-status-alert" role="alert">
            Could not load events: {(error as Error).message}
          </div>
        )}

        {isLoading && (
          <div className="px-6 py-8 text-sm text-text-muted">Loading events…</div>
        )}

        {showEmpty && (
          <EmptyState
            icon={<CalendarRange size={18} />}
            title="No count events yet"
            description="Create your first event to start defining zones and assigning teams."
            action={
              <Link to="/events/new">
                <Button>
                  <Plus size={16} />
                  New Event
                </Button>
              </Link>
            }
          />
        )}

        {!isLoading && events && events.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-wp-border">
                  <Th>Name</Th>
                  <Th>Count Date</Th>
                  <Th>Status</Th>
                  <Th>Zone Enforcement</Th>
                  <Th className="hidden md:table-cell">Created</Th>
                  <Th className="text-right">Manage</Th>
                </tr>
              </thead>
              <tbody>
                {events.map((e, i) => (
                  <tr
                    key={e.id}
                    onClick={() => navigate(`/events/${e.id}`)}
                    className={
                      'cursor-pointer transition-colors hover:bg-gray-50 ' +
                      (i % 2 === 1 ? 'bg-gray-50/40' : '')
                    }
                  >
                    <Td className="font-medium text-text-primary">{e.name}</Td>
                    <Td>{formatDate(e.count_date)}</Td>
                    <Td>
                      <Badge tone={statusTone[e.status]}>{statusLabel[e.status]}</Badge>
                    </Td>
                    <Td>
                      {e.enforce_zone_boundary ? (
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          <ShieldCheck size={14} className="text-primary" />
                          Strict ({e.zone_buffer_meters} m buffer)
                        </span>
                      ) : (
                        <span className="text-xs text-text-muted">
                          Soft warn ({e.zone_buffer_meters} m buffer)
                        </span>
                      )}
                    </Td>
                    <Td className="hidden md:table-cell text-text-muted">
                      {formatRelative(e.created_at)}
                    </Td>
                    <Td className="text-right">
                      <span className="inline-flex items-center gap-1 whitespace-nowrap font-medium text-primary">
                        Open zones &amp; teams
                        <ChevronRight size={15} />
                      </span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={
        'text-left px-6 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted ' +
        className
      }
    >
      {children}
    </th>
  );
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <td className={'px-6 py-3 align-middle border-b border-wp-border ' + className}>
      {children}
    </td>
  );
}

function formatDate(iso: string): string {
  // iso is YYYY-MM-DD. Parsing as local avoids the UTC midnight off-by-one.
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
