import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardPaste,
  MapPin,
  Plus,
  Tent,
  Trash2,
  X,
  HeartPulse,
} from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { MapView } from '@/components/map/MapView';
import { HOTSPOT_COLORS, HOTSPOT_LABELS, type MapMarker } from '@/components/map/markers';
import { useEvent } from '@/hooks/useEvents';
import { useZonesForEvent } from '@/hooks/useZones';
import {
  useCreateHotspot,
  useCreateHotspotsBatch,
  useDeleteHotspot,
  useHotspotsForEvent,
  useToggleResolved,
} from '@/hooks/useHotspots';
import type { Hotspot } from '@/lib/db/hotspots';
import type { HotspotType, Severity } from '@/lib/database.types';
import { parsePastedHotspots, type ParsedHotspotRow } from '@/lib/parsePastedHotspots';
import { geocodeBatch, type GeocodeResult } from '@/lib/geocoding';
import { mapboxConfigured } from '@/components/map/mapToken';
import { cn } from '@/lib/cn';

// Real Aventura Police Department list from January 2026 PIT planning.
// Used by the "Load sample" button to demonstrate the parser end-to-end.
const AVENTURA_PD_SAMPLE = [
  '19507 Biscayne Blvd (Nordstrom Garage Miami Dade Bus Terminal)\t20',
  '2930 Aventura Blvd (Aventura Library) / & Bus stop on East side\t10',
  '20335 Biscayne Blvd (Chuck E Cheese) / Entire Promenade Plaza\t5',
  '3017 Aventura Blvd (Kosher Kingdom)\t2',
  '3007 Aventura Blvd (Walgreens)\t3',
  '20900 Biscayne Blvd (Aventura Hospital)\t5',
  '18665 Biscayne Blvd (Walgreens)\t2',
  '2952 Aventura Blvd (Publix) / Entire Plaza (Seating area by Old Lisbon)\t5',
  '19925 Biscayne Blvd (Total Wine)\t2',
  '19275 Biscayne Blvd (Jewelers Market)\t1',
  '19505 Biscayne Blvd (Esplanade Area)\t1',
  '20475 Biscayne Blvd\t1',
  '19900 W Country Club DR (Bus Bench)\t1',
  '21265 Biscayne Blvd (Target Plaza)\t2',
  '2906 NE 207th ST\t1',
].join('\n');

