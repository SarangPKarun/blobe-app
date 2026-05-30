import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GlobeBanner, Region } from '@blobe/shared-types';
import { GLOBE_WS_URL } from '../config';

// Inline precision-3 geohash encoder — avoids a new dependency.
// Standard base32 alphabet used by all geohash implementations.
const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

export function encodeGeohash(lat: number, lng: number, precision = 3): string {
  let minLat = -90, maxLat = 90;
  let minLng = -180, maxLng = 180;
  let hash = '';
  let bits = 0;
  let bitsTotal = 0;
  let hashValue = 0;
  let isLng = true;

  while (hash.length < precision) {
    if (isLng) {
      const mid = (minLng + maxLng) / 2;
      if (lng >= mid) { hashValue = (hashValue << 1) | 1; minLng = mid; }
      else             { hashValue = (hashValue << 1) | 0; maxLng = mid; }
    } else {
      const mid = (minLat + maxLat) / 2;
      if (lat >= mid) { hashValue = (hashValue << 1) | 1; minLat = mid; }
      else            { hashValue = (hashValue << 1) | 0; maxLat = mid; }
    }
    isLng = !isLng;
    bits++;
    bitsTotal++;
    if (bits === 5) {
      hash += BASE32[hashValue];
      bits = 0;
      hashValue = 0;
    }
  }
  return hash;
}

export function useGlobeWebSocket(
  geohash: string | null,
  onBannersUpdate: (banners: GlobeBanner[]) => void,
): void {
  const wsRef = useRef<WebSocket | null>(null);
  const geohashRef = useRef<string | null>(null);
  const reconnectAttempt = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted = useRef(true);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  const clearTimer = () => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
  };

  const subscribe = (ws: WebSocket, hash: string) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'subscribe', geohash: hash }));
    }
  };

  const unsubscribe = (ws: WebSocket, hash: string) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'unsubscribe', geohash: hash }));
    }
  };

  const connect = async () => {
    if (!isMounted.current) return;
    const token = await AsyncStorage.getItem('internal_jwt');
    if (!token) return; // not authenticated — stop reconnect loop

    const ws = new WebSocket(`${GLOBE_WS_URL}?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectAttempt.current = 0;
      if (geohashRef.current) subscribe(ws, geohashRef.current);
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg?.type === 'banners_update' && Array.isArray(msg.banners)) {
          onBannersUpdate(msg.banners as GlobeBanner[]);
        }
      } catch {}
    };

    ws.onerror = () => {};

    ws.onclose = () => {
      if (!isMounted.current) return;
      const delay = Math.min(1000 * 2 ** reconnectAttempt.current, 30_000);
      reconnectAttempt.current += 1;
      reconnectTimer.current = setTimeout(connect, delay);
    };
  };

  const disconnect = () => {
    clearTimer();
    const ws = wsRef.current;
    if (ws) {
      ws.onclose = null; // prevent reconnect loop on intentional close
      ws.close();
      wsRef.current = null;
    }
  };

  // Handle geohash changes — unsubscribe old, subscribe new
  useEffect(() => {
    const prev = geohashRef.current;
    geohashRef.current = geohash;
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (prev && prev !== geohash) unsubscribe(ws, prev);
    if (geohash) subscribe(ws, geohash);
  }, [geohash]);

  // Initial connection + AppState lifecycle
  useEffect(() => {
    isMounted.current = true;
    connect();

    const sub = AppState.addEventListener('change', (nextState) => {
      if (appState.current === 'active' && nextState === 'background') {
        disconnect();
      } else if (appState.current !== 'active' && nextState === 'active') {
        connect();
      }
      appState.current = nextState;
    });

    return () => {
      isMounted.current = false;
      sub.remove();
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
