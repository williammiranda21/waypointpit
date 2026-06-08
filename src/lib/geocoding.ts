import { mapboxConfigured, mapboxToken, MIAMI_DADE_CENTER } from '@/components/map/mapToken';

export interface GeocodeResult {
  /** The query that was sent. */
  query: string;
  /** Mapbox's resolved label, e.g. "1234 NW 8th St, Miami, FL 33125, USA". */
  resolvedAddress: string | null;
  lng: number | null;
  lat: number | null;
  /** Empirical 0-1 score from Mapbox. */
  relevance: number;
  ok: boolean;
  error?: string;
}

/**
 * Single-address geocoding. Real mode hits Mapbox; demo mode produces a
 * deterministic synthetic point inside Miami-Dade so the bulk-paste UI is
 * still demonstrable without a real token.
 */
export async function geocodeAddress(query: string): Promise<GeocodeResult> {
  const trimmed = query.trim();
  if (!trimmed) {
    return { query, resolvedAddress: null, lng: null, lat: null, relevance: 0, ok: false, error: 'Empty' };
  }

  if (!mapboxConfigured) {
    return demoGeocode(trimmed);
  }

  // Bias around Miami-Dade and prefer USA addresses.
  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(trimmed)}.json`,
  );
  url.searchParams.set('access_token', mapboxToken);
  url.searchParams.set('country', 'US');
  url.searchParams.set('proximity', `${MIAMI_DADE_CENTER[0]},${MIAMI_DADE_CENTER[1]}`);
  url.searchParams.set('limit', '1');
  url.searchParams.set('autocomplete', 'false');

  try {
    const res = await fetch(url.toString());
    if (!res.ok) {
      return {
        query,
        resolvedAddress: null,
        lng: null,
        lat: null,
        relevance: 0,
        ok: false,
        error: `Mapbox responded ${res.status}`,
      };
    }
    const json = (await res.json()) as MapboxGeocodingResponse;
    const top = json.features?.[0];
    if (!top) {
      return {
        query,
        resolvedAddress: null,
        lng: null,
        lat: null,
        relevance: 0,
        ok: false,
        error: 'No matches',
      };
    }
    const [lng, lat] = top.center;
    return {
      query,
      resolvedAddress: top.place_name,
      lng,
      lat,
      relevance: top.relevance ?? 0,
      ok: true,
    };
  } catch (err) {
    return {
      query,
      resolvedAddress: null,
      lng: null,
      lat: null,
      relevance: 0,
      ok: false,
      error: err instanceof Error ? err.message : 'Network error',
    };
  }
}

/** Geocode many — runs sequentially to stay friendly with the API. */
export async function geocodeBatch(queries: string[]): Promise<GeocodeResult[]> {
  const out: GeocodeResult[] = [];
  for (const q of queries) {
    out.push(await geocodeAddress(q));
  }
  return out;
}

// -----------------------------------------------------------------------------
// Demo mode: scatter results in a deterministic radius around the city center
// -----------------------------------------------------------------------------

function demoGeocode(query: string): GeocodeResult {
  // Hash the query so the same string always lands at the same point.
  let hash = 0;
  for (let i = 0; i < query.length; i++) {
    hash = (hash << 5) - hash + query.charCodeAt(i);
    hash |= 0;
  }
  const seed = Math.abs(hash) % 10_000;
  const dx = ((seed % 100) - 50) / 1000; // ±0.05° lng (~5 km)
  const dy = ((Math.floor(seed / 100) % 100) - 50) / 1000;
  return {
    query,
    resolvedAddress: `${query} (demo)`,
    lng: MIAMI_DADE_CENTER[0] + dx,
    lat: MIAMI_DADE_CENTER[1] + dy,
    relevance: 0.95,
    ok: true,
  };
}

// -----------------------------------------------------------------------------
// Mapbox response types (minimal — only what we use)
// -----------------------------------------------------------------------------

interface MapboxGeocodingResponse {
  features?: Array<{
    place_name: string;
    center: [number, number]; // [lng, lat]
    relevance?: number;
  }>;
}
