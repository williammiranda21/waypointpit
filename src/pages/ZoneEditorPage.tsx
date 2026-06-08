import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, LayoutTemplate, MapPin, Upload } from 'lucide-react';
import type { Map as MapboxMap } from 'mapbox-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { MapView } from '@/components/map/MapView';
import { ImportZonesPanel } from '@/components/zones/ImportZonesPanel';
import { ZoneThumbnail } from '@/components/map/ZoneThumbnail';
import { mapboxConfigured } from '@/components/map/mapToken';
import { useEvent } from '@/hooks/useEvents';
import { useCreateZone, useZoneTemplates } from '@/hooks/useZones';
import type { GeoJSONPolygon } from '@/lib/database.types';
import { cn } from '@/lib/cn';

const DEFAULT_COLORS = [
  '#22C55E', // green
  '#3B82F6', // blue
  '#8B5CF6', // purple
  '#F59E0B', // amber
  '#EC4899', // pink
  '#14B8A6', // teal
  '#EF4444', // red
  '#06B6D4', // cyan
];

type Mode = 'draw' | 'template' | 'import';

export function ZoneEditorPage() {
  const { id: eventId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: event } = useEvent(eventId);
  const { data: templates = [] } = useZoneTemplates();
  const createMutation = useCreateZone(eventId ?? '');

  const [mode, setMode] = useState<Mode>(mapboxConfigured ? 'draw' : 'template');
  const [name, setName] = useState('');
  const [color, setColor] = useState(DEFAULT_COLORS[0]);
  const [drawn, setDrawn] = useState<GeoJSONPolygon | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const drawRef = useRef<MapboxDraw | null>(null);

  const tabs: TabItem[] = useMemo(
    () => [
      { id: 'draw', label: 'Draw Custom', icon: <Pencil size={14} /> },
      { id: 'template', label: 'Use Predefined', icon: <LayoutTemplate size={14} />, count: templates.length },
      { id: 'import', label: 'Import File', icon: <Upload size={14} /> },
    ],
    [templates.length],
  );

  const handleMapReady = (map: MapboxMap) => {
    if (drawRef.current) return;
    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: {
        polygon: true,
        trash: true,
      },
    });
    map.addControl(draw);
    drawRef.current = draw;

    const syncDrawn = () => {
      const fc = draw.getAll() as GeoJSON.FeatureCollection;
      const poly = fc.features.find((f) => f.geometry?.type === 'Polygon');
      if (poly && poly.geometry.type === 'Polygon') {
        setDrawn({
          type: 'Polygon',
          coordinates: poly.geometry.coordinates as number[][][],
        });
      } else {
        setDrawn(null);
      }
    };

    map.on('draw.create', syncDrawn);
    map.on('draw.update', syncDrawn);
    map.on('draw.delete', syncDrawn);
  };

  // Leaving Draw mode unmounts the map (and its MapboxDraw control). Clear any
  // unsaved geometry and drop the stale ref so returning to Draw re-creates a
  // fresh control. deleteAll() can throw if the map is already gone — ignore it.
  useEffect(() => {
    if (mode !== 'draw' && drawRef.current) {
      try {
        drawRef.current.deleteAll();
      } catch {
        // map already torn down by the conditional render — nothing to clear
      }
      drawRef.current = null;
      setDrawn(null);
    }
  }, [mode]);

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) ?? null;

  // When a template is selected, default the name + color from it (only if the
  // user hasn't typed something custom).
  useEffect(() => {
    if (selectedTemplate) {
      setName((prev) => (prev ? prev : selectedTemplate.name));
      setColor(selectedTemplate.default_color);
    }
  }, [selectedTemplate]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!eventId) return;
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }

    const geometry = mode === 'draw' ? drawn : selectedTemplate?.geometry ?? null;
    if (!geometry) {
      setError(
        mode === 'draw'
          ? 'Draw a polygon on the map first.'
          : 'Pick a template from the grid.',
      );
      return;
    }

    try {
      await createMutation.mutateAsync({
        name: name.trim(),
        geometry,
        color,
        template_id: mode === 'template' ? selectedTemplate?.id ?? null : null,
      });
      navigate(`/events/${eventId}/zones`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create zone.');
    }
  };

  if (!eventId) {
    return <p className="text-sm text-status-alert">Missing event id.</p>;
  }

  return (
    <div className="max-w-7xl">
      <Link
        to={`/events/${eventId}/zones`}
        className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-primary mb-3"
      >
        <ArrowLeft size={14} />
        Back to zones
      </Link>

      <PageHeader
        title="Add Zone"
        description={`Add a zone to ${event?.name ?? 'this event'}.`}
      />

      <Tabs
        items={tabs}
        activeId={mode}
        onChange={(id) => setMode(id as Mode)}
        className="mb-4"
      />

      {mode === 'import' && (
        <ImportZonesPanel
          eventId={eventId}
          colors={DEFAULT_COLORS}
          onImported={() => navigate(`/events/${eventId}/zones`)}
        />
      )}

      {mode !== 'import' && (
      <form onSubmit={handleSubmit} className="space-y-6">
        {mode === 'draw' && (
          <Card>
            <CardBody className="space-y-3">
              {!mapboxConfigured && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Mapbox token not configured. Drawing requires a token — switch to{' '}
                  <button
                    type="button"
                    onClick={() => setMode('template')}
                    className="font-medium underline"
                  >
                    Use Predefined
                  </button>{' '}
                  for now.
                </div>
              )}
              <p className="text-sm text-text-muted">
                Click polygon → click each vertex of your zone → double-click to close. Use the
                trash icon to start over.
              </p>
              <div className="relative h-[480px] rounded-xl overflow-hidden border border-wp-border bg-white">
                <MapView
                  polygons={[]}
                  onMapReady={handleMapReady}
                  className="absolute inset-0"
                />
              </div>
              {drawn && (
                <p className="text-xs text-primary">
                  Polygon captured · {drawn.coordinates[0].length - 1} vertices
                </p>
              )}
            </CardBody>
          </Card>
        )}

        {mode === 'template' && (
          <Card>
            <CardBody>
              <p className="text-sm text-text-muted mb-4">
                Predefined polygons for Miami-Dade. Click one to use it — you can rename it
                below before saving.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {templates.map((t) => {
                  const active = t.id === selectedTemplateId;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedTemplateId(t.id)}
                      className={cn(
                        'group text-left rounded-xl border p-3 transition-all',
                        active
                          ? 'border-primary ring-2 ring-primary/30 bg-primary-light/40'
                          : 'border-wp-border bg-white hover:border-gray-300',
                      )}
                    >
                      <ZoneThumbnail geometry={t.geometry} color={t.default_color} size={88} />
                      <p className="mt-2 text-xs font-medium text-text-primary truncate">
                        {t.name}
                      </p>
                    </button>
                  );
                })}
              </div>
            </CardBody>
          </Card>
        )}

        <Card>
          <CardBody className="space-y-4">
            <div>
              <label htmlFor="zone_name" className="block text-sm font-medium text-text-body mb-1.5">
                Zone name <span className="text-status-alert">*</span>
              </label>
              <Input
                id="zone_name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Wynwood"
                required
              />
            </div>

            <div>
              <span className="block text-sm font-medium text-text-body mb-1.5">Color</span>
              <div className="flex flex-wrap gap-2">
                {DEFAULT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Choose color ${c}`}
                    onClick={() => setColor(c)}
                    className={cn(
                      'h-7 w-7 rounded-md transition-transform',
                      c === color
                        ? 'ring-2 ring-offset-2 ring-text-primary scale-110'
                        : 'hover:scale-105',
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </CardBody>
        </Card>

        {error && (
          <div
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-status-alert"
            role="alert"
          >
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <Link to={`/events/${eventId}/zones`}>
            <Button type="button" variant="secondary">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Saving…' : (
              <>
                <MapPin size={14} />
                Save zone
              </>
            )}
          </Button>
        </div>
      </form>
      )}
    </div>
  );
}
