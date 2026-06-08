import type { HotspotType, Severity } from '@/lib/database.types';

export interface MapMarker {
  id: string;
  lng: number;
  lat: number;
  hotspot_type: HotspotType;
  severity: Severity;
  /** "# of persons observed" — bumps the marker size a touch when high. */
  expected_count?: number | null;
  resolved?: boolean;
  label?: string;
}

export const HOTSPOT_COLORS: Record<HotspotType, string> = {
  sighting: '#3B82F6', // blue
  encampment: '#F59E0B', // amber/orange
  hazard: '#EF4444', // red
  resource: '#22C55E', // green
};

export const HOTSPOT_LABELS: Record<HotspotType, string> = {
  sighting: 'Sighting',
  encampment: 'Encampment',
  hazard: 'Hazard',
  resource: 'Resource',
};

/** Pixel radius for the SVG / Mapbox circle, by severity. */
export const SEVERITY_RADIUS: Record<Severity, number> = {
  low: 5,
  medium: 7,
  high: 9.5,
};

/** Severity radius + a count bump capped at +4px (kicks in around 10+ expected). */
export function markerRadius(severity: Severity, expectedCount?: number | null): number {
  const base = SEVERITY_RADIUS[severity];
  if (!expectedCount || expectedCount < 3) return base;
  const bump = Math.min(4, Math.floor(expectedCount / 5));
  return base + bump;
}
