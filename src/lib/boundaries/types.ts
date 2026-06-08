import type { GeoJSONAreaGeometry, GeoJSONPolygon } from '@/lib/database.types';

export type BoundaryLayerId =
  | 'mdc_commission'
  | 'com_commission'
  | 'municipalities'
  | 'zip'
  | 'census_tract'
  | 'com_police';

export interface BoundaryFeature {
  /** Stable id within a layer (used for selection + aggregation). */
  id: string;
  /** Human-readable label shown on the map + tooltip. */
  name: string;
  /** Polygon or MultiPolygon — real boundaries include islands. */
  geometry: GeoJSONAreaGeometry;
  /** Layer-specific metadata (district #, ZIP, etc.). */
  meta?: Record<string, string | number>;
}

export interface BoundaryLayer {
  id: BoundaryLayerId;
  /** Short name shown in the layer picker. */
  label: string;
  /** Sentence describing the layer + its insight value. */
  description: string;
  /**
   * Lazy loader. Demo mode returns bundled synthetic polygons; in production we
   * swap this to fetch real GeoJSON from the Miami-Dade Open Data Portal (or a
   * static asset). Same signature either way.
   */
  load: () => Promise<BoundaryFeature[]>;
}

/**
 * Helper: axis-aligned rectangle as a closed GeoJSON polygon ring.
 * (west, south, east, north) — matches the rest of the codebase's bbox convention.
 */
export function rect(w: number, s: number, e: number, n: number): GeoJSONPolygon {
  return {
    type: 'Polygon',
    coordinates: [
      [
        [w, s],
        [e, s],
        [e, n],
        [w, n],
        [w, s],
      ],
    ],
  };
}
