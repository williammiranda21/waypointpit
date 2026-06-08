// Shared fetchers that turn real GeoJSON sources into BoundaryFeature[].
//
// Two source shapes are supported:
//   - ArcGIS Hub "download" API (Miami-Dade / City of Miami Open Data Portal)
//   - A raw ArcGIS REST FeatureServer/MapServer query that returns GeoJSON
//     (used for the US Census TIGERweb tract service)
//
// Each layer's load() wraps its fetcher in `cachedLayer()`, which memoizes the
// result for the session and falls back to bundled synthetic polygons if the
// live fetch fails (offline, CORS, service outage) so the choropleth still works.
import type { GeoJSONAreaGeometry } from '@/lib/database.types';
import type { BoundaryFeature } from './types';

const HUB_BASE = 'https://opendata.arcgis.com/api/v3/datasets';

/** Arbitrary ArcGIS attribute bag. */
type Props = Record<string, unknown>;

interface NormalizeOpts {
  /** Property used as the feature's stable id; falls back to feature.id / index. */
  idField?: string;
  /** Build the human-readable label from the feature's properties. */
  name: (props: Props, index: number) => string;
  /** Optional metadata extractor (district #, GEOID, etc.). */
  meta?: (props: Props) => Record<string, string | number>;
}

interface RawFeature {
  id?: string | number;
  geometry?: { type?: string } | null;
  properties?: Props | null;
}

function featuresFromCollection(
  fc: { features?: RawFeature[] },
  opts: NormalizeOpts,
): BoundaryFeature[] {
  const out: BoundaryFeature[] = [];
  (fc.features ?? []).forEach((f, index) => {
    const g = f.geometry;
    if (!g || (g.type !== 'Polygon' && g.type !== 'MultiPolygon')) return;
    const props = (f.properties ?? {}) as Props;
    const rawId = opts.idField ? props[opts.idField] : undefined;
    out.push({
      id: String(rawId ?? f.id ?? index),
      name: opts.name(props, index),
      geometry: g as unknown as GeoJSONAreaGeometry,
      meta: opts.meta?.(props),
    });
  });
  if (out.length === 0) throw new Error('source returned no polygon features');
  return out;
}

/** Fetch + normalize an ArcGIS Hub dataset by its item id (WGS84 GeoJSON). */
export async function fetchHubLayer(
  itemId: string,
  opts: NormalizeOpts,
): Promise<BoundaryFeature[]> {
  const url = `${HUB_BASE}/${itemId}/downloads/data?format=geojson&spatialRefId=4326`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ArcGIS Hub ${itemId} HTTP ${res.status}`);
  return featuresFromCollection(await res.json(), opts);
}

/** Fetch + normalize a raw ArcGIS REST query URL that returns GeoJSON. */
export async function fetchArcgisQuery(
  url: string,
  opts: NormalizeOpts,
): Promise<BoundaryFeature[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ArcGIS query HTTP ${res.status}`);
  return featuresFromCollection(await res.json(), opts);
}

const cache = new Map<string, Promise<BoundaryFeature[]>>();

/**
 * Memoize a layer's features for the session. On fetch failure, logs a warning
 * and resolves with the synthetic fallback so the UI degrades gracefully.
 */
export function cachedLayer(
  key: string,
  fetcher: () => Promise<BoundaryFeature[]>,
  fallback: BoundaryFeature[],
): Promise<BoundaryFeature[]> {
  let entry = cache.get(key);
  if (!entry) {
    entry = fetcher().catch((err) => {
      console.warn(`[boundaries] "${key}" live fetch failed — using synthetic fallback:`, err);
      return fallback;
    });
    cache.set(key, entry);
  }
  return entry;
}

/** Title-case an ALL-CAPS source name (e.g. "KEY BISCAYNE" → "Key Biscayne"). */
export function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\b(Of|And|The)\b/g, (w) => w.toLowerCase());
}
