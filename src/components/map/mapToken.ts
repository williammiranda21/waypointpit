const raw = import.meta.env.VITE_MAPBOX_TOKEN ?? '';

export const mapboxToken = raw;
export const mapboxConfigured =
  !!raw && raw.length > 10 && !raw.includes('placeholder');

// Approximate center of Miami-Dade County — used as a default view when no
// polygons are loaded yet.
export const MIAMI_DADE_CENTER: [number, number] = [-80.2, 25.78];
export const MIAMI_DADE_ZOOM = 9.2;
