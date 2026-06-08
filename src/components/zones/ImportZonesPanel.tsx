import { useRef, useState } from 'react';
import { Upload, FileUp, Loader2, CheckCircle2 } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { MapView } from '@/components/map/MapView';
import { parseZoneFile, type ImportedZone } from '@/lib/zones/importGeometry';

interface Candidate extends ImportedZone {
  include: boolean;
  color: string;
}

export type ImportedItem = ImportedZone & { color: string };

interface ImportZonesPanelProps {
  colors: string[];
  /** Persist the selected zones (as event zones, templates, etc.). */
  onImport: (items: ImportedItem[]) => Promise<void>;
  /** Called after a successful import (e.g. navigate or refresh). */
  onImported: () => void;
  /** Custom call-to-action label, e.g. "Add 3 templates". */
  ctaLabel?: (count: number) => string;
}

export function ImportZonesPanel({ colors, onImport, onImported, ctaLabel }: ImportZonesPanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const handleFile = async (file: File) => {
    setError(null);
    setCandidates([]);
    setFileName(file.name);
    setParsing(true);
    try {
      const zones = await parseZoneFile(file);
      setCandidates(
        zones.map((z, i) => ({ ...z, include: true, color: colors[i % colors.length] })),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that file.');
      setFileName(null);
    } finally {
      setParsing(false);
    }
  };

  const selected = candidates.filter((c) => c.include);

  const handleImport = async () => {
    setError(null);
    setImporting(true);
    try {
      await onImport(
        selected.map((c) => ({
          name: c.name.trim() || 'Imported zone',
          geometry: c.geometry,
          color: c.color,
        })),
      );
      onImported();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Card>
      <CardBody className="space-y-4">
        <input
          ref={fileInputRef}
          type="file"
          accept=".geojson,.json,.zip"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
          }}
        />

        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) void handleFile(f);
          }}
          className="rounded-xl border-2 border-dashed border-wp-border bg-gray-50 px-4 py-8 text-center"
        >
          <Upload className="mx-auto mb-2 text-text-muted" size={24} />
          <p className="text-sm text-text-body">
            Drop a <span className="font-medium">GeoJSON</span> or zipped{' '}
            <span className="font-medium">shapefile</span> here
          </p>
          <p className="mt-0.5 text-xs text-text-muted">
            .geojson · .json · .zip (must contain .shp + .dbf, ideally a .prj)
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={() => fileInputRef.current?.click()}
          >
            <FileUp size={14} />
            Choose file
          </Button>
          {fileName && (
            <p className="mt-2 text-xs text-text-muted">
              {parsing ? 'Reading ' : 'Loaded '}
              <span className="font-medium text-text-primary">{fileName}</span>
              {parsing && <Loader2 size={12} className="ml-1 inline animate-spin" />}
            </p>
          )}
        </div>

        {error && (
          <div
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-status-alert"
            role="alert"
          >
            {error}
          </div>
        )}

        {candidates.length > 0 && (
          <>
            <div className="relative h-[360px] overflow-hidden rounded-xl border border-wp-border">
              <MapView
                polygons={candidates
                  .filter((c) => c.include)
                  .map((c, i) => ({ id: String(i), name: c.name, geometry: c.geometry, color: c.color }))}
                className="absolute inset-0"
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium text-text-primary">
                  {selected.length} of {candidates.length} zone{candidates.length === 1 ? '' : 's'} selected
                </p>
                <div className="flex gap-3 text-xs">
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={() => setCandidates((cs) => cs.map((c) => ({ ...c, include: true })))}
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    className="text-text-muted hover:underline"
                    onClick={() => setCandidates((cs) => cs.map((c) => ({ ...c, include: false })))}
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
                {candidates.map((c, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded-lg border border-wp-border bg-white px-2 py-1.5"
                  >
                    <input
                      type="checkbox"
                      checked={c.include}
                      onChange={(e) =>
                        setCandidates((cs) =>
                          cs.map((x, j) => (j === i ? { ...x, include: e.target.checked } : x)),
                        )
                      }
                      className="h-4 w-4 shrink-0 accent-primary"
                      aria-label={`Include ${c.name}`}
                    />
                    <span
                      className="h-4 w-4 shrink-0 rounded"
                      style={{ backgroundColor: c.color }}
                      aria-hidden
                    />
                    <Input
                      value={c.name}
                      onChange={(e) =>
                        setCandidates((cs) =>
                          cs.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)),
                        )
                      }
                      className="h-8 text-sm"
                      aria-label={`Name for zone ${i + 1}`}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <Button type="button" onClick={handleImport} disabled={importing || selected.length === 0}>
                {importing ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={14} />
                )}
                {importing
                  ? 'Importing…'
                  : ctaLabel
                    ? ctaLabel(selected.length)
                    : `Import ${selected.length} zone${selected.length === 1 ? '' : 's'}`}
              </Button>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}
