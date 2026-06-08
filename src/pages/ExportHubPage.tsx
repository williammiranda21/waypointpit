import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import {
  FileSpreadsheet,
  FileText,
  Upload,
  Trash2,
  Download,
  AlertCircle,
  Map as MapIcon,
  Loader2,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { useEventsList } from '@/hooks/useEvents';
import { listSubmissionsForEvent } from '@/lib/db/submissions';
import { listZonesForEvent } from '@/lib/db/zones';
import {
  clearStoredApr,
  loadStoredApr,
  parseAprUpload,
  saveStoredApr,
  type AprProportions,
} from '@/lib/exports/aprParser';
import { extrapolate, type ExtrapolationResult } from '@/lib/exports/extrapolator';
import { buildPitExcel, downloadBlob } from '@/lib/exports/pitExcelWriter';
import type { Tables } from '@/lib/database.types';

export function ExportHubPage() {
  const { eventId } = useParams<{ eventId?: string }>();
  const navigate = useNavigate();
  const { data: events = [], isLoading } = useEventsList();

  // Resolve active event from URL or sensible default.
  const event = useMemo<Tables<'count_events'> | null>(() => {
    if (eventId) return events.find((e) => e.id === eventId) ?? null;
    const active = events.find((e) => e.status === 'active');
    return active ?? events[0] ?? null;
  }, [eventId, events]);

  // Auto-navigate if no event in URL but events exist.
  useEffect(() => {
    if (!eventId && event) {
      navigate(`/export/${event.id}`, { replace: true });
    }
  }, [eventId, event, navigate]);

  if (isLoading) return <p className="text-sm text-text-muted">Loading events…</p>;

  if (events.length === 0) {
    return (
      <div className="space-y-4">
        <PageHeader title="Exports" description="HUD PIT submission Excel + Executive Report PDF." />
        <Card>
          <EmptyState
            icon={<FileSpreadsheet size={18} />}
            title="No events yet"
            description="Create a count event before exporting."
          />
        </Card>
      </div>
    );
  }

  if (!event) {
    return <p className="text-sm text-text-muted">Event not found.</p>;
  }

  return <ExportHubContent event={event} events={events} />;
}

function ExportHubContent({
  event,
  events,
}: {
  event: Tables<'count_events'>;
  events: Tables<'count_events'>[];
}) {
  const navigate = useNavigate();

  const [{ data: submissions = [] }] = useQueries({
    queries: [
      {
        queryKey: ['submissions', 'event', event.id],
        queryFn: () => listSubmissionsForEvent(event.id),
      },
      {
        queryKey: ['zones', 'event', event.id],
        queryFn: () => listZonesForEvent(event.id),
      },
    ],
  });

  const [apr, setApr] = useState<AprProportions | null>(() => loadStoredApr());
  const [aprError, setAprError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [excelBuilding, setExcelBuilding] = useState(false);
  const [hudNum, setHudNum] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalPersons = useMemo(
    () => submissions.reduce((s, x) => s + x.person_count, 0),
    [submissions],
  );

  const extrapolation: ExtrapolationResult | null = useMemo(() => {
    if (!apr) return null;
    return extrapolate({ submissions, apr });
  }, [submissions, apr]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setAprError(null);
    setParsing(true);
    try {
      const parsed = await parseAprUpload(files[0]);
      setApr(parsed);
      saveStoredApr(parsed);
    } catch (e) {
      setAprError(e instanceof Error ? e.message : String(e));
    } finally {
      setParsing(false);
    }
  };

  const handleClearApr = () => {
    setApr(null);
    clearStoredApr();
  };

  const handleDownloadExcel = async () => {
    if (!extrapolation) return;
    setExcelBuilding(true);
    try {
      const blob = await buildPitExcel({
        values: extrapolation.values,
        event,
        hudNum,
        cocCode: 'FL-600',
      });
      downloadBlob(blob, fileNameFor(event, 'PIT_HUD_Submission', 'xlsx'));
    } catch (e) {
      setAprError(e instanceof Error ? e.message : String(e));
    } finally {
      setExcelBuilding(false);
    }
  };

  const handleOpenPdf = () => {
    if (!extrapolation) return;
    // Open the executive-report route with the same eventId in a new tab so
    // the user can print to PDF from there.
    window.open(
      `/export/${event.id}/report?print=1`,
      '_blank',
      'noopener,noreferrer',
    );
  };

  const handleGeoJson = () => {
    const fc = {
      type: 'FeatureCollection',
      features: submissions.map((s) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [s.gps_lng, s.gps_lat] },
        properties: {
          id: s.id,
          person_count: s.person_count,
          submission_type: s.submission_type,
          location_type: s.location_type,
          submitted_at: s.device_submitted_at,
          outside_zone: s.outside_zone,
        },
      })),
    };
    const blob = new Blob([JSON.stringify(fc, null, 2)], { type: 'application/geo+json' });
    downloadBlob(blob, fileNameFor(event, 'Submissions', 'geojson'));
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Exports"
        description="HUD PIT submission Excel, Executive Report PDF, and raw GeoJSON."
        actions={
          events.length > 1 && (
            <select
              value={event.id}
              onChange={(e) => navigate(`/export/${e.target.value}`)}
              className="h-10 rounded-lg border border-wp-border bg-white px-3 text-sm"
              aria-label="Select event"
            >
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          )
        }
      />

      <Card className="px-4 py-4">
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-primary-light text-primary p-2"><MapIcon size={18} /></div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Active export
            </p>
            <h2 className="text-base font-semibold text-text-primary">{event.name}</h2>
            <p className="text-xs text-text-muted">
              Count date {event.count_date} · {submissions.length} submission
              {submissions.length === 1 ? '' : 's'} · {totalPersons} person
              {totalPersons === 1 ? '' : 's'}
            </p>
          </div>
        </div>
      </Card>

      {/* APR upload */}
      <Card className="p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">
          Street Outreach APR (for demographic extrapolation)
        </p>

        {apr ? (
          <AprSummary apr={apr} onClear={handleClearApr} />
        ) : (
          <DropZone
            onSelect={(files) => handleFiles(files)}
            parsing={parsing}
            onClickInput={() => fileInputRef.current?.click()}
          />
        )}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".zip,.xlsx,.xls,.csv"
          onChange={(e) => handleFiles(e.target.files)}
        />
        {aprError && (
          <div className="mt-3 flex items-start gap-2 text-xs text-status-alert">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>{aprError}</span>
          </div>
        )}
      </Card>

      {/* Extrapolation preview */}
      {extrapolation && (
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">
            Extrapolation preview
          </p>
          <PreviewTable extrapolation={extrapolation} />
        </Card>
      )}

      {/* HUD Excel */}
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-emerald-100 text-emerald-700 p-2">
            <FileSpreadsheet size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-text-primary">HUD PIT Summary Report (Excel)</p>
            <p className="text-xs text-text-muted mb-3">
              Fills the official HUD template's Unsheltered columns. Sheltered cells are
              left blank since Waypoint only counts unsheltered persons.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs text-text-muted">HUD Num (optional):</label>
              <input
                type="text"
                value={hudNum}
                onChange={(e) => setHudNum(e.target.value)}
                placeholder="e.g. FL-600-2027"
                className="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs"
              />
              <Button
                onClick={handleDownloadExcel}
                disabled={!extrapolation || excelBuilding}
                size="sm"
              >
                {excelBuilding ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                {excelBuilding ? 'Building…' : 'Download Excel'}
              </Button>
            </div>
            {!extrapolation && (
              <p className="text-[11px] text-text-muted mt-2">
                Upload an APR above first — demographic cells need the proportions.
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* Executive Report */}
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-blue-100 text-blue-700 p-2">
            <FileText size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-text-primary">Executive Report (PDF)</p>
            <p className="text-xs text-text-muted mb-3">
              Cover, headline stats, methodology note, per-zone coverage, demographic
              tables, household composition, and subpopulation estimates. Print-to-PDF.
            </p>
            <Button onClick={handleOpenPdf} disabled={!extrapolation} size="sm" variant="secondary">
              <Download size={14} />
              Open report
            </Button>
          </div>
        </div>
      </Card>

      {/* GeoJSON */}
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-amber-100 text-amber-700 p-2">
            <MapIcon size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-text-primary">Submissions GeoJSON</p>
            <p className="text-xs text-text-muted mb-3">
              All submission points for this event as a GeoJSON FeatureCollection — useful for
              external GIS analysis.
            </p>
            <Button onClick={handleGeoJson} size="sm" variant="secondary">
              <Download size={14} />
              Download GeoJSON
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Bits
// -----------------------------------------------------------------------------

function DropZone({
  onSelect,
  parsing,
  onClickInput,
}: {
  onSelect: (files: FileList | null) => void;
  parsing: boolean;
  onClickInput: () => void;
}) {
  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        onSelect(e.dataTransfer.files);
      }}
      className="border-2 border-dashed border-gray-300 rounded-lg px-6 py-8 text-center hover:border-primary hover:bg-primary-light/40 transition-colors cursor-pointer"
      onClick={onClickInput}
      role="button"
      tabIndex={0}
    >
      {parsing ? (
        <div className="flex items-center justify-center gap-2 text-sm text-text-muted">
          <Loader2 size={14} className="animate-spin" /> Parsing APR…
        </div>
      ) : (
        <>
          <Upload className="mx-auto mb-2 text-text-muted" size={20} />
          <p className="text-sm font-medium text-text-primary">
            Drop the Sage APR bundle (.zip) here
          </p>
          <p className="text-xs text-text-muted mt-1">
            or click to browse — .zip, .xlsx, .csv accepted. <strong>Not retained.</strong>
          </p>
        </>
      )}
    </div>
  );
}

