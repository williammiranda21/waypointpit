import type { GeoJSONAreaGeometry } from '@/lib/database.types';

/** Polygon bounding box as [west, south, east, north]. */
export type BBox = [number, number, number, number];

/**
 * Normalize a Polygon or MultiPolygon to a list of polygon ring-sets, where
 * each ring-set is `[outerRing, ...holes]`. Lets the rest of the geometry code
 * treat both shapes uniformly.
 */
export function toRingSets(geom: GeoJSONAreaGeometry): number[][][][] {
  return geom.type === 'MultiPolygon' ? geom.coordinates : [geom.coordinates];
}

export function polygonBBox(geom: GeoJSONAreaGeometry): BBox {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const ringSet of toRingSets(geom)) {
    for (const ring of ringSet) {
      for (const [lng, lat] of ring) {
        if (lng < west) west = lng;
        if (lng > east) east = lng;
        if (lat < south) south = lat;
        if (lat > north) north = lat;
      }
    }
  }
  return [west, south, east, north];
}

export function unionBBox(boxes: BBox[]): BBox | null {
  if (boxes.length === 0) return null;
  let [w, s, e, n] = boxes[0];
  for (let i = 1; i < boxes.length; i++) {
    const [bw, bs, be, bn] = boxes[i];
    if (bw < w) w = bw;
    if (bs < s) s = bs;
    if (be > e) e = be;
    if (bn > n) n = bn;
  }
  return [w, s, e, n];
}

/** Ray-casting test for a single ring. */
function pointInRing(x: number, y: number, ring: number[][]): boolean {
  if (!ring || ring.length < 3) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 0) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Point-in-area test for a Polygon or MultiPolygon. A point counts as inside
 * when it falls within any sub-polygon's outer ring and not within one of that
 * polygon's holes. Handles islands (e.g. Miami Beach) correctly.
 */
export function pointInPolygon(lngLat: [number, number], geom: GeoJSONAreaGeometry): boolean {
  const [x, y] = lngLat;
  for (const ringSet of toRingSets(geom)) {
    const [outer, ...holes] = ringSet;
    if (!pointInRing(x, y, outer)) continue;
    if (holes.some((h) => pointInRing(x, y, h))) continue;
    return true;
  }
  return false;
}
