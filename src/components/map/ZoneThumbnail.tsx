import type { GeoJSONPolygon } from '@/lib/database.types';
import { polygonBBox, type BBox } from './geo';

interface ZoneThumbnailProps {
  geometry: GeoJSONPolygon;
  color: string;
  size?: number;
}

/** Tiny SVG preview of a polygon — used in the template picker. */
export function ZoneThumbnail({ geometry, color, size = 88 }: ZoneThumbnailProps) {
  const bbox = pad(polygonBBox(geometry), 0.18);
  const points = geometry.coordinates[0]
    .map(([lng, lat]) => project(lng, lat, bbox, size))
    .map(([x, y]) => `${x},${y}`)
    .join(' ');

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="rounded-md bg-gray-50 border border-wp-border"
      aria-hidden
    >
      <polygon
        points={points}
        fill={color}
        fillOpacity={0.22}
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </svg>
  );
}

function pad([w, s, e, n]: BBox, p: number): BBox {
  const dx = (e - w) * p;
  const dy = (n - s) * p;
  return [w - dx, s - dy, e + dx, n + dy];
}

function project(lng: number, lat: number, [w, s, e, n]: BBox, size: number): [number, number] {
  const x = ((lng - w) / (e - w)) * size;
  const y = ((n - lat) / (n - s)) * size;
  return [x, y];
}