function AprSummary({ apr, onClear }: { apr: AprProportions; onClear: () => void }) {
  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
          APR loaded
        </p>
        <p className="text-sm font-medium text-text-primary mt-0.5 break-all">
          {apr.sourceFileName}
        </p>
        <p className="text-[11px] text-text-muted mt-1">
          {apr.sectionsFound.length} section
          {apr.sectionsFound.length === 1 ? '' : 's'} found
          {apr.totalPersons != null && ` · ${apr.totalPersons} persons in APR`}
        </p>
        <p className="text-[11px] text-text-muted mt-0.5">
          Proportions held in memory only — file content is not saved.
        </p>
      </div>
      <button
        type="button"
        onClick={onClear}
        className="shrink-0 p-1.5 rounded-md text-text-muted hover:bg-white"
        aria-label="Clear APR"
        title="Remove this APR"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

function PreviewTable({ extrapolation }: { extrapolation: ExtrapolationResult }) {
  const { diagnostics, aggregates } = extrapolation;
  const total = diagnostics.totalPersons;
  const rows: Array<{ section: string; rows: Array<[string, number]> }> = [
    {
      section: 'Age',
      rows: [
        ['Under 18', aggregates.age.under_18],
        ['18–24', aggregates.age['18_24']],
        ['25–34', aggregates.age['25_34']],
        ['35–44', aggregates.age['35_44']],
        ['45–54', aggregates.age['45_54']],
        ['55–64', aggregates.age['55_64']],
        ['65+', aggregates.age['65_plus']],
      ],
    },
    {
      section: 'Race & Ethnicity',
      rows: [
        ['American Indian / Indigenous (only)', aggregates.raceEthnicity.american_indian_nh],
        ['American Indian / Indigenous & Hispanic', aggregates.raceEthnicity.american_indian_h],
        ['Asian (only)', aggregates.raceEthnicity.asian_nh],
        ['Asian & Hispanic', aggregates.raceEthnicity.asian_h],
        ['Black (only)', aggregates.raceEthnicity.black_nh],
        ['Black & Hispanic', aggregates.raceEthnicity.black_h],
        ['Hispanic / Latino (only)', aggregates.raceEthnicity.hispanic_only],
        ['MENA (only)', aggregates.raceEthnicity.mena_nh],
        ['MENA & Hispanic', aggregates.raceEthnicity.mena_h],
        ['NHPI (only)', aggregates.raceEthnicity.nhpi_nh],
        ['NHPI & Hispanic', aggregates.raceEthnicity.nhpi_h],
        ['White (only)', aggregates.raceEthnicity.white_nh],
        ['White & Hispanic', aggregates.raceEthnicity.white_h],
        ['Multi-Racial & Hispanic', aggregates.raceEthnicity.multi_h],
        ['Multi-Racial (all other)', aggregates.raceEthnicity.multi_nh],
      ],
    },
    {
      section: 'Youth Subpopulations',
      rows: [
        ['Unaccompanied Youth (UY)', aggregates.youth.unaccompaniedYouth],
        ['  · Children (<18)', aggregates.youth.unaccompaniedYouth * 0.15],
        ['  · Youth (18–24)', aggregates.youth.unaccompaniedYouth * 0.85],
        ['Parenting Youth (PY)', aggregates.youth.parentingYouth],
        ['  · Parents (<18 + 18–24)', aggregates.youth.parentingYouth * 0.8],
        ['  · Their Children', aggregates.youth.parentingYouth * 0.2],
      ],
    },
    {
      section: 'Subpopulations',
      rows: [
        ['Veterans', total * aggregates.subpops.veteran],
        ['Chronically Homeless', total * aggregates.subpops.chronicallyHomeless],
        ['Severely Mentally Ill', total * aggregates.subpops.severelyMentallyIll],
        ['Substance Use Disorder', total * aggregates.subpops.substanceUseDisorder],
        ['HIV / AIDS', total * aggregates.subpops.hivAids],
        ['Domestic Violence Survivors', total * aggregates.subpops.domesticViolence],
      ],
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
      {rows.map((sec) => (
        <div key={sec.section}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1">
            {sec.section}
          </p>
          <table className="w-full">
            <tbody>
              {sec.rows.map(([label, value]) => (
                <tr key={label} className="border-b border-gray-100">
                  <td className="py-1 pr-2">{label}</td>
                  <td className="py-1 text-right text-text-primary font-medium tabular-nums">
                    {Math.round(value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      <div className="md:col-span-2 lg:col-span-4 mt-1 text-[11px] text-text-muted border-t border-gray-100 pt-2">
        Total persons: <strong className="text-text-primary">{total}</strong> ·{' '}
        Surveyed: {diagnostics.surveyedPersons} ({((diagnostics.observedDemographicShare) * 100).toFixed(0)}% directly observed) ·{' '}
        Source: <code className="font-mono">{diagnostics.source}</code>
      </div>
    </div>
  );
}

function fileNameFor(event: Tables<'count_events'>, suffix: string, ext: string): string {
  const safe = event.name.replace(/[^a-z0-9]+/gi, '_');
  return `${safe}_${suffix}.${ext}`;
}

export default ExportHubPage;
