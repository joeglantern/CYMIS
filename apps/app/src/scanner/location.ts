import type { GeoPoint } from '@cymis/schemas';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';

/**
 * Keeps the latest position while the scanner is open, so every scan gets a
 * fix without waiting for one. If the person says no, scans still save.
 */
export function useLiveLocation(active: boolean) {
  const latest = useRef<GeoPoint | null>(null);
  const [status, setStatus] = useState<'unknown' | 'granted' | 'denied'>('unknown');

  useEffect(() => {
    if (!active) return;
    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;
    (async () => {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (perm.status !== 'granted') return setStatus('denied');
        setStatus('granted');
        const last = await Location.getLastKnownPositionAsync({ maxAge: 60_000 });
        if (last) latest.current = toPoint(last);
        sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, distanceInterval: 3, timeInterval: 4000 },
          (pos) => {
            latest.current = toPoint(pos);
          },
        );
      } catch {
        setStatus('denied');
      }
    })();
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [active]);

  return { get: () => latest.current, status };
}

function toPoint(pos: Location.LocationObject): GeoPoint {
  const { latitude, longitude, accuracy } = pos.coords;
  return {
    lat: Math.round(latitude * 1e6) / 1e6,
    lng: Math.round(longitude * 1e6) / 1e6,
    ...(accuracy != null ? { accuracyM: Math.round(accuracy * 10) / 10 } : {}),
  };
}

export function formatPoint(p: GeoPoint | null | undefined): string {
  if (!p) return 'No location';
  const lat = `${Math.abs(p.lat).toFixed(4)} ${p.lat < 0 ? 'S' : 'N'}`;
  const lng = `${Math.abs(p.lng).toFixed(4)} ${p.lng < 0 ? 'W' : 'E'}`;
  return `${lat} ${lng}${p.accuracyM != null ? `, within ${Math.round(p.accuracyM)} m` : ''}`;
}
