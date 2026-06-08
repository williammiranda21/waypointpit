import { useEffect, useRef, useState } from 'react';
import mapboxgl, { type Map as MapboxMap, type LngLatBoundsLike } from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { GeoJSONAreaGeometry } from '@/lib/database.types';
import { MIAMI_DADE_CENTER, MIAMI_DADE_ZOOM, mapboxConfigured, mapboxToken } from './mapToken';
import { polygonBBox, unionBBox, type BBox } from './geo';
import { MapPlaceholder } from './MapPlaceholder';
import { HOTSPOT_COLORS, markerRadius, type MapMarker } from './markers';

if (mapboxConfigured) {
  mapboxgl.accessToken = mapboxToken;
}

export interface MapPolygon {
  id: string;
  name?: string;
  geometry: GeoJSONAreaGeometry;
  color: string;
}

export interface HeatmapPoint {
  lng: number;
  lat: number;
  /** Relative weight (e.g. person_count). Defaults to 1 if absent. */
  weight?: number;
}

export interface ChoroplethBucket {
  id: string;
  /** Hex color computed by the caller (so the color ramp lives outside MapView). */
  fillColor: string;
  /** Fill opacity 0-1. Defaults to 0.55. */
  fillOpacity?: number;
}

interface MapViewProps {
  polygons?: MapPolygon[];
  /** Point markers (hotspots, submissions, etc.). */
  markers?: MapMarker[];
  /** Per-polygon fill override (choropleth). Keyed by polygon id. */
  choropleth?: ChoroplethBucket[];
  /** Heatmap points (analysis page). Rendered as a Mapbox heatmap layer. */
  heatmapPoints?: HeatmapPoint[];
  /** Highlighted polygon id — drawn with a thicker outline. */
  highlightId?: string;
  /** Fit bounds to the polygons on mount and whenever they change. Default true. */
  fitToPolygons?: boolean;
  className?: string;
  /** Map style URL. Defaults to Waypoint light. */
  style?: string;
  /** Receives the mapbox instance once it's loaded — for drawing tools, etc. */
  onMapReady?: (map: MapboxMap) => void;
  onMarkerClick?: (id: string) => void;
  onPolygonClick?: (id: string) => void;
  /** Generic map click — receives the lng/lat of any tap. Used by the volunteer pin-drop picker. */
  onMapClick?: (lng: number, lat: number) => void;
}

const SOURCE_ID = 'wp-zones';
const FILL_LAYER_ID = 'wp-zones-fill';
const LINE_LAYER_ID = 'wp-zones-line';
const LABEL_LAYER_ID = 'wp-zones-labels';
const MARKER_SOURCE_ID = 'wp-markers';
const MARKER_LAYER_ID = 'wp-markers-circle';
const MARKER_RING_LAYER_ID = 'wp-markers-ring';
const HEAT_SOURCE_ID = 'wp-heat';
const HEAT_LAYER_ID = 'wp-heat-layer';

