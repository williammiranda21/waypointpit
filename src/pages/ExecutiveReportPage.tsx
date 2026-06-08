import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ExecutiveReport } from '@/components/exports/ExecutiveReport';
import { useEventsList } from '@/hooks/useEvents';
import { listSubmissionsForEvent } from '@/lib/db/submissions';
import { listZonesForEvent } from '@/lib/db/zones';
import {
  loadStoredApr,
  parseAprUpload,
  saveStoredApr,
  type AprProportions,
} from '@/lib/exports/aprParser';
import { extrapolate } from '@/lib/exports/extrapolator';
import { useRef } from 'react';

export function ExecutiveReportPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const autoPrint = searchParams.get('print') === '1';

  const { data: events = [] } = useEventsList();
  const event = useMemo(
    () => events.find((e) => e.id === eventId) ?? null,
    [events, eventId],
  );

  const [{ data: submissions = [] }, { data: zones = [] }] = useQueries({
    queries: [
      {
        queryKey: ['submissions', 'event', eventId ?? ''],
        queryFn: () => listSubmissionsForEvent(eventId!),
        enabled: !!eventId,
      },
      {
        queryKey: ['zones', 'event', eventId ?? ''],
        queryFn: () => listZonesForEvent(eventId!),
        enabled: !!eventId,
      },
    ],
  });

  // Try to restore APR from localStorage so opening this page (often in a new
  // tab from "Open Report") picks up the proportions the user already loaded
  // on the Export Hub.
  const [apr, setApr] = useState<AprProportions | null>(() => loadStoredApr());
  const [parsing, setParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Refresh from storage when this tab regains focus, so an upload on the hub
  // shows here without a manual reload.
  useEffect(() => {
    const refresh = () => {
      const stored = loadStoredApr();
      if (stored) setApr(stored);
    };
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setParsing(true);
    try {
      const parsed = await parseAprUpload(files[0]);
      setApr(parsed);
      saveStoredApr(parsed);
    } finally {
      setParsing(false);
    }
  };

  const extrapolation = useMemo(
    () => (apr ? extrapolate({ submissions, apr }) : null),
    [apr, submissions],
  );

  if (!event) {
    return <p className="text-sm text-text-muted">Event not found.</p>;
  }

  return (
    <div className="bg-gray-100 min-h-screen pb-12">
      <style>{REPORT_PAGE_PRINT_CSS}</style>
      <div className="no-print bg-white border-b border-wp-border px-6 py-3 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/export/${event.id}`)}
          >
            <ArrowLeft size={14} />
            Back to exports
          </Button>
          <div className="flex items-center gap-2">
            {apr ? (
              <span className="text-xs text-text-muted truncate max-w-[280px]">
                APR: <strong>{apr.sourceFileName}</strong>
              </span>
            ) : (
              <span className="text-xs text-status-alert">No APR loaded — using defaults</span>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              {parsing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              Upload APR
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".zip,.xlsx,.xls,.csv"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <Button size="sm" onClick={() => window.print()}>
              Print / Save as PDF
            </Button>
          </div>
        </div>
      </div>

      {extrapolation ? (
        <ExecutiveReport
          event={event}
          extrapolation={extrapolation}
          zones={zones}
          submissions={submissions}
          autoPrint={autoPrint}
        />
      ) : (
        <div className="max-w-3xl mx-auto mt-12 px-6">
          <Card className="px-6 py-8 text-center">
            <p className="text-sm text-text-muted">
              Upload an APR (or return to{' '}
              <button
                onClick={() => navigate(`/export/${event.id}`)}
                className="text-primary underline"
              >
                Exports
              </button>
              {' '}and load one) to populate this report with demographic estimates.
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}

/**
 * Hide the app chrome (sidebar + topbar) and let the report span the full page
 * when the user prints. Scoped to a `<style>` that only mounts on this page.
 */
const REPORT_PAGE_PRINT_CSS = `
  @media print {
    /* App chrome — sidebar (<aside>) and topbar (<header> child of .ml-64 wrapper) */
    aside, .ml-64 > header, .no-print { display: none !important; }
    /* Sidebar offset wrapper — un-indent the main content area */
    .ml-64 { margin-left: 0 !important; }
    /* Main wrapper padding */
    main { padding: 0 !important; }
    /* Drop the page background so the printer doesn't waste ink on gray */
    body, html { background: white !important; }
    /* Avoid awkward shadows / borders on print pages */
    .shadow-sm, .shadow-card { box-shadow: none !important; }
  }
`;
