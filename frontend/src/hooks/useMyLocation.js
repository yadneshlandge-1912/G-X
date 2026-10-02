/**
 * useMyLocation.js
 * ─────────────────
 * Watches the browser's Geolocation API and returns the user's live position.
 *
 * Returns
 * -------
 * {
 *   position : { lat, lon, accuracy } | null
 *   status   : 'idle' | 'loading' | 'active' | 'denied' | 'unavailable' | 'error'
 *   error    : string | null
 *   start    : () => void   — call to request permission and begin watching
 *   stop     : () => void   — call to stop watching and clear marker
 * }
 *
 * The hook does NOT auto-start so the user explicitly opts in (privacy-friendly).
 */
import { useState, useRef, useCallback } from 'react';

export default function useMyLocation() {
  const [position, setPosition] = useState(null);
  const [status,   setStatus]   = useState('idle');   // idle | loading | active | denied | unavailable | error
  const [error,    setError]    = useState(null);
  const watchIdRef = useRef(null);

  const stop = useCallback(() => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setPosition(null);
    setStatus('idle');
    setError(null);
  }, []);

  const start = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus('unavailable');
      setError('Geolocation is not supported by this browser.');
      return;
    }

    // Already watching — do nothing
    if (watchIdRef.current != null) return;

    setStatus('loading');
    setError(null);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setPosition({
          lat:      pos.coords.latitude,
          lon:      pos.coords.longitude,
          accuracy: pos.coords.accuracy,      // metres — radius of 95 % confidence circle
          heading:  pos.coords.heading,       // degrees from north (null if unavailable)
          speed:    pos.coords.speed,         // m/s (null if unavailable)
          ts:       pos.timestamp,
        });
        setStatus('active');
        setError(null);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setStatus('denied');
          setError('Location permission denied. Allow it in browser settings.');
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setStatus('unavailable');
          setError('Position unavailable — check GPS/network.');
        } else {
          setStatus('error');
          setError(err.message);
        }
        watchIdRef.current = null;
      },
      {
        enableHighAccuracy: true,   // use GPS when available, not just WiFi/IP
        timeout:            15000,  // 15 s before triggering error callback
        maximumAge:         3000,   // accept cached position up to 3 s old
      },
    );
  }, [stop]);

  return { position, status, error, start, stop };
}
