import { useEffect, useRef, useState } from 'react';

export interface GeolocationFix {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
}

interface UseGeolocationOptions {
  /** Begin watching automatically. Set false if you want a manual start. */
  watch?: boolean;
  /** Request a higher-power, higher-accuracy fix. Default true. */
  highAccuracy?: boolean;
  /** Max age of cached position (ms). Default 0 (force fresh). */
  maximumAge?: number;
  /** Throttle interval (ms) — ignore updates closer together than this. */
  throttleMs?: number;
}

export interface UseGeolocationResult {
  position: GeolocationFix | null;
  error: string | null;
  /** True while a watch is registered. */
  isWatching: boolean;
  /** Has the browser API ever fired a callback for this hook? */
  hasFix: boolean;
}

/**
 * Thin wrapper around navigator.geolocation.watchPosition.
 *
 * Permission policy: callers should mount this only after explicit user intent
 * (e.g. inside the volunteer field app, behind a button). Most browsers prompt
 * automatically on first call.
 */
export function useGeolocation(options: UseGeolocationOptions = {}): UseGeolocationResult {
  const { watch = true, highAccuracy = true, maximumAge = 0, throttleMs = 1000 } = options;
  const [position, setPosition] = useState<GeolocationFix | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isWatching, setIsWatching] = useState(false);
  const lastEmitRef = useRef<number>(0);

  useEffect(() => {
    if (!watch) return;

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('Geolocation is not available in this browser.');
      return;
    }

    setIsWatching(true);
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - lastEmitRef.current < throttleMs) return;
        lastEmitRef.current = now;
        setPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        });
        setError(null);
      },
      (err) => {
        setError(err.message || 'Unable to read your location.');
      },
      {
        enableHighAccuracy: highAccuracy,
        maximumAge,
        timeout: 15_000,
      },
    );

    return () => {
      navigator.geolocation.clearWatch(id);
      setIsWatching(false);
    };
  }, [watch, highAccuracy, maximumAge, throttleMs]);

  return {
    position,
    error,
    isWatching,
    hasFix: position !== null,
  };
}
