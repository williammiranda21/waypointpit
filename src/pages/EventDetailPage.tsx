import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, MapPin, Users, ShieldCheck, ShieldOff, Calendar, Pencil, Copy, AlertTriangle, ClipboardList, ChevronRight, Trash2, Loader2 } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { toast } from '@/stores/toastStore';
import { useEvent, useUpdateEvent, useDeleteEvent } from '@/hooks/useEvents';
import { useZonesForEvent } from '@/hooks/useZones';
import { useTeamsForEvent } from '@/hooks/useTeams';
import { useHotspotsForEvent } from '@/hooks/useHotspots';
import type { EventStatus, SubmissionMode } from '@/lib/database.types';

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

const submissionModeLabel: Record<SubmissionMode, string> = {
  tally_only: 'Tally only',
  survey_only: 'Survey only',
  both: 'Tally or Survey',
};

export function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: event, isLoading, error } = useEvent(id);
  const { data: clonedFrom } = useEvent(event?.cloned_from_event_id ?? undefined);
  const updateMutation = useUpdateEvent(id ?? '');
  const deleteMutation = useDeleteEvent();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { data: zones = [] } = useZonesForEvent(id);
  const { data: teams = [] } = useTeamsForEvent(id);
  const { data: hotspots = [] } = useHotspotsForEvent(id);

  if (isLoading) {
    return <p className="text-sm text-text-muted">Loading event…</p>;
  }
  if (error) {
    return (
      <p className="text-sm text-status-alert" role="alert">
        Could not load event: {(error as Error).message}
      </p>
    );
  }
  if (!event) {
    return (
      <div>
        <Link to="/events" className="text-sm text-text-muted">
          Back to events
        </Link>
        <p className="mt-4 text-sm text-text-body">This event no longer exists.</p>
      </div>
    );
  }

  const isDraft = event.status === 'draft';
  const isActive = event.status === 'active';

  const launch = () => updateMutation.mutate({ status: 'active' });
  const close = () => updateMutation.mutate({ status: 'closed' });

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(event.id);
      toast({ tone: 'success', message: `Deleted "${event.name}".` });
      navigate('/events', { replace: true });
    } catch (err) {
      toast({
        tone: 'error',
        message: err instanceof Error ? err.message : 'Could not delete the event.',
      });
      setConfirmDelete(false);
    }
  };

  return (
    <div className="max-w-5xl">
      <Link
        to="/events"
        className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-primary mb-3"
      >
        <ArrowLeft size={14} />
        Back to events
      </Link>

      <PageHeader
        title={
          <span className="inline-flex items-center gap-3">
            {event.name}
            <Badge tone={statusTone[event.status]}>{statusLabel[event.status]}</Badge>
          </span>
        }
        description={
          <span className="inline-flex items-center gap-4 text-text-muted">
            <span className="inline-flex items-center gap-1.5">
              <Calendar size={14} />
              {formatLongDate(event.count_date)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              {event.enforce_zone_boundary ? (
                <>
                  <ShieldCheck size={14} className="text-primary" />
                  Strict zone enforcement · {event.zone_buffer_meters} m buffer
                </>
              ) : (
                <>
                  <ShieldOff size={14} />
                  Soft zone warn · {event.zone_buffer_meters} m buffer
                </>
              )}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ClipboardList size={14} />
              {submissionModeLabel[event.submission_mode]}
            </span>
          </span>
        }
        actions={
          <>
            <Button variant="secondary" size="sm" disabled>
              <Pencil size={14} />
              Edit
            </Button>
            {isDraft && (
              <Button size="sm" onClick={launch} disabled={updateMutation.isPending}>
                Launch event
              </Button>
            )}
            {isActive && (
              <Button variant="danger" size="sm" onClick={close} disabled={updateMutation.isPending}>
                Close event
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setConfirmDelete(true)}
              className="text-status-alert hover:bg-red-50"
            >
              <Trash2 size={14} />
              Delete
            </Button>
          </>
        }
      />

      {clonedFrom && (
        <p className="mb-4 text-xs text-text-muted inline-flex items-center gap-1.5">
          <Copy size={12} />
          Cloned from{' '}
          <Link
            to={`/events/${clonedFrom.id}`}
            className="font-medium text-primary hover:text-primary-hover"
          >
            {clonedFrom.name}
          </Link>{' '}
          · {formatLongDate(clonedFrom.count_date)}
        </p>
      )}

      {event.description && (
        <Card className="mb-6">
          <CardBody>
            <p className="text-sm text-text-body whitespace-pre-line">{event.description}</p>
          </CardBody>
        </Card>
      )}

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-text-muted">
        Set up this event
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <ManageCard
          to={`/events/${event.id}/zones`}
          icon={<MapPin size={18} />}
          title="Zones"
          count={zones.length}
          description="Draw or import the areas teams will cover."
        />
        <ManageCard
          to={`/events/${event.id}/teams`}
          icon={<Users size={18} />}
          title="Teams"
          count={teams.length}
          description="Create teams, set a lead, and assign each a zone."
        />
        <ManageCard
          to={`/events/${event.id}/hotspots`}
          icon={<AlertTriangle size={18} />}
          title="Hotspots"
          count={hotspots.length}
          description="Known locations and police intel to check."
        />
      </div>

      {confirmDelete && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-5">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 shrink-0 rounded-full bg-red-50 text-status-alert inline-flex items-center justify-center">
                <Trash2 size={18} />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-text-primary">
                  Delete &ldquo;{event.name}&rdquo;?
                </h3>
                <p className="mt-1 text-sm text-text-body">
                  This permanently removes the event and all of its zones, teams, hotspots, and
                  submissions ({zones.length} zone{zones.length === 1 ? '' : 's'}, {teams.length}{' '}
                  team{teams.length === 1 ? '' : 's'}, {hotspots.length} hotspot
                  {hotspots.length === 1 ? '' : 's'}). This cannot be undone.
                </p>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setConfirmDelete(false)}
                disabled={deleteMutation.isPending}
              >
                Cancel
              </Button>
              <Button variant="danger" onClick={handleDelete} disabled={deleteMutation.isPending}>
                {deleteMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Delete event
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface ManageCardProps {
  to: string;
  icon: React.ReactNode;
  title: string;
  count: number;
  description: string;
}

function ManageCard({ to, icon, title, count, description }: ManageCardProps) {
  return (
    <Link
      to={to}
      className="group block rounded-xl border border-wp-border bg-white p-5 transition-all hover:border-primary/50 hover:shadow-sm"
    >
      <div className="flex items-start justify-between">
        <div className="h-10 w-10 rounded-full bg-primary-light text-primary inline-flex items-center justify-center">
          {icon}
        </div>
        <ChevronRight size={18} className="text-text-muted transition-colors group-hover:text-primary" />
      </div>
      <h3 className="mt-3 text-sm font-semibold text-text-primary">{title}</h3>
      <p className="mt-1 text-2xl font-bold leading-none text-text-primary">
        {count}
        <span className="ml-1.5 text-sm font-normal text-text-muted">
          {count === 1 ? title.toLowerCase().replace(/s$/, '') : title.toLowerCase()}
        </span>
      </p>
      <p className="mt-2 text-xs text-text-muted">{description}</p>
      <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary">
        Manage {title.toLowerCase()}
        <ChevronRight size={14} />
      </span>
    </Link>
  );
}

function formatLongDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
