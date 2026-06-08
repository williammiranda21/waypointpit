import { useEffect, useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { Flame, Layers as LayersIcon, TrendingUp, Map as MapIcon } from 'lucide-react';
import { MapView, type ChoroplethBucket, type HeatmapPoint, type MapPolygon } from '@/components/map/MapView';
import { Card } from '@/components/ui/Card';
import { Tabs } from '@/components/ui/Tabs';
import { Toggle } from '@/components/ui/Toggle';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { EventSelector } from '@/components/analysis/EventSelector';
import { BarChart, type BarDatum } from '@/components/analysis/BarChart';
import { AiPanel } from '@/components/analysis/AiPanel';
import { Legend } from '@/components/analysis/Legend';
import { useEventsList } from '@/hooks/useEvents';
import { useBoundaryLayer } from '@/hooks/useBoundaryLayer';
import { listSubmissionsForEvent } from '@/lib/db/submissions';
import { listZonesForEvent } from '@/lib/db/zones';
import { BOUNDARY_LAYERS, type BoundaryLayerId } from '@/lib/boundaries';
import {
  aggregateByBoundary,
  aggregateByEvent,
  extractNotesThemes,
  makeChoroplethRamp,
  type CountEvent,
  type Submission,
  type Zone,
} from '@/lib/analytics';
import {
  generateChoroplethAnomalies,
  generateHeatmapNarrative,
  generateTrendExplanation,
  type InsightResult,
} from '@/lib/ai/insights';

type AnalysisMode = 'heatmap' | 'layer' | 'trend';

export function AnalysisPage() {
  const { data: events = [], isLoading } = useEventsList();
  const [mode, setMode] = useState<AnalysisMode>('heatmap');
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([]);

  // Default selection: all non-draft events.
  useEffect(() => {
    if (selectedEventIds.length > 0) return;
    const def = events.filter((e) => e.status !== 'draft').map((e) => e.id);
    if (def.length > 0) setSelectedEventIds(def);
  }, [events, selectedEventIds.length]);

  // Fetch submissions + zones for every selected event in parallel.
  const submissionsResults = useQueries({
    queries: selectedEventIds.map((id) => ({
      queryKey: ['submissions', 'event', id],
      queryFn: () => listSubmissionsForEvent(id),
    })),
  });
  const zonesResults = useQueries({
    queries: selectedEventIds.map((id) => ({
      queryKey: ['zones', 'event', id],
      queryFn: () => listZonesForEvent(id),
    })),
  });

  const submissions: Submission[] = useMemo(
    () => submissionsResults.flatMap((r) => r.data ?? []),
    [submissionsResults],
  );
  const zones: Zone[] = useMemo(
    () => zonesResults.flatMap((r) => r.data ?? []),
    [zonesResults],
  );

  const selectedEvents = useMemo(
    () => events.filter((e) => selectedEventIds.includes(e.id)),
    [events, selectedEventIds],
  );

  const toggleEvent = (id: string) =>
    setSelectedEventIds((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );

  if (isLoading) {
    return <p className="text-sm text-text-muted">Loading events…</p>;
  }
  if (events.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<MapIcon size={18} />}
          title="No events yet"
          description="Create a count event first to start analyzing."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Analysis"
        description="Heat maps, boundary aggregations, and AI-powered insights across one or more events."
      />

      <EventSelector
        events={events}
        selectedIds={selectedEventIds}
        onToggle={toggleEvent}
      />

      <Tabs
        activeId={mode}
        onChange={(id) => setMode(id as AnalysisMode)}
        items={[
          { id: 'heatmap', label: 'Heatmap', icon: <Flame size={14} /> },
          { id: 'layer', label: 'By Layer', icon: <LayersIcon size={14} /> },
          { id: 'trend', label: 'Over Time', icon: <TrendingUp size={14} /> },
        ]}
      />

      {mode === 'heatmap' && (
        <HeatmapMode
          events={selectedEvents}
          zones={zones}
          submissions={submissions}
        />
      )}
      {mode === 'layer' && (
        <ByLayerMode
          events={selectedEvents}
          zones={zones}
          submissions={submissions}
        />
      )}
      {mode === 'trend' && (
        <OverTimeMode
          events={selectedEvents}
          zones={zones}
          submissions={submissions}
        />
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Heatmap mode
// -----------------------------------------------------------------------------

function HeatmapMode({
  events,
  zones,
  submissions,
}: {
  events: CountEvent[];
  zones: Zone[];
  submissions: Submission[];
}) {
  const [showZones, setShowZones] = useState(true);
  const [insight, setInsight] = useState<InsightResult | null>(null);

  const points: HeatmapPoint[] = useMemo(
    () =>
      submissions.map((s) => ({
        lng: s.gps_lng,
        lat: s.gps_lat,
        weight: s.person_count,
      })),
    [submissions],
  );

  const polygons: MapPolygon[] = useMemo(
    () =>
      showZones
        ? zones.map((z) => ({ id: z.id, name: z.name, geometry: z.geometry, color: z.color }))
        : [],
    [zones, showZones],
  );

  const topZones = useMemo(() => {
    const totals = new Map<string, { name: string; count: number }>();
    const zoneById = new Map(zones.map((z) => [z.id, z]));
    for (const s of submissions) {
      const z = zoneById.get(s.zone_id);
      const name = z?.name ?? 'Unassigned';
      const cur = totals.get(name) ?? { name, count: 0 };
      cur.count += s.person_count;
      totals.set(name, cur);
    }
    return Array.from(totals.values()).sort((a, b) => b.count - a.count);
  }, [zones, submissions]);

  const eventTotals = useMemo(() => aggregateByEvent(events, zones, submissions), [events, zones, submissions]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-4">
      <Card className="relative overflow-hidden lg:h-[calc(100vh-340px)] lg:min-h-[440px]">
        <div className="absolute top-3 right-3 z-10 bg-white/95 border border-wp-border rounded-lg px-3 py-2 shadow-sm">
          <Toggle
            label={<span className="text-xs">Show zones</span>}
            checked={showZones}
            onChange={(e) => setShowZones(e.target.checked)}
          />
        </div>
        {points.length === 0 ? (
          <div className="p-6 h-full flex items-center justify-center">
            <EmptyState
              icon={<Flame size={18} />}
              title="No submissions in the selected events"
              description="Select one or more events with submission data to render the heatmap."
            />
          </div>
        ) : (
          <>
            <MapView
              polygons={polygons}
              heatmapPoints={points}
              className="absolute inset-0"
              fitToPolygons={polygons.length > 0}
            />
            <Legend
              title="Density"
              stops={[
                { color: '#22C55E', label: 'Low' },
                { color: '#F59E0B', label: 'Med' },
                { color: '#EF4444', label: 'High' },
              ]}
            />
          </>
        )}
      </Card>

      <AiPanel
        title="Heatmap narrative"
        description="Summary of where counts are concentrated across the selected events."
        result={insight}
        onGenerate={async () => {
          const r = await generateHeatmapNarrative({ events: eventTotals, topZones });
          setInsight(r);
          return r;
        }}
      />
    </div>
  );
}

// -----------------------------------------------------------------------------
// By-Layer mode (choropleth)
// -----------------------------------------------------------------------------

function ByLayerMode({
  events,
  zones,
  submissions,
}: {
  events: CountEvent[];
  zones: Zone[];
  submissions: Submission[];
}) {
  const [layerId, setLayerId] = useState<BoundaryLayerId>('mdc_commission');
  const [insight, setInsight] = useState<InsightResult | null>(null);
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null);

  const { data: features = [] } = useBoundaryLayer(layerId);
  const layerLabel = BOUNDARY_LAYERS.find((l) => l.id === layerId)?.label ?? '';

  const eventTotals = useMemo(
    () => aggregateByEvent(events, zones, submissions),
    [events, zones, submissions],
  );

  const { aggregates, unassigned } = useMemo(
    () => aggregateByBoundary(features, submissions),
    [features, submissions],
  );

  const max = useMemo(
    () => Math.max(0, ...aggregates.map((a) => a.personCount)),
    [aggregates],
  );
  const ramp = useMemo(() => makeChoroplethRamp(max), [max]);

  const polygons: MapPolygon[] = useMemo(
    () =>
      features.map((f) => ({
        id: f.id,
        name: f.name,
        geometry: f.geometry,
        color: '#6B7280',
      })),
    [features],
  );

  const choropleth: ChoroplethBucket[] = useMemo(
    () =>
      aggregates.map((a) => ({
        id: a.feature.id,
        fillColor: ramp(a.personCount),
        fillOpacity: a.personCount > 0 ? 0.65 : 0.12,
      })),
    [aggregates, ramp],
  );

  const selected = useMemo(
    () => (selectedFeatureId ? aggregates.find((a) => a.feature.id === selectedFeatureId) : null),
    [aggregates, selectedFeatureId],
  );

  const topAgg = useMemo(
    () =>
      [...aggregates]
        .filter((a) => a.personCount > 0)
        .sort((a, b) => b.personCount - a.personCount)
        .slice(0, 8),
    [aggregates],
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-4">
      <div className="space-y-3">
        <Card className="px-3 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
            Boundary layer
          </p>
          <div className="flex flex-wrap gap-2">
            {BOUNDARY_LAYERS.map((l) => {
              const active = l.id === layerId;
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => {
                    setLayerId(l.id);
                    setSelectedFeatureId(null);
                  }}
                  aria-pressed={active}
                  className={
                    'inline-flex items-center rounded-md px-3 h-8 text-xs font-medium border transition-colors ' +
                    (active
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white text-text-body border-wp-border hover:bg-gray-50')
                  }
                  title={l.description}
                >
                  {l.label}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-text-muted">
            {BOUNDARY_LAYERS.find((l) => l.id === layerId)?.description}
          </p>
        </Card>

        <Card className="relative overflow-hidden lg:h-[calc(100vh-460px)] lg:min-h-[400px]">
          {polygons.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<MapIcon size={18} />}
                title="Layer loading…"
                description="Boundaries will appear in a moment."
              />
            </div>
          ) : (
            <>
              <MapView
                polygons={polygons}
                choropleth={choropleth}
                highlightId={selectedFeatureId ?? undefined}
                onPolygonClick={(id) => setSelectedFeatureId(id)}
                className="absolute inset-0"
              />
              <Legend
                title="Persons"
                stops={[
                  { color: '#F3F4F6', label: '0' },
                  { color: '#DCFCE7', label: '·' },
                  { color: '#86EFAC', label: '·' },
                  { color: '#FCD34D', label: '·' },
                  { color: '#F97316', label: '·' },
                  { color: '#DC2626', label: `${max}` },
                ]}
              />
              {selected && (
                <div className="absolute right-3 top-3 z-10 w-[260px] rounded-xl bg-white border border-wp-border shadow-sm p-3 text-xs">
                  <p className="text-[10px] uppercase tracking-wider text-text-muted">
                    {layerLabel}
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-text-primary">
                    {selected.feature.name}
                  </p>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <Stat label="Persons" value={selected.personCount} />
                    <Stat label="Submissions" value={selected.submissionCount} />
                    <Stat label="Surveys" value={selected.surveyCount} />
                  </div>
                </div>
              )}
            </>
          )}
        </Card>

        {topAgg.length > 0 && (
          <Card className="p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
              Top polygons by persons
            </p>
            <div className="overflow-x-auto">
              <BarChart
                data={topAgg.map((a) => ({
                  label: a.feature.name,
                  value: a.personCount,
                  color: ramp(a.personCount),
                }))}
                height={180}
              />
            </div>
            {unassigned.length > 0 && (
              <p className="mt-2 text-[11px] text-text-muted">
                {unassigned.length} submission{unassigned.length === 1 ? '' : 's'} fell outside
                every polygon in this layer.
              </p>
            )}
          </Card>
        )}
      </div>

      <AiPanel
        title="Anomaly callouts"
        description="Outliers and concentration patterns for the chosen layer."
        result={insight}
        onGenerate={async () => {
          const r = await generateChoroplethAnomalies({
            layerLabel,
            aggregates,
            events: eventTotals,
          });
          setInsight(r);
          return r;
        }}
      />
    </div>
  );
}

// -----------------------------------------------------------------------------
// Over-Time mode
// -----------------------------------------------------------------------------

function OverTimeMode({
  events,
  zones,
  submissions,
}: {
  events: CountEvent[];
  zones: Zone[];
  submissions: Submission[];
}) {
  const [insight, setInsight] = useState<InsightResult | null>(null);
  const totals = useMemo(() => aggregateByEvent(events, zones, submissions), [events, zones, submissions]);
  const sorted = useMemo(
    () => [...totals].sort((a, b) => a.countDate.localeCompare(b.countDate)),
    [totals],
  );
  const themes = useMemo(() => extractNotesThemes(submissions), [submissions]);

  const totalBars: BarDatum[] = sorted.map((t) => ({
    label: t.eventName,
    value: t.totalPersons,
  }));
  const submissionBars: BarDatum[] = sorted.map((t) => ({
    label: t.eventName,
    value: t.submissionCount,
    color: '#3B82F6',
  }));

  // Per-location-type (stacked) — for now show the dominant 3 location types.
  const locationCounts = useMemo(() => {
    const totalsByType: Record<string, number> = {};
    for (const t of sorted) {
      for (const [k, v] of Object.entries(t.perLocationType)) {
        totalsByType[k] = (totalsByType[k] ?? 0) + v;
      }
    }
    return Object.entries(totalsByType)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [sorted]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-4">
      <div className="space-y-3">
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
            Total persons per event
          </p>
          {sorted.length === 0 ? (
            <p className="text-sm text-text-muted py-4">No events selected.</p>
          ) : (
            <div className="overflow-x-auto">
              <BarChart data={totalBars} height={200} yLabel="Persons" />
            </div>
          )}
        </Card>

        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
            Submissions per event
          </p>
          {sorted.length === 0 ? (
            <p className="text-sm text-text-muted py-4">No events selected.</p>
          ) : (
            <div className="overflow-x-auto">
              <BarChart data={submissionBars} height={180} yLabel="Submissions" defaultColor="#3B82F6" />
            </div>
          )}
        </Card>

        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
            Location type distribution (selected events)
          </p>
          {locationCounts.length === 0 ? (
            <p className="text-sm text-text-muted py-4">No data.</p>
          ) : (
            <div className="overflow-x-auto">
              <BarChart
                data={locationCounts.map(([k, v]) => ({ label: k, value: v }))}
                height={170}
                defaultColor="#F59E0B"
              />
            </div>
          )}
        </Card>

        {themes.length > 0 && (
          <Card className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
              Notes themes (word frequency)
            </p>
            <div className="flex flex-wrap gap-2">
              {themes.map((t) => (
                <span
                  key={t.term}
                  className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs"
                  style={{ fontSize: `${11 + Math.min(7, t.count)}px` }}
                  title={`Mentioned in ${t.count} submission${t.count === 1 ? '' : 's'}`}
                >
                  <span className="font-medium text-text-primary">{t.term}</span>
                  <span className="ml-1.5 text-text-muted">×{t.count}</span>
                </span>
              ))}
            </div>
          </Card>
        )}
      </div>

      <AiPanel
        title="Trend explanation"
        description="What changed across events — magnitudes, location-type shifts, recurring themes."
        result={insight}
        onGenerate={async () => {
          const r = await generateTrendExplanation({
            events: sorted,
            topThemes: themes,
            submissions,
          });
          setInsight(r);
          return r;
        }}
      />
    </div>
  );
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-text-muted">{label}</p>
      <p className="text-lg font-bold text-text-primary leading-none mt-0.5">{value}</p>
    </div>
  );
}
