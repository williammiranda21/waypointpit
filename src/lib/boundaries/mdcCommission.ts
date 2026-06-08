import { rect, type BoundaryFeature } from './types';

/**
 * Miami-Dade County Commission Districts — 13 districts.
 * Demo geometries: rough rectangular slices over the county bbox so the
 * choropleth has something to color in. Replace with real GeoJSON from the
 * Miami-Dade Open Data Portal when wiring production.
 *
 * District names follow the current county roster (commissioner names omitted
 * because they change — these are just placeholders).
 */
const DISTRICTS: Array<{ num: number; name: string; w: number; s: number; e: number; n: number }> = [
  { num: 1, name: 'District 1 — NW Miami-Dade', w: -80.46, s: 25.85, e: -80.30, n: 26.00 },
  { num: 2, name: 'District 2 — North Bay', w: -80.30, s: 25.83, e: -80.13, n: 26.00 },
  { num: 3, name: 'District 3 — Liberty City', w: -80.30, s: 25.78, e: -80.20, n: 25.83 },
  { num: 4, name: 'District 4 — Mid-Beach', w: -80.16, s: 25.78, e: -80.05, n: 25.92 },
  { num: 5, name: 'District 5 — Downtown / Beach', w: -80.20, s: 25.74, e: -80.13, n: 25.82 },
  { num: 6, name: 'District 6 — Little Havana / Flagami', w: -80.30, s: 25.74, e: -80.20, n: 25.78 },
  { num: 7, name: 'District 7 — Coral Gables / Pinecrest', w: -80.30, s: 25.66, e: -80.20, n: 25.74 },
  { num: 8, name: 'District 8 — South Dade', w: -80.45, s: 25.45, e: -80.20, n: 25.66 },
  { num: 9, name: 'District 9 — Princeton / Goulds', w: -80.55, s: 25.45, e: -80.45, n: 25.66 },
  { num: 10, name: 'District 10 — Westchester', w: -80.40, s: 25.71, e: -80.30, n: 25.78 },
  { num: 11, name: 'District 11 — Sweetwater / FIU', w: -80.50, s: 25.71, e: -80.40, n: 25.83 },
  { num: 12, name: 'District 12 — Doral / Medley', w: -80.50, s: 25.83, e: -80.46, n: 26.00 },
  { num: 13, name: 'District 13 — Hialeah / Miami Lakes', w: -80.55, s: 25.83, e: -80.50, n: 26.00 },
];

const FEATURES: BoundaryFeature[] = DISTRICTS.map((d) => ({
  id: `mdc-d${d.num}`,
  name: d.name,
  geometry: rect(d.w, d.s, d.e, d.n),
  meta: { district: d.num },
}));

export async function loadMdcCommission(): Promise<BoundaryFeature[]> {
  return FEATURES;
}
