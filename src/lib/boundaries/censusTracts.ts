import { cachedLayer, fetchArcgisQuery } from './fetchSource';
import { rect, type BoundaryFeature } from './types';

// US Census TIGERweb — current census tracts for Miami-Dade (STATE 12, COUNTY 086).
// Authoritative geography for HUD / HMIS reporting (~707 tracts).
const TIGERWEB_URL =
  "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Tracts_Blocks/MapServer/0/query" +
  "?where=STATE%3D%2712%27+AND+COUNTY%3D%27086%27&outFields=GEOID,NAME,TRACT&outSR=4326&f=geojson";

/**
 * Synthetic fallback tracts — small grid covering the core Miami urban area,
 * used only if the live TIGERweb fetch fails.
 *
 * Tract IDs follow the FIPS pattern 12086-NNNNNN (Florida = 12, Miami-Dade = 086).
 */
const TRACTS: BoundaryFeature[] = (() => {
  const out: BoundaryFeature[] = [];
  // 6 cols × 5 rows of small tracts inside the urban core bbox.
  const w0 = -80.28;
  const e0 = -80.13;
  const s0 = 25.72;
  const n0 = 25.87;
  const cols = 6;
  const rows = 5;
  const dx = (e0 - w0) / cols;
  const dy = (n0 - s0) / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const w = w0 + c * dx;
      const s = s0 + r * dy;
      // Fake tract number for display. Real tracts use full 6-digit codes.
      const code = 1000 + r * 100 + c * 10;
      out.push({
        id: `tract-${code}`,
        name: `Tract ${code.toFixed(2)}`,
        geometry: rect(w, s, w + dx, s + dy),
        meta: { tract: code, fips: `12086${String(code).padStart(6, '0')}` },
      });
    }
  }
  return out;
})();

export async function loadCensusTracts(): Promise<BoundaryFeature[]> {
  return cachedLayer(
    'census_tract',
    () =>
      fetchArcgisQuery(TIGERWEB_URL, {
        idField: 'GEOID',
        name: (p) => String(p.NAME ?? `Tract ${p.TRACT ?? '?'}`),
        meta: (p) => ({ geoid: String(p.GEOID ?? ''), tract: String(p.TRACT ?? '') }),
      }),
    TRACTS,
  );
}
