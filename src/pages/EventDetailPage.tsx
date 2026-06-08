import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, MapPin, Users, ShieldCheck, ShieldOff, Calendar, Pencil, Copy, AlertTriangle, ClipboardList } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { useEvent, useUpdateEvent } from '@/hooks/useEvents';
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
  const { data: event, isLoading, error } = useEvent(id);
  const { data: clonedFrom } = useEvent(event?.cloned_from_event_id ?? undefined);
  const updateMutation = useUpdateEvent(id ?? '');
  const [activeTab, setActiveTab] = useState<'zones' | 'teams' | 'hotspots'>('zones');

  const tabs: TabItem[] = useMemo(
    () => [
      { id: 'zones', label: 'Zones', icon: <MapPin size={14} /> },
      { id: 'teams', label: 'Teams', icon: <Users size={14} /> },
      { id: 'hotspots', label: 'Hotspots', icon: <AlertTriangle size={14} /> },
    ],
    [],
  );

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

      <Tabs
        items={tabs}
        activeId={activeTab}
        onChange={(id) => setActiveTab(id as 'zones' | 'teams' | 'hotspots')}
        className="mb-4"
      />

      <Card>
        <CardBody>
          {activeTab === 'zones' && (
            <TabPlaceholder
              icon={<MapPin size={18} />}
              phase="Phase 5"
              title="Zones live here"
              description="Draw custom polygons on a Miami-Dade map or copy from a predefined template, assign team colors, and toggle status as the count progresses."
              cta={
                <Link to={`/events/${event.id}/zones`}>
                  <Button size="sm">
                    Open zone manager
                  </Button>
                </Link>
              }
            />
          )}
          {activeTab === 'teams' && (
            <TabPlaceholder
              icon={<Users size={18} />}
              phase="Phase 6"
              title="Teams live here"
              description="Create 2–6 volunteer teams, designate a lead, and assign each team to a zone. Last-activity timestamps drive the silence alerts on the coordinator dashboard."
              cta={
                <Link to={`/events/${event.id}/teams`}>
                  <Button size="sm">
                    Open team manager
                  </Button>
                </Link>
              }
            />
          )}
          {activeTab === 'hotspots' && (
            <TabPlaceholder
              icon={<AlertTriangle size={18} />}
              phase="Phase 5.5"
              title="Hotspot intel"
              description="Police-reported sightings, encampments, hazards, and resources. Paste an address list to geocode in bulk; volunteers see the pins within their zone on count night."
              cta={
                <Link to={`/events/${event.id}/hotspots`}>
                  <Button size="sm">
                    Open hotspot manager
                  </Button>
                </Link>
              }
            />
          )}
        </CardBody>
      </Card>
    </div>
  );
}

interface TabPlaceholderProps {
  icon: React.ReactNode;
  phase: string;
  title: string;
  description: string;
  cta?: React.ReactNode;
}

function TabPlaceholder({ icon, phase, title, description, cta }: TabPlaceholderProps) {
  return (
    <div className="flex flex-col items-center text-center py-8 px-4">
      <div className="h-10 w-10 rounded-full bg-primary-light text-primary inline-flex items-center justify-center">
        {icon}
      </div>
      <h3 className="mt-3 text-sm font-semibold text-text-primary inline-flex items-center gap-2">
        {title}
        <Badge tone="pending">{phase}</Badge>
      </h3>
      <p className="mt-1 text-sm text-text-muted max-w-md">{description}</p>
      {cta && <div className="mt-4">{cta}</div>}
    </div>
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
