import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, LayoutTemplate, MapPin, Upload, X, Trash2, FileUp, Check } from 'lucide-react';
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
import {
  useCreateZone,
  useZoneTemplates,
  useCreateZoneTemplates,
  useDeleteZoneTemplate,
} from '@/hooks/useZones';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';
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
  const createTemplates = useCreateZoneTemplates();
  const deleteTemplate = useDeleteZoneTemplate();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'coc_admin' || user?.role === 'super_admin';

  const [mode, setMode] = useState<Mode>(mapboxConfigured ? 'draw' : 'template');
  const [name, setName] = useState('');
  const [color, setColor] = useState(DEFAULT_COLORS[0]);
  const [drawn, setDrawn] = useState<GeoJSONPolygon | null>(null);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  const [showTemplateImport, setShowTemplateImport] = useState(false);

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

  const toggleTemplate = (id: string) =>
    setSelectedTemplateIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleDeleteTemplate = async (templateId: string, templateName: string) => {
    if (!window.confirm(`Remove the "${templateName}" template from your library?`)) return;
    try {
      await deleteTemplate.mutateAsync(templateId);
      setSelectedTemplateIds((prev) => {
        const next = new Set(prev);
        next.delete(templateId);
        return next;
      });
      toast({ tone: 'success', message: `Removed "${templateName}".` });
    } catch (err) {
      toast({
        tone: 'error',
        message: err instanceof Error ? err.message : 'Could not delete the template.',
      });
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!eventId) return;

    // Template mode: add one zone per selected template (multi-select).
    if (mode === 'template') {
      const chosen = templates.filter((t) => selectedTemplateIds.has(t.id));
      if (chosen.length === 0) {
        setError('Select at least one zone to add.');
        return;
      }
      try {
        for (const t of chosen) {
          await createMutation.mutateAsync({
            name: t.name,
            geometry: t.geometry,
            color: t.default_color,
            template_id: t.id,
          });
        }
        navigate(`/events/${eventId}/zones`);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not add the selected zones.');
      }
      return;
    }

    // Draw mode: single zone from the drawn polygon + name/color.
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    if (!drawn) {
      setError('Draw a polygon on the map first.');
      return;
    }
    try {
      await createMutation.mutateAsync({ name: name.trim(), geometry: drawn, color, template_id: null });
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
          colors={DEFAULT_COLORS}
          onImport={async (items) => {
            for (const it of items) {
              await createMutation.mutateAsync({
                name: it.name,
                geometry: it.geometry,
                color: it.color,
              });
            }
          }}
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
              <div className="mb-3 flex items-start justify-between gap-3">
                <p className="text-sm text-text-muted">
                  Select one or more zones to add — tap to toggle, or use Select all.
                  {isAdmin && ' Import a shapefile or GeoJSON to build your own reusable set.'}
                </p>
                {isAdmin && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="shrink-0"
                    onClick={() => setShowTemplateImport(true)}
                  >
                    <FileUp size={14} />
                    Import from file
                  </Button>
                )}
              </div>

              {templates.length === 0 ? (
                <p className="rounded-lg border border-dashed border-wp-border bg-gray-50 px-4 py-8 text-center text-sm text-text-muted">
                  No saved zones yet.{isAdmin ? ' Use “Import from file” to add yours.' : ''}
                </p>
              ) : (
                <>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-text-primary">
                      {selectedTemplateIds.size} of {templates.length} selected
                    </span>
                    <div className="flex gap-3 text-xs">
                      <button
                        type="button"
                        className="text-primary hover:underline"
                        onClick={() => setSelectedTemplateIds(new Set(templates.map((t) => t.id)))}
                      >
                        Select all
                      </button>
                      <button
                        type="button"
                        className="text-text-muted hover:underline"
                        onClick={() => setSelectedTemplateIds(new Set())}
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {templates.map((t) => {
                      const active = selectedTemplateIds.has(t.id);
                      const canDelete = isAdmin && !!t.org_id && t.org_id === user?.orgId;
                      return (
                        <div key={t.id} className="relative">
                          <button
                            type="button"
                            onClick={() => toggleTemplate(t.id)}
                            className={cn(
                              'group w-full text-left rounded-xl border p-3 transition-all',
                              active
                                ? 'border-primary ring-2 ring-primary/30 bg-primary-light/40'
                                : 'border-wp-border bg-white hover:border-gray-300',
                            )}
                          >
                            <span
                              className={cn(
                                'absolute top-1.5 left-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-md border',
                                active ? 'border-primary bg-primary text-white' : 'border-gray-300 bg-white',
                              )}
                              aria-hidden
                            >
                              {active && <Check size={13} />}
                            </span>
                            <ZoneThumbnail geometry={t.geometry} color={t.default_color} size={88} />
                            <p className="mt-2 text-xs font-medium text-text-primary truncate">
                              {t.name}
                            </p>
                          </button>
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => handleDeleteTemplate(t.id, t.name)}
                              className="absolute top-1.5 right-1.5 rounded-md bg-white/90 p-1 text-text-muted shadow-sm hover:text-status-alert"
                              aria-label={`Delete ${t.name}`}
                              title="Delete template"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </CardBody>
          </Card>
        )}

        {mode === 'draw' && (
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
        )}

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
          <Button
            type="submit"
            disabled={createMutation.isPending || (mode === 'template' && selectedTemplateIds.size === 0)}
          >
            {createMutation.isPending ? (
              'Saving…'
            ) : (
              <>
                <MapPin size={14} />
                {mode === 'template'
                  ? `Add ${selectedTemplateIds.size} zone${selectedTemplateIds.size === 1 ? '' : 's'}`
                  : 'Save zone'}
              </>
            )}
          </Button>
        </div>
      </form>
      )}

      {showTemplateImport && (
        <div
          className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="my-8 w-full max-w-2xl rounded-2xl bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-wp-border px-5 h-14">
              <h3 className="text-sm font-semibold text-text-primary">
                Import zones into your library
              </h3>
              <button
                type="button"
                onClick={() => setShowTemplateImport(false)}
                className="rounded p-1 text-text-muted hover:bg-gray-100"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-4">
              <p className="mb-3 text-xs text-text-muted">
                These become reusable predefined zones for every event in your CoC.
              </p>
              <ImportZonesPanel
                colors={DEFAULT_COLORS}
                ctaLabel={(n) => `Add ${n} template${n === 1 ? '' : 's'}`}
                onImport={(items) => createTemplates.mutateAsync(items)}
                onImported={() => {
                  setShowTemplateImport(false);
                  toast({ tone: 'success', message: 'Zones added to your library.' });
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
