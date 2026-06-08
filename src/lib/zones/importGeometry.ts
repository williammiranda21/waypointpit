// Parse an uploaded GeoJSON file or zipped shapefile into zone candidates.
//
// Shapefiles are parsed with shpjs (lazy-imported so its ~200 KB only loads when
// someone actually imports one). shpjs reprojects to WGS84 when a .prj is present.
// Each Polygon feature becomes one zone; MultiPolygons are split into one zone
// per part (suffixed) because the zones table column is geometry(Polygon, 4326).
import type { GeoJSONPolygon } from '@/lib/database.types';

export interface ImportedZone {
  name: string;
  geometry: GeoJSONPolygon;
}

/** Property keys, in priority order, that commonly hold a zone/area name. */
const NAME_KEYS = [
  'name', 'zone', 'zone_name', 'zonename', 'label', 'area', 'area_name',
  'district', 'neighborhood', 'nbhd', 'region', 'title', 'id',
];

interface GeoFeature {
  type: 'Feature';
  geometry: { type: string; coordinates: unknown } | null;
  properties: Record<string, unknown> | null;
}
interface GeoFeatureCollection {
  type: 'FeatureCollection';
  features: GeoFeature[];
}

function pickName(props: Record<string, unknown> | null, fallback: string): string {
  if (props) {
    const lowerKeys = new Map(Object.keys(props).map((k) => [k.toLowerCase(), k]));
    for (const want of NAME_KEYS) {
      const actual = lowerKeys.get(want);
      if (actual != null) {
        const v = props[actual];
        if (v != null && String(v).trim()) return String(v).trim();
      }
    }
  }
  return fallback;
}

/** Flatten a Feature into one or more single-Polygon zone candidates. */
function featureToZones(feature: GeoFeature, index: number): ImportedZone[] {
  const g = feature.geometry;
  if (!g) return [];
  const baseName = pickName(feature.properties, `Imported zone ${index + 1}`);

  if (g.type === 'Polygon') {
    return [{ name: baseName, geometry: { type: 'Polygon', coordinates: g.coordinates as number[][][] } }];
  }
  if (g.type === 'MultiPolygon') {
    const parts = g.coordinates as number[][][][];
    return parts.map((coords, i) => ({
      name: parts.length > 1 ? `${baseName} (${i + 1})` : baseName,
      geometry: { type: 'Polygon', coordinates: coords },
    }));
  }
  return []; // points, lines, etc. are not zones
}

function collectionToZones(fc: GeoFeatureCollection): ImportedZone[] {
  return fc.features.flatMap((f, i) => featureToZones(f, i));
}

/** Normalize anything shpjs / a .geojson file can yield into a flat zone list. */
function normalize(parsed: unknown): ImportedZone[] {
  if (Array.isArray(parsed)) {
    // shpjs returns an array when a .zip holds multiple layers.
    return (parsed as GeoFeatureCollection[]).flatMap(collectionToZones);
  }
  const obj = parsed as { type?: string };
  if (obj?.type === 'FeatureCollection') return collectionToZones(parsed as GeoFeatureCollection);
  if (obj?.type === 'Feature') return featureToZones(parsed as GeoFeature, 0);
  if (obj?.type === 'Polygon' || obj?.type === 'MultiPolygon') {
    return featureToZones({ type: 'Feature', geometry: parsed as GeoFeature['geometry'], properties: null }, 0);
  }
  return [];
}

/** Basic sanity check that coordinates look like lng/lat degrees. */
function looksLikeWgs84(zones: ImportedZone[]): boolean {
  const first = zones[0]?.geometry.coordinates?.[0]?.[0];
  if (!first) return true;
  const [lng, lat] = first;
  return Math.abs(lng) <= 180 && Math.abs(lat) <= 90;
}

export async function parseZoneFile(file: File): Promise<ImportedZone[]> {
  const lower = file.name.toLowerCase();
  let zones: ImportedZone[];

  if (lower.endsWith('.zip')) {
    const buf = await file.arrayBuffer();
    const shp = (await import('shpjs')).default;
    zones = normalize(await shp(buf));
  } else if (lower.endsWith('.geojson') || lower.endsWith('.json')) {
    zones = normalize(JSON.parse(await file.text()));
  } else {
    throw new Error('Unsupported file. Upload a .geojson, .json, or zipped shapefile (.zip).');
  }

  if (zones.length === 0) {
    throw new Error('No polygon features found in that file.');
  }
  if (!looksLikeWgs84(zones)) {
    throw new Error(
      'Coordinates are not in latitude/longitude. Re-export the shapefile in WGS84 (EPSG:4326), ' +
        'or include a .prj file in the .zip so it can be reprojected.',
    );
  }
  return zones;
}
