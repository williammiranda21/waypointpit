import { cachedLayer, fetchHubLayer } from './fetchSource';
import { rect, type BoundaryFeature } from './types';

// Miami-Dade County Open Data Portal — "Zip Code" (102 features).
const HUB_ITEM_ID = 'fee863cb3da0417fa8b5aaf6b671f8a7';

/**
 * Representative subset of Miami-area ZIP codes.
 * Synthetic rectangles approximating the general area each ZIP covers.
 */
const ZIPS: Array<{ zip: string; name: string; w: number; s: number; e: number; n: number }> = [
  { zip: '33101', name: 'Downtown Miami',         w: -80.20, s: 25.75, e: -80.17, n: 25.79 },
  { zip: '33125', name: 'Little Havana',          w: -80.25, s: 25.76, e: -80.21, n: 25.79 },
  { zip: '33127', name: 'Wynwood / Buena Vista',  w: -80.21, s: 25.79, e: -80.17, n: 25.82 },
  { zip: '33128', name: 'Civic Center',           w: -80.22, s: 25.78, e: -80.20, n: 25.80 },
  { zip: '33130', name: 'East Little Havana',     w: -80.22, s: 25.76, e: -80.20, n: 25.78 },
  { zip: '33131', name: 'Brickell',               w: -80.20, s: 25.74, e: -80.18, n: 25.77 },
  { zip: '33132', name: 'Park West / Edgewater',  w: -80.19, s: 25.78, e: -80.17, n: 25.81 },
  { zip: '33133', name: 'Coconut Grove',          w: -80.25, s: 25.71, e: -80.22, n: 25.74 },
  { zip: '33134', name: 'Coral Gables',           w: -80.28, s: 25.72, e: -80.24, n: 25.76 },
  { zip: '33135', name: 'East Little Havana',     w: -80.23, s: 25.76, e: -80.21, n: 25.78 },
  { zip: '33136', name: 'Overtown',               w: -80.21, s: 25.78, e: -80.19, n: 25.80 },
  { zip: '33137', name: 'Upper Eastside',         w: -80.20, s: 25.82, e: -80.17, n: 25.85 },
  { zip: '33138', name: 'Miami Shores',           w: -80.20, s: 25.85, e: -80.16, n: 25.88 },
  { zip: '33139', name: 'South Beach',            w: -80.15, s: 25.76, e: -80.13, n: 25.80 },
  { zip: '33142', name: 'Allapattah',             w: -80.25, s: 25.79, e: -80.21, n: 25.82 },
  { zip: '33150', name: 'Liberty City',           w: -80.24, s: 25.83, e: -80.20, n: 25.85 },
];

const FALLBACK: BoundaryFeature[] = ZIPS.map((z) => ({
  id: `zip-${z.zip}`,
  name: `${z.zip} · ${z.name}`,
  geometry: rect(z.w, z.s, z.e, z.n),
  meta: { zip: z.zip },
}));

export async function loadZipCodes(): Promise<BoundaryFeature[]> {
  return cachedLayer(
    'zip',
    () =>
      fetchHubLayer(HUB_ITEM_ID, {
        idField: 'ZIPCODE',
        name: (p) => String(p.ZIPCODE ?? p.ZIP ?? '?'),
        meta: (p) => ({ zip: String(p.ZIPCODE ?? p.ZIP ?? '') }),
      }),
    FALLBACK,
  );
}
