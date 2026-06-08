import { rect, type BoundaryFeature } from './types';

/**
 * Representative subset of Miami-Dade County municipalities.
 * Demo geometries: rough rectangles based on each city's general location.
 * Real boundaries (34 municipalities + unincorporated areas) can be loaded
 * from the County's GIS Open Data Portal when wiring production.
 */
const CITIES: Array<{ name: string; w: number; s: number; e: number; n: number }> = [
  { name: 'Miami',            w: -80.30, s: 25.71, e: -80.16, n: 25.86 },
  { name: 'Miami Beach',      w: -80.16, s: 25.76, e: -80.11, n: 25.88 },
  { name: 'Hialeah',          w: -80.34, s: 25.83, e: -80.27, n: 25.92 },
  { name: 'Coral Gables',     w: -80.30, s: 25.66, e: -80.24, n: 25.74 },
  { name: 'Doral',            w: -80.40, s: 25.79, e: -80.34, n: 25.86 },
  { name: 'North Miami',      w: -80.21, s: 25.86, e: -80.15, n: 25.92 },
  { name: 'Homestead',        w: -80.50, s: 25.45, e: -80.42, n: 25.52 },
  { name: 'Kendall',          w: -80.40, s: 25.66, e: -80.32, n: 25.72 },
  { name: 'Aventura',         w: -80.17, s: 25.94, e: -80.11, n: 26.00 },
  { name: 'Cutler Bay',       w: -80.36, s: 25.55, e: -80.30, n: 25.62 },
  { name: 'Pinecrest',        w: -80.32, s: 25.64, e: -80.28, n: 25.69 },
  { name: 'Opa-locka',        w: -80.29, s: 25.88, e: -80.24, n: 25.92 },
  { name: 'Miami Lakes',      w: -80.34, s: 25.90, e: -80.29, n: 25.95 },
  { name: 'Florida City',     w: -80.48, s: 25.42, e: -80.43, n: 25.47 },
  { name: 'Sweetwater',       w: -80.40, s: 25.75, e: -80.36, n: 25.79 },
  { name: 'West Miami',       w: -80.31, s: 25.75, e: -80.28, n: 25.77 },
  { name: 'North Bay Village',w: -80.16, s: 25.84, e: -80.14, n: 25.86 },
  { name: 'Bal Harbour',      w: -80.13, s: 25.88, e: -80.11, n: 25.91 },
];

const FEATURES: BoundaryFeature[] = CITIES.map((c) => ({
  id: `muni-${c.name.toLowerCase().replace(/\s+/g, '-')}`,
  name: c.name,
  geometry: rect(c.w, c.s, c.e, c.n),
}));

export async function loadMunicipalities(): Promise<BoundaryFeature[]> {
  return FEATURES;
}