export function MapView({
  polygons = [],
  markers = [],
  choropleth,
  heatmapPoints,
  highlightId,
  fitToPolygons = true,
  className,
  style = 'mapbox://styles/mapbox/light-v11',
  onMapReady,
  onMarkerClick,
  onPolygonClick,
  onMapClick,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const [ready, setReady] = useState(false);

  // Init / destroy
  useEffect(() => {
    if (!mapboxConfigured || !containerRef.current || mapRef.current) return;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style,
      center: MIAMI_DADE_CENTER,
      zoom: MIAMI_DADE_ZOOM,
      attributionControl: true,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');

    map.on('load', () => {
      mapRef.current = map;
      setReady(true);
      onMapReady?.(map);
    });

    if (onMapClick) {
      map.on('click', (e) => {
        // Skip clicks that hit our marker layer (those go through onMarkerClick).
        const features = map.queryRenderedFeatures(e.point, {
          layers: [MARKER_LAYER_ID].filter((l) => !!map.getLayer(l)),
        });
        if (features && features.length > 0) return;
        onMapClick(e.lngLat.lng, e.lngLat.lat);
      });
    }

    return () => {
      mapRef.current = null;
      map.remove();
    };
    // We intentionally only re-create on style change. polygons/highlights are
    // handled by the separate render effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [style]);

  // Render polygons
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const bucketById = new Map(choropleth?.map((b) => [b.id, b]) ?? []);
    const features: GeoJSON.Feature[] = polygons.map((p) => {
      const bucket = bucketById.get(p.id);
      return {
        type: 'Feature',
        properties: {
          id: p.id,
          color: p.color,
          name: p.name ?? '',
          fillColor: bucket?.fillColor ?? p.color,
          fillOpacity: bucket?.fillOpacity ?? (bucket ? 0.55 : 0.18),
        },
        geometry: p.geometry,
      };
    });
    const data: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features };

    const existing = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
    if (existing) {
      existing.setData(data);
    } else {
      map.addSource(SOURCE_ID, { type: 'geojson', data });
      map.addLayer({
        id: FILL_LAYER_ID,
        type: 'fill',
        source: SOURCE_ID,
        paint: {
          'fill-color': ['get', 'fillColor'],
          'fill-opacity': ['get', 'fillOpacity'],
        },
      });
      map.addLayer({
        id: LINE_LAYER_ID,
        type: 'line',
        source: SOURCE_ID,
        paint: {
          'line-color': ['get', 'color'],
          'line-width': [
            'case',
            ['==', ['get', 'id'], highlightId ?? ''],
            3.5,
            2,
          ],
        },
      });
      map.addLayer({
        id: LABEL_LAYER_ID,
        type: 'symbol',
        source: SOURCE_ID,
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 12,
          'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
        },
        paint: {
          'text-color': '#111827',
          'text-halo-color': '#FFFFFF',
          'text-halo-width': 1.5,
        },
      });
      if (onPolygonClick) {
        map.on('click', FILL_LAYER_ID, (e) => {
          const f = e.features?.[0];
          if (f?.properties?.id) onPolygonClick(String(f.properties.id));
        });
        map.on('mouseenter', FILL_LAYER_ID, () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', FILL_LAYER_ID, () => {
          map.getCanvas().style.cursor = '';
        });
      }
    }

    // Update highlight line-width binding
    if (map.getLayer(LINE_LAYER_ID)) {
      map.setPaintProperty(LINE_LAYER_ID, 'line-width', [
        'case',
        ['==', ['get', 'id'], highlightId ?? ''],
        3.5,
        2,
      ]);
    }

    if (fitToPolygons && polygons.length > 0) {
      const boxes = polygons.map((p) => polygonBBox(p.geometry));
      const merged = unionBBox(boxes);
      if (merged) {
        map.fitBounds(toLngLatBounds(merged), {
          padding: 40,
          maxZoom: 13,
          duration: 600,
        });
      }
    }
  }, [polygons, choropleth, highlightId, fitToPolygons, onPolygonClick, ready]);

  // Render heatmap
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const points = heatmapPoints ?? [];
    const features: GeoJSON.Feature[] = points.map((p) => ({
      type: 'Feature',
      properties: { weight: p.weight ?? 1 },
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
    }));
    const data: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features };

    const existing = map.getSource(HEAT_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
    if (existing) {
      existing.setData(data);
      return;
    }

    if (points.length === 0) return; // nothing to add yet

    map.addSource(HEAT_SOURCE_ID, { type: 'geojson', data });
    map.addLayer(
      {
        id: HEAT_LAYER_ID,
        type: 'heatmap',
        source: HEAT_SOURCE_ID,
        paint: {
          'heatmap-weight': ['interpolate', ['linear'], ['get', 'weight'], 0, 0, 10, 1],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 10, 1, 14, 3],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 10, 18, 14, 36],
          'heatmap-opacity': 0.85,
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0, 'rgba(34,197,94,0)',
            0.25, 'rgba(34,197,94,0.55)',
            0.5, 'rgba(245,158,11,0.7)',
            0.75, 'rgba(239,68,68,0.8)',
            1, 'rgba(127,29,29,0.95)',
          ],
        },
      },
      // place heatmap above polygons but below markers
      map.getLayer(MARKER_RING_LAYER_ID) ? MARKER_RING_LAYER_ID : undefined,
    );
  }, [heatmapPoints, ready]);

  // Render markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const features: GeoJSON.Feature[] = markers.map((m) => ({
      type: 'Feature',
      properties: {
        id: m.id,
        color: HOTSPOT_COLORS[m.hotspot_type],
        radius: markerRadius(m.severity, m.expected_count),
        resolved: m.resolved ? 1 : 0,
        label: m.label ?? '',
      },
      geometry: { type: 'Point', coordinates: [m.lng, m.lat] },
    }));
    const data: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features };

    const existing = map.getSource(MARKER_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
    if (existing) {
      existing.setData(data);
    } else {
      map.addSource(MARKER_SOURCE_ID, { type: 'geojson', data });
      map.addLayer({
        id: MARKER_RING_LAYER_ID,
        type: 'circle',
        source: MARKER_SOURCE_ID,
        paint: {
          'circle-color': '#FFFFFF',
          'circle-radius': ['+', ['get', 'radius'], 2],
          'circle-opacity': 0.9,
        },
      });
      map.addLayer({
        id: MARKER_LAYER_ID,
        type: 'circle',
        source: MARKER_SOURCE_ID,
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': ['get', 'radius'],
          'circle-opacity': ['case', ['==', ['get', 'resolved'], 1], 0.35, 0.95],
          'circle-stroke-color': '#111827',
          'circle-stroke-width': ['case', ['==', ['get', 'resolved'], 1], 0, 1],
        },
      });
      if (onMarkerClick) {
        map.on('click', MARKER_LAYER_ID, (e) => {
          const f = e.features?.[0];
          if (f?.properties?.id) onMarkerClick(String(f.properties.id));
        });
        map.on('mouseenter', MARKER_LAYER_ID, () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', MARKER_LAYER_ID, () => {
          map.getCanvas().style.cursor = '';
        });
      }
    }
  }, [markers, onMarkerClick, ready]);

  if (!mapboxConfigured) {
    return (
      <MapPlaceholder
        polygons={polygons}
        markers={markers}
        choropleth={choropleth}
        heatmapPoints={heatmapPoints}
        highlightId={highlightId}
        onMarkerClick={onMarkerClick}
        onPolygonClick={onPolygonClick}
        onMapClick={onMapClick}
        className={className}
      />
    );
  }

  return (
    <div ref={containerRef} className={className ?? 'absolute inset-0'} aria-label="Map" />
  );
}

function toLngLatBounds(bbox: BBox): LngLatBoundsLike {
  return [
    [bbox[0], bbox[1]],
    [bbox[2], bbox[3]],
  ];
}
