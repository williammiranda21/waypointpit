import { cachedLayer, fetchHubLayer, titleCase } from './fetchSource';
import { rect, type BoundaryFeature } from './types';

// City of Miami Open Data Portal — "Police Neighborhoods" (13 NET areas).
const HUB_ITEM_ID = '8ef18f46840e44a2ad330b126a9edfe0';

/**
 * City of Miami Police neighborhoods (NET areas).
 * Synthetic fallback rectangles placed where each neighborhood sits in the
 * City of Miami footprint.
 */
const NEIGHBORHOODS: Array<{ name: string; w: number; s: number; e: number; n: number }> = [
  { name: 'Downtown',          w: -80.20, s: 25.76, e: -80.17, n: 25.79 },
  { name: 'Brickell',          w: -80.20, s: 25.73, e: -80.18, n: 25.76 },
  { name: 'Wynwood',           w: -80.21, s: 25.79, e: -80.18, n: 25.81 },
  { name: 'Edgewater',         w: -80.19, s: 25.79, e: -80.17, n: 25.82 },
  { name: 'Overtown',          w: -80.21, s: 25.78, e: -80.19, n: 25.80 },
  { name: 'Allapattah',        w: -80.24, s: 25.80, e: -80.21, n: 25.83 },
  { name: 'Little Haiti',      w: -80.21, s: 25.82, e: -80.18, n: 25.85 },
  { name: 'Little Havana',     w: -80.24, s: 25.76, e: -80.21, n: 25.78 },
  { name: 'Flagami',           w: -80.30, s: 25.74, e: -80.26, n: 25.77 },
  { name: 'Coral Way',         w: -80.26, s: 25.74, e: -80.22, n: 25.76 },
  { name: 'Coconut Grove',     w: -80.25, s: 25.71, e: -80.22, n: 25.74 },
  { name: 'Liberty City',      w: -80.24, s: 25.83, e: -80.21, n: 25.86 },
  { name: 'Model City',        w: -80.22, s: 25.83, e: -80.20, n: 25.86 },
  { name: 'Upper Eastside',    w: -80.19, s: 25.82, e: -80.17, n: 25.85 },
  { name: 'Grapeland Heights', w: -80.27, s: 25.78, e: -80.24, n: 25.80 },
];

const FALLBACK: BoundaryFeature[] = NEIGHBORHOODS.map((n) => ({
  id: `nro-${n.name.toLowerCase().replace(/\s+/g, '-')}`,
  name: n.name,
  geometry: rect(n.w, n.s, n.e, n.n),
}));

export async function loadComPoliceNeighborhoods(): Promise<BoundaryFeature[]> {
  return cachedLayer(
    'com_police',
    () =>
      fetchHubLayer(HUB_ITEM_ID, {
        idField: 'PDNETID',
        name: (p) => titleCase(String(p.PDNETNAME ?? 'Neighborhood')),
        meta: (p) => ({ net_id: Number(p.PDNETID) || 0 }),
      }),
    FALLBACK,
  );
}
