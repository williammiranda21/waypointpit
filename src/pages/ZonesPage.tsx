import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, MapPin, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Toggle } from '@/components/ui/Toggle';
import { MapView, type MapPolygon } from '@/components/map/MapView';
import type { MapMarker } from '@/components/map/markers';
import { useEvent } from '@/hooks/useEvents';
import { useDeleteZone, useUpdateZone, useZonesForEvent } from '@/hooks/useZones';
import { useHotspotsForEvent } from '@/hooks/useHotspots';
import type { Zone } from '@/lib/db/zones';
import type { ZoneStatus } from '@/lib/database.types';
import { cn } from '@/lib/cn';

const statusTone: Record<ZoneStatus, BadgeTone> = {
  not_started: 'draft',
  in_progress: 'pending',
  complete: 'active',
};

const statusLabel: Record<ZoneStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  complete: 'Complete',
};

const nextStatus: Record<ZoneStatus, ZoneStatus> = {
  not_started: 'in_progress',
  in_progress: 'complete',
  complete: 'not_started',
};

export function ZonesPage() {
  const { id: eventId } = useParams<{ id: string }>();
  const { data: event } = useEvent(eventId);
  const { data: zones = [], isLoading } = useZonesForEvent(eventId);
  const { data: hotspots = [] } = useHotspotsForEvent(eventId);
  const deleteMutation = useDeleteZone(eventId ?? '');
  const [highlightId, setHighlightId] = useState<string | undefined>(undefined);
  const [showHotspots, setShowHotspots] = useState(true);

  const polygons: MapPolygon[] = useMemo(
    () =>
      zones.map((z) => ({
        id: z.id,
        name: z.name,
        geometry: z.geometry,
        color: z.color,
      })),
    [zones],
  );

  const markers: MapMarker[] = useMemo(() => {
    if (!showHotspots) return [];
    return hotspots.map((h) => ({
      id: h.id,
      lng: h.gps_lng,
      lat: h.gps_lat,
      hotspot_type: h.hotspot_type,
      severity: h.severity,
      expected_count: h.expected_count,
      resolved: h.resolved,
      label: h.name,
    }));
  }, [hotspots, showHotspots]);

  if (!eventId) {
    return <p className="text-sm text-status-alert">Missing event id.</p>;
  }

  return (
    <div className="max-w-7xl">
      <Link
        to={`/events/${eventId}`}
        className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-primary mb-3"
      >
        <ArrowLeft size={14} />
        Back to {event?.name ?? 'event'}
      </Link>

      <PageHeader
        title="Zones"
        description="Draw or select zones for this event. Each team will be assigned to one."
        actions={
          <Link to={`/events/${eventId}/zones/new`}>
            <Button>
              <Plus size={16} />
              Add Zone
            </Button>
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <div className="space-y-3">
          {isLoading && <p className="text-sm text-text-muted">Loading zones…</p>}

          {!isLoading && zones.length === 0 && (
            <Card>
              <EmptyState
                icon={<MapPin size={18} />}
                title="No zones yet"
                description="Add the first zone by drawing one on the map or copying a Miami-Dade template."
                action={
                  <Link to={`/events/${eventId}/zones/new`}>
                    <Button size="sm">
                      <Plus size={14} />
                      Add Zone
                    </Button>
                  </Link>
                }
              />
            </Card>
          )}

          {zones.map((zone) => (
            <ZoneRow
              key={zone.id}
              eventId={eventId}
              zone={zone}
              highlighted={zone.id === highlightId}
              onHover={setHighlightId}
              onDelete={() => deleteMutation.mutate(zone.id)}
            />
          ))}
        </div>

        <div className="relative h-[560px] lg:h-[640px] rounded-xl overflow-hidden border border-wp-border bg-white">
          {hotspots.length > 0 && (
            <div className="absolute top-3 left-3 z-10 rounded-lg bg-white/95 border border-wp-border shadow-sm px-3 py-2">
              <Toggle
                checked={showHotspots}
                onChange={(e) => setShowHotspots(e.target.checked)}
                label={
                  <span className="inline-flex items-center gap-1.5">
                    <AlertTriangle size={12} className="text-status-alert" />
                    Show {hotspots.length} hotspot{hotspots.length === 1 ? '' : 's'}
                  </span>
                }
              />
            </div>
          )}
          <MapView
            polygons={polygons}
            markers={markers}
            highlightId={highlightId}
            className="absolute inset-0"
          />
        </div>
      </div>
    </div>
  );
}

interface ZoneRowProps {
  eventId: string;
  zone: Zone;
  highlighted: boolean;
  onHover: (id: string | undefined) => void;
  onDelete: () => void;
}

function ZoneRow({ eventId, zone, highlighted, onHover, onDelete }: ZoneRowProps) {
  const updateMutation = useUpdateZone(eventId, zone.id);

  const cycleStatus = () => updateMutation.mutate({ status: nextStatus[zone.status] });

  return (
    <Card
      onMouseEnter={() => onHover(zone.id)}
      onMouseLeave={() => onHover(undefined)}
      className={cn(
        'transition-shadow',
        highlighted ? 'ring-2 ring-primary ring-offset-2 ring-offset-page-bg' : '',
      )}
    >
      <CardBody className="flex items-start gap-3">
        <span
          className="mt-0.5 inline-block h-4 w-4 rounded-sm shrink-0"
          style={{ backgroundColor: zone.color }}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-text-primary truncate">{zone.name}</h3>
            <button
              type="button"
              onClick={onDelete}
              className="p-1 text-text-muted hover:text-status-alert"
              aria-label={`Delete ${zone.name}`}
              title="Delete zone"
            >
              <Trash2 size={14} />
            </button>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <Badge tone={statusTone[zone.status]}>{statusLabel[zone.status]}</Badge>
            <button
              type="button"
              onClick={cycleStatus}
              disabled={updateMutation.isPending}
              className="text-xs text-text-muted hover:text-text-primary underline-offset-2 hover:underline"
            >
              Advance →
            </button>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
