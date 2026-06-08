import { cachedLayer, fetchHubLayer } from './fetchSource';
import { rect, type BoundaryFeature } from './types';

// City of Miami Open Data Portal — "Commission Districts" (5 districts).
const HUB_ITEM_ID = '1ff4f95b49e142ee8d4e93bb33a9f42d';

/**
 * City of Miami Commission Districts — 5 districts.
 * Synthetic fallback geometries inside the City of Miami bbox.
 */
const DISTRICTS: Array<{ num: number; name: string; w: number; s: number; e: number; n: number }> = [
  { num: 1, name: 'District 1 — Allapattah / Flagami', w: -80.30, s: 25.76, e: -80.22, n: 25.83 },
  { num: 2, name: 'District 2 — Downtown / Coconut Grove', w: -80.22, s: 25.71, e: -80.16, n: 25.80 },
  { num: 3, name: 'District 3 — Little Havana', w: -80.26, s: 25.74, e: -80.22, n: 25.78 },
  { num: 4, name: 'District 4 — Flagami / Coral Way', w: -80.30, s: 25.73, e: -80.26, n: 25.76 },
  { num: 5, name: 'District 5 — Overtown / Little Haiti', w: -80.22, s: 25.80, e: -80.16, n: 25.86 },
];

const FALLBACK: BoundaryFeature[] = DISTRICTS.map((d) => ({
  id: `com-d${d.num}`,
  name: d.name,
  geometry: rect(d.w, d.s, d.e, d.n),
  meta: { district: d.num },
}));

export async function loadComCommission(): Promise<BoundaryFeature[]> {
  return cachedLayer(
    'com_commission',
    () =>
      fetchHubLayer(HUB_ITEM_ID, {
        idField: 'COMDISTID',
        name: (p) => `District ${p.COMDISTID ?? '?'}${p.COMNAME ? ` — ${p.COMNAME}` : ''}`,
        meta: (p) => ({ district: Number(p.COMDISTID) || 0 }),
      }),
    FALLBACK,
  );
}
