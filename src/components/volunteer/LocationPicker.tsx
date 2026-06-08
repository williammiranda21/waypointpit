import { useMemo } from 'react';
import { MapPin } from 'lucide-react';
import { MapView, type MapPolygon } from '@/components/map/MapView';
import type { MapMarker } from '@/components/map/markers';
import type { Tables } from '@/lib/database.types';

interface LocationPickerProps {
  zone: Pick<Tables<'zones'>, 'id' | 'name' | 'geometry' | 'color'>;
  /** Currently picked lng/lat, if any. */
  value: { lat: number; lng: number } | null;
  onChange: (lat: number, lng: number) => void;
  /** Height in px. Defaults to 280. */
  heightPx?: number;
}

/**
 * Tap-to-drop-pin map for the volunteer submission form. Centered on the
 * assigned zone polygon. Each tap moves the pin; the picked coords are
 * surfaced beneath the map so the volunteer can sanity-check before submitting.
 */
export function LocationPicker({ zone, value, onChange, heightPx = 280 }: LocationPickerProps) {
  const polygons: MapPolygon[] = useMemo(
    () => [{ id: zone.id, name: zone.name, geometry: zone.geometry, color: zone.color }],
    [zone],
  );
  const markers: MapMarker[] = useMemo(
    () =>
      value
        ? [
            {
              id: 'picked',
              lng: value.lng,
              lat: value.lat,
              hotspot_type: 'resource',
              severity: 'high',
              expected_count: 10,
              resolved: false,
              label: 'Picked location',
            },
          ]
        : [],
    [value],
  );

  return (
    <div>
      <div
        className="relative w-full overflow-hidden rounded-xl border border-wp-border"
        style={{ height: heightPx }}
      >
        <MapView
          polygons={polygons}
          markers={markers}
          onMapClick={(lng, lat) => onChange(lat, lng)}
          className="absolute inset-0"
        />
        {!value && (
          <div className="pointer-events-none absolute inset-x-0 top-2 flex justify-center">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/95 border border-wp-border px-3 py-1 text-[11px] font-medium text-text-body shadow-sm">
              <MapPin size={12} className="text-primary" />
              Tap the map to drop a pin
            </div>
          </div>
        )}
      </div>
      {value && (
        <p className="mt-2 text-xs text-text-muted">
          <span className="font-medium text-text-primary">Pinned:</span>{' '}
          <span className="font-mono">
            {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
          </span>{' '}
          · accuracy: manual
        </p>
      )}
    </div>
  );
}
