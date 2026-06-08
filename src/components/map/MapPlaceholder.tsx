import { Map as MapIcon } from 'lucide-react';
import type { ChoroplethBucket, HeatmapPoint, MapPolygon } from './MapView';
import { polygonBBox, unionBBox, type BBox } from './geo';
import { HOTSPOT_COLORS, markerRadius, type MapMarker } from './markers';
import { cn } from '@/lib/cn';

interface MapPlaceholderProps {
  polygons?: MapPolygon[];
  markers?: MapMarker[];
  choropleth?: ChoroplethBucket[];
  heatmapPoints?: HeatmapPoint[];
  highlightId?: string;
  onMarkerClick?: (id: string) => void;
  onPolygonClick?: (id: string) => void;
  onMapClick?: (lng: number, lat: number) => void;
  className?: string;
}

const MIAMI_BBOX: BBox = [-80.55, 25.4, -80.1, 26.0];

/**
 * Shown when VITE_MAPBOX_TOKEN is not configured. Renders a low-fidelity SVG
 * of the polygon set so the rest of the page is still meaningful. When a real
 * token is added the proper Mapbox view replaces this.
 */
export function MapPlaceholder({
  polygons = [],
  markers = [],
  choropleth,
  heatmapPoints,
  highlightId,
  onMarkerClick,
  onPolygonClick,
  onMapClick,
  className,
}: MapPlaceholderProps) {
  const polygonsBBox = polygons.length
    ? (unionBBox(polygons.map((p) => polygonBBox(p.geometry))) as BBox)
    : null;

  // Pad the displayed bbox so polygons aren't flush against the SVG edge.
  // If we only have markers, fall back to the Miami bbox so they sit somewhere.
  const bbox = polygonsBBox ? padBBox(polygonsBBox, 0.1) : MIAMI_BBOX;

  const bucketById = new Map(choropleth?.map((b) => [b.id, b]) ?? []);

  return (
    <div
      className={cn(
        'relative h-full w-full overflow-hidden rounded-xl border border-wp-border bg-gradient-to-br from-blue-50 via-gray-50 to-emerald-50',
        className,
      )}
      aria-label="Map placeholder"
    >
      <svg
        viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="xMidYMid meet"
        style={{ cursor: onMapClick ? 'crosshair' : undefined }}
        onClick={
          onMapClick
            ? (e) => {
                const svg = e.currentTarget;
                const rect = svg.getBoundingClientRect();
                // Convert client coords → SVG viewBox coords using preserveAspectRatio=meet.
                const scale = Math.min(rect.width / VIEW.w, rect.height / VIEW.h);
                const offsetX = (rect.width - VIEW.w * scale) / 2;
                const offsetY = (rect.height - VIEW.h * scale) / 2;
                const x = (e.clientX - rect.left - offsetX) / scale;
                const y = (e.clientY - rect.top - offsetY) / scale;
                const [lng, lat] = unprojectXY(x, y, bbox);
                onMapClick(lng, lat);
              }
            : undefined
        }
      >
        {/* Subtle graticule + heat-blur filter */}
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#E5E7EB" strokeWidth="0.5" />
          </pattern>
          <filter id="heatblur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="10" />
          </filter>
        </defs>
        <rect width={VIEW.w} height={VIEW.h} fill="url(#grid)" />

        {polygons.map((p) => {
          const points = p.geometry.coordinates[0]
            .map(([lng, lat]) => projectXY(lng, lat, bbox))
            .map(([x, y]) => `${x},${y}`)
            .join(' ');
          const bucket = bucketById.get(p.id);
          const fill = bucket?.fillColor ?? p.color;
          const fillOpacity = bucket?.fillOpacity ?? (bucket ? 0.55 : 0.22);
          const isHighlighted = p.id === highlightId;
          return (
            <g
              key={p.id}
              style={{ cursor: onPolygonClick ? 'pointer' : 'default' }}
              onClick={onPolygonClick ? () => onPolygonClick(p.id) : undefined}
            >
              <polygon
                points={points}
                fill={fill}
                fillOpacity={fillOpacity}
                stroke={p.color}
                strokeWidth={isHighlighted ? 3 : 1.5}
                strokeLinejoin="round"
              />
              {p.name && (
                <text
                  x={centerOfPolygon(p.geometry.coordinates[0], bbox).x}
                  y={centerOfPolygon(p.geometry.coordinates[0], bbox).y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="10"
                  fontWeight="600"
                  fill="#111827"
                  style={{ paintOrder: 'stroke', stroke: '#fff', strokeWidth: 2 }}
                >
                  {p.name}
                </text>
              )}
            </g>
          );
        })}

        {heatmapPoints && heatmapPoints.length > 0 && (
          <g filter="url(#heatblur)" style={{ mixBlendMode: 'multiply' }}>
            {heatmapPoints.map((p, i) => {
              const [x, y] = projectXY(p.lng, p.lat, bbox);
              const w = p.weight ?? 1;
              const r = 18 + Math.min(30, w * 4);
              return (
                <circle
                  key={i}
                  cx={x}
                  cy={y}
                  r={r}
                  fill="#EF4444"
                  fillOpacity={0.55}
                />
              );
            })}
          </g>
        )}

        {markers.map((m) => {
          const [x, y] = projectXY(m.lng, m.lat, bbox);
          const color = HOTSPOT_COLORS[m.hotspot_type];
          const r = markerRadius(m.severity, m.expected_count);
          const opacity = m.resolved ? 0.35 : 0.95;
          return (
            <g
              key={m.id}
              style={{ cursor: onMarkerClick ? 'pointer' : 'default' }}
              onClick={onMarkerClick ? () => onMarkerClick(m.id) : undefined}
            >
              <circle cx={x} cy={y} r={r + 2} fill="#FFFFFF" opacity={0.9} />
              <circle
                cx={x}
                cy={y}
                r={r}
                fill={color}
                opacity={opacity}
                stroke="#111827"
                strokeWidth={m.resolved ? 0 : 1}
              />
            </g>
          );
        })}
      </svg>

      <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/90 border border-wp-border px-3 py-1 text-[11px] text-text-muted shadow-sm">
          <MapIcon size={12} />
          Mapbox token not configured — showing schematic preview
        </div>
      </div>
    </div>
  );
}

const VIEW = { w: 800, h: 600 };

function padBBox([w, s, e, n]: BBox, pad: number): BBox {
  const dx = (e - w) * pad;
  const dy = (n - s) * pad;
  return [w - dx, s - dy, e + dx, n + dy];
}

function projectXY(lng: number, lat: number, [w, s, e, n]: BBox): [number, number] {
  const x = ((lng - w) / (e - w)) * VIEW.w;
  // Y axis flipped — north is small Y in screen space.
  const y = ((n - lat) / (n - s)) * VIEW.h;
  return [x, y];
}

function unprojectXY(x: number, y: number, [w, s, e, n]: BBox): [number, number] {
  const lng = w + (x / VIEW.w) * (e - w);
  const lat = n - (y / VIEW.h) * (n - s);
  return [lng, lat];
}

function centerOfPolygon(ring: number[][], bbox: BBox): { x: number; y: number } {
  let sx = 0;
  let sy = 0;
  // Exclude the closing duplicate vertex.
  const count = ring.length - 1;
  for (let i = 0; i < count; i++) {
    const [x, y] = projectXY(ring[i][0], ring[i][1], bbox);
    sx += x;
    sy += y;
  }
  return { x: sx / count, y: sy / count };
}
