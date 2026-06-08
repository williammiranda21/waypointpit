import type { GeoJSONPolygon } from '@/lib/database.types';

/** Polygon bounding box as [west, south, east, north]. */
export type BBox = [number, number, number, number];

export function polygonBBox(polygon: GeoJSONPolygon): BBox {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const ring of polygon.coordinates) {
    for (const [lng, lat] of ring) {
      if (lng < west) west = lng;
      if (lng > east) east = lng;
      if (lat < south) south = lat;
      if (lat > north) north = lat;
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

/** Ray-casting point-in-polygon. Works on GeoJSON Polygons (single outer ring). */
export function pointInPolygon(lngLat: [number, number], polygon: GeoJSONPolygon): boolean {
  const [x, y] = lngLat;
  const ring = polygon.coordinates[0];
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