export function HotspotsPage() {
  const { id: eventId } = useParams<{ id: string }>();
  const { data: event } = useEvent(eventId);
  const { data: zones = [] } = useZonesForEvent(eventId);
  const { data: hotspots = [], isLoading } = useHotspotsForEvent(eventId);
  const toggleMutation = useToggleResolved(eventId ?? '');
  const deleteMutation = useDeleteHotspot(eventId ?? '');

  const [addOpen, setAddOpen] = useState(false);
  const [highlightId, setHighlightId] = useState<string | undefined>(undefined);

  const markers: MapMarker[] = useMemo(
    () =>
      hotspots.map((h) => ({
        id: h.id,
        lng: h.gps_lng,
        lat: h.gps_lat,
        hotspot_type: h.hotspot_type,
        severity: h.severity,
        expected_count: h.expected_count,
        resolved: h.resolved,
        label: h.name,
      })),
    [hotspots],
  );

  const polygons = useMemo(
    () =>
      zones.map((z) => ({
        id: z.id,
        name: z.name,
        geometry: z.geometry,
        color: z.color,
      })),
    [zones],
  );

  const unresolved = hotspots.filter((h) => !h.resolved).length;
  const resolved = hotspots.length - unresolved;

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
        title="Hotspots"
        description={
          hotspots.length > 0
            ? `${unresolved} unresolved · ${resolved} resolved`
            : 'Location intel from police, outreach providers, or prior counts — shown to volunteers on the field-app map.'
        }
        actions={
          <Button onClick={() => setAddOpen(true)}>
            <Plus size={16} />
            Add Hotspots
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <div className="space-y-3">
          {isLoading && <p className="text-sm text-text-muted">Loading hotspots…</p>}

          {!isLoading && hotspots.length === 0 && (
            <Card>
              <EmptyState
                icon={<MapPin size={18} />}
                title="No hotspots yet"
                description="Paste a list of addresses from police or outreach intel — they'll be geocoded and shown to volunteers on the map."
                action={
                  <Button size="sm" onClick={() => setAddOpen(true)}>
                    <ClipboardPaste size={14} />
                    Paste addresses
                  </Button>
                }
              />
            </Card>
          )}

          {hotspots.map((h) => (
            <HotspotRow
              key={h.id}
              hotspot={h}
              highlighted={h.id === highlightId}
              onHover={setHighlightId}
              onToggleResolved={() => toggleMutation.mutate(h.id)}
              onDelete={() => deleteMutation.mutate(h.id)}
            />
          ))}
        </div>

        <div className="relative h-[560px] lg:h-[640px] rounded-xl overflow-hidden border border-wp-border bg-white">
          <MapView
            polygons={polygons}
            markers={markers}
            onMarkerClick={setHighlightId}
            className="absolute inset-0"
          />
        </div>
      </div>

      {addOpen && (
        <AddHotspotsModal eventId={eventId} onClose={() => setAddOpen(false)} />
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Hotspot row
// -----------------------------------------------------------------------------

const typeIcons: Record<HotspotType, JSX.Element> = {
  sighting: <MapPin size={14} />,
  encampment: <Tent size={14} />,
  hazard: <AlertTriangle size={14} />,
  resource: <HeartPulse size={14} />,
};

const severityTone: Record<Severity, BadgeTone> = {
  low: 'neutral',
  medium: 'pending',
  high: 'alert',
};

interface HotspotRowProps {
  hotspot: Hotspot;
  highlighted: boolean;
  onHover: (id: string | undefined) => void;
  onToggleResolved: () => void;
  onDelete: () => void;
}

function HotspotRow({ hotspot, highlighted, onHover, onToggleResolved, onDelete }: HotspotRowProps) {
  return (
    <Card
      onMouseEnter={() => onHover(hotspot.id)}
      onMouseLeave={() => onHover(undefined)}
      className={cn(
        'transition-shadow',
        highlighted ? 'ring-2 ring-primary ring-offset-2 ring-offset-page-bg' : '',
        hotspot.resolved ? 'opacity-70' : '',
      )}
    >
      <CardBody className="flex items-start gap-3">
        <span
          className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full shrink-0 text-white"
          style={{ backgroundColor: HOTSPOT_COLORS[hotspot.hotspot_type] }}
          aria-hidden
        >
          {typeIcons[hotspot.hotspot_type]}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold text-text-primary truncate">{hotspot.name}</h3>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={onToggleResolved}
                className={cn(
                  'p-1 rounded hover:bg-gray-100',
                  hotspot.resolved ? 'text-primary' : 'text-text-muted',
                )}
                aria-label={hotspot.resolved ? 'Reopen' : 'Mark resolved'}
                title={hotspot.resolved ? 'Reopen' : 'Mark resolved'}
              >
                <CheckCircle2 size={14} />
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="p-1 text-text-muted hover:text-status-alert"
                aria-label={`Delete ${hotspot.name}`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge tone="neutral">{HOTSPOT_LABELS[hotspot.hotspot_type]}</Badge>
            <Badge tone={severityTone[hotspot.severity]}>{hotspot.severity}</Badge>
            {hotspot.expected_count != null && (
              <span className="text-xs font-medium text-text-primary">
                ~{hotspot.expected_count} expected
              </span>
            )}
            {hotspot.source && (
              <span className="text-xs text-text-muted">· {hotspot.source}</span>
            )}
            {hotspot.resolved && (
              <span className="text-xs text-primary inline-flex items-center gap-1">
                · Resolved
              </span>
            )}
          </div>

          {hotspot.description && (
            <p className="mt-1 text-xs text-text-muted line-clamp-2">{hotspot.description}</p>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

// -----------------------------------------------------------------------------
// Add modal — Single + Bulk Paste tabs
// -----------------------------------------------------------------------------

interface AddHotspotsModalProps {
  eventId: string;
  onClose: () => void;
}

interface ReviewRow {
  parsed: ParsedHotspotRow;
  geocode: GeocodeResult;
  selected: boolean;
}

function AddHotspotsModal({ eventId, onClose }: AddHotspotsModalProps) {
  const [mode, setMode] = useState<'single' | 'bulk'>('bulk');
  const createSingle = useCreateHotspot(eventId);
  const createBatch = useCreateHotspotsBatch(eventId);

  // single mode
  const [sName, setSName] = useState('');
  const [sType, setSType] = useState<HotspotType>('sighting');
  const [sSeverity, setSSeverity] = useState<Severity>('medium');
  const [sExpected, setSExpected] = useState('');
  const [sLat, setSLat] = useState('');
  const [sLng, setSLng] = useState('');
  const [sNotes, setSNotes] = useState('');

  // bulk mode
  const [pasted, setPasted] = useState('');
  const [reviewing, setReviewing] = useState<ReviewRow[] | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tabs: TabItem[] = [
    { id: 'bulk', label: 'Bulk Paste', icon: <ClipboardPaste size={14} /> },
    { id: 'single', label: 'Single', icon: <Plus size={14} /> },
  ];

  const handleSingleSave = async () => {
    setError(null);
    const lat = parseFloat(sLat);
    const lng = parseFloat(sLng);
    if (!sName.trim()) {
      setError('Name is required.');
      return;
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setError('Latitude and longitude must be numbers.');
      return;
    }
    try {
      const expectedNum = sExpected.trim() === '' ? null : parseInt(sExpected, 10);
      await createSingle.mutateAsync({
        name: sName.trim(),
        hotspot_type: sType,
        severity: sSeverity,
        expected_count: Number.isFinite(expectedNum as number) ? expectedNum : null,
        gps_lat: lat,
        gps_lng: lng,
        description: sNotes.trim() || null,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save hotspot.');
    }
  };

  const handleGeocode = async () => {
    setError(null);
    const parsed = parsePastedHotspots(pasted);
    if (parsed.length === 0) {
      setError('Nothing to geocode. Paste at least one address.');
      return;
    }
    setGeocoding(true);
    try {
      const results = await geocodeBatch(parsed.map((p) => p.address));
      setReviewing(
        parsed.map((p, i) => ({
          parsed: p,
          geocode: results[i],
          selected: results[i].ok,
        })),
      );
    } finally {
      setGeocoding(false);
    }
  };

  const handleCommitBatch = async () => {
    if (!reviewing) return;
    const inputs = reviewing
      .filter((r) => r.selected && r.geocode.ok && r.geocode.lat != null && r.geocode.lng != null)
      .map((r) => ({
        name: r.parsed.name,
        hotspot_type: r.parsed.hotspot_type,
        severity: r.parsed.severity,
        expected_count: r.parsed.expected_count,
        source: r.parsed.source,
        description: r.parsed.description,
        gps_lat: r.geocode.lat as number,
        gps_lng: r.geocode.lng as number,
      }));
    if (inputs.length === 0) {
      setError('Pick at least one row to add.');
      return;
    }
    try {
      await createBatch.mutateAsync(inputs);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save hotspots.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-lg my-8">
        <div className="flex items-center justify-between border-b border-wp-border px-5 py-3">
          <h2 className="text-base font-semibold text-text-primary">Add Hotspots</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-text-muted hover:bg-gray-100"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 pt-4">
          <Tabs items={tabs} activeId={mode} onChange={(id) => setMode(id as 'single' | 'bulk')} />
        </div>

        <div className="px-5 py-4 space-y-4">
          {mode === 'bulk' && (
            <>
              {!reviewing && (
                <>
                  <p className="text-sm text-text-muted">
                    Paste a list of addresses — one per line. Tab-separated columns from a Word
                    or Excel table work directly. Optional metadata after{' '}
                    <code className="font-mono text-xs bg-gray-100 px-1 rounded">|</code> or{' '}
                    <code className="font-mono text-xs bg-gray-100 px-1 rounded">—</code> (type,
                    severity, source, notes). A trailing integer is read as &ldquo;# of persons
                    expected&rdquo;.
                  </p>

                  <Textarea
                    rows={9}
                    placeholder={`19507 Biscayne Blvd (Nordstrom Garage)\t20\n2930 Aventura Blvd (Library) / & Bus stop on East side\t10\n850 NE 79th St — frequent sightings\n`}
                    value={pasted}
                    onChange={(e) => setPasted(e.target.value)}
                  />

                  <div>
                    <button
                      type="button"
                      onClick={() => setPasted(AVENTURA_PD_SAMPLE)}
                      className="text-xs font-medium text-primary hover:text-primary-hover underline-offset-2 hover:underline"
                    >
                      Load Aventura PD sample (real January 2026 list)
                    </button>
                  </div>

                  {!mapboxConfigured && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      Mapbox token not configured. Demo mode will scatter pasted addresses near
                      Miami-Dade so the rest of the flow is testable; real geocoding will run as
                      soon as the token is set.
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2">
                    <Button variant="secondary" onClick={onClose}>
                      Cancel
                    </Button>
                    <Button onClick={handleGeocode} disabled={geocoding || !pasted.trim()}>
                      {geocoding ? 'Geocoding…' : 'Geocode addresses'}
                    </Button>
                  </div>
                </>
              )}

              {reviewing && (
                <ReviewTable
                  rows={reviewing}
                  onChange={setReviewing}
                  onBack={() => setReviewing(null)}
                  onCommit={handleCommitBatch}
                  isPending={createBatch.isPending}
                />
              )}
            </>
          )}

          {mode === 'single' && (
            <div className="space-y-4">
              <div>
                <label htmlFor="hs_name" className="block text-sm font-medium text-text-body mb-1.5">
                  Name <span className="text-status-alert">*</span>
                </label>
                <Input
                  id="hs_name"
                  value={sName}
                  onChange={(e) => setSName(e.target.value)}
                  placeholder="e.g. Under I-95 at NW 8th St"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="hs_type" className="block text-sm font-medium text-text-body mb-1.5">
                    Type
                  </label>
                  <select
                    id="hs_type"
                    value={sType}
                    onChange={(e) => setSType(e.target.value as HotspotType)}
                    className="block w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {(Object.keys(HOTSPOT_LABELS) as HotspotType[]).map((t) => (
                      <option key={t} value={t}>
                        {HOTSPOT_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="hs_sev" className="block text-sm font-medium text-text-body mb-1.5">
                    Severity
                  </label>
                  <select
                    id="hs_sev"
                    value={sSeverity}
                    onChange={(e) => setSSeverity(e.target.value as Severity)}
                    className="block w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="hs_expected" className="block text-sm font-medium text-text-body mb-1.5">
                  Expected # of persons
                </label>
                <Input
                  id="hs_expected"
                  type="number"
                  min={0}
                  value={sExpected}
                  onChange={(e) => setSExpected(e.target.value)}
                  placeholder="e.g. 20"
                  className="max-w-[160px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="hs_lat" className="block text-sm font-medium text-text-body mb-1.5">
                    Latitude
                  </label>
                  <Input
                    id="hs_lat"
                    value={sLat}
                    onChange={(e) => setSLat(e.target.value)}
                    placeholder="25.7780"
                  />
                </div>
                <div>
                  <label htmlFor="hs_lng" className="block text-sm font-medium text-text-body mb-1.5">
                    Longitude
                  </label>
                  <Input
                    id="hs_lng"
                    value={sLng}
                    onChange={(e) => setSLng(e.target.value)}
                    placeholder="-80.1937"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="hs_notes" className="block text-sm font-medium text-text-body mb-1.5">
                  Notes
                </label>
                <Textarea
                  id="hs_notes"
                  value={sNotes}
                  onChange={(e) => setSNotes(e.target.value)}
                  placeholder="Describe the location — never any personal details about individuals."
                  rows={3}
                />
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-status-alert">
                  {error}
                </div>
              )}

              <div className="flex items-center justify-end gap-2">
                <Button variant="secondary" onClick={onClose}>
                  Cancel
                </Button>
                <Button onClick={handleSingleSave} disabled={createSingle.isPending}>
                  {createSingle.isPending ? 'Saving…' : 'Save hotspot'}
                </Button>
              </div>
            </div>
          )}

          {error && mode === 'bulk' && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-status-alert">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Bulk-paste review table
// -----------------------------------------------------------------------------

interface ReviewTableProps {
  rows: ReviewRow[];
  onChange: (rows: ReviewRow[]) => void;
  onBack: () => void;
  onCommit: () => void;
  isPending: boolean;
}

function ReviewTable({ rows, onChange, onBack, onCommit, isPending }: ReviewTableProps) {
  const okCount = rows.filter((r) => r.selected && r.geocode.ok).length;
  const failCount = rows.filter((r) => !r.geocode.ok).length;

  return (
    <>
      <p className="text-sm text-text-muted">
        Review and adjust — uncheck rows you don&rsquo;t want, or click <em>Back</em> to fix the
        paste. {okCount} ready to add{failCount > 0 ? `, ${failCount} need a fix` : ''}.
      </p>

      <div className="rounded-lg border border-wp-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-text-muted">
            <tr>
              <th className="px-3 py-2 text-left w-8"> </th>
              <th className="px-3 py-2 text-left">Address</th>
              <th className="px-3 py-2 text-left">Geocoded to</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-left">Severity</th>
              <th className="px-3 py-2 text-left"># Expected</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const ok = r.geocode.ok && r.geocode.lat != null && r.geocode.lng != null;
              return (
                <tr key={i} className={cn('border-t border-wp-border', !ok && 'bg-red-50/40')}>
                  <td className="px-3 py-2 align-middle">
                    <input
                      type="checkbox"
                      checked={r.selected}
                      onChange={(e) => {
                        const next = rows.slice();
                        next[i] = { ...r, selected: e.target.checked };
                        onChange(next);
                      }}
                      disabled={!ok}
                      className="h-4 w-4 accent-primary"
                    />
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <div className="text-text-primary font-medium">{r.parsed.address}</div>
                    {r.parsed.description && (
                      <div className="text-xs text-text-muted">{r.parsed.description}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 align-middle">
                    {ok ? (
                      <div className="text-xs">
                        <div className="text-text-primary">{r.geocode.resolvedAddress}</div>
                        <div className="text-text-muted font-mono">
                          {r.geocode.lat?.toFixed(5)}, {r.geocode.lng?.toFixed(5)}
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-status-alert">
                        {r.geocode.error ?? 'Not found'}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <select
                      value={r.parsed.hotspot_type}
                      onChange={(e) => {
                        const next = rows.slice();
                        next[i] = {
                          ...r,
                          parsed: { ...r.parsed, hotspot_type: e.target.value as HotspotType },
                        };
                        onChange(next);
                      }}
                      className="rounded-md border border-gray-300 bg-white text-xs px-2 py-1"
                    >
                      {(Object.keys(HOTSPOT_LABELS) as HotspotType[]).map((t) => (
                        <option key={t} value={t}>
                          {HOTSPOT_LABELS[t]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <select
                      value={r.parsed.severity}
                      onChange={(e) => {
                        const next = rows.slice();
                        next[i] = {
                          ...r,
                          parsed: { ...r.parsed, severity: e.target.value as Severity },
                        };
                        onChange(next);
                      }}
                      className="rounded-md border border-gray-300 bg-white text-xs px-2 py-1"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <input
                      type="number"
                      min={0}
                      value={r.parsed.expected_count ?? ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        const next = rows.slice();
                        next[i] = {
                          ...r,
                          parsed: {
                            ...r.parsed,
                            expected_count: v === '' ? null : parseInt(v, 10),
                          },
                        };
                        onChange(next);
                      }}
                      className="rounded-md border border-gray-300 bg-white text-xs px-2 py-1 w-16"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onCommit} disabled={isPending || okCount === 0}>
          {isPending ? 'Saving…' : `Add ${okCount} hotspot${okCount === 1 ? '' : 's'}`}
        </Button>
      </div>
    </>
  );
}
