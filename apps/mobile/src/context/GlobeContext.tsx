import * as Sentry from '@sentry/react-native';
import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import type {
  GlobeBanner,
  CameraState,
  SearchWeights,
  Region,
  WebViewMessage,
} from '@blobe/shared-types';
import { fetchBanners } from '../api/globe';
import { encodeGeohash, useGlobeWebSocket } from '../hooks/useGlobeService';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../utils/firebaseConfig';

interface GlobeContextValue {
  webviewRef: React.RefObject<WebView | null>;
  /** Called by PersistentGlobeWebView once onLoadEnd fires — flushes queued messages. */
  onWebViewReady: () => void;
  sendBanners: (banners: GlobeBanner[]) => void;
  sendSearchWeights: (weights: SearchWeights) => void;
  sendCameraSet: (state: CameraState) => void;
  sendLocation: (lat: number, lng: number) => void;
  /** Read the latest camera position imperatively — not reactive to avoid CAMERA_MOVED flood. */
  getCameraState: () => CameraState | null;
  region: Region | null;
  lastTappedBannerId: string | null;
  handleWebViewMessage: (event: WebViewMessageEvent) => void;
}

const GlobeContext = createContext<GlobeContextValue | null>(null);

export function useGlobe(): GlobeContextValue {
  const ctx = useContext(GlobeContext);
  if (!ctx) throw new Error('useGlobe must be used inside GlobeProvider');
  return ctx;
}

function GlobeProviderInner({ children }: { children: React.ReactNode }) {
  const webviewRef = useRef<WebView>(null);
  const isReady = useRef(false);
  const messageQueue = useRef<WebViewMessage[]>([]);
  const bannerMap = useRef(new Map<string, GlobeBanner>());
  const cameraStateRef = useRef<CameraState | null>(null);

  const [region, setRegion] = useState<Region | null>(null);
  const [lastTappedBannerId, setLastTappedBannerId] = useState<string | null>(null);
  const [currentGeohash, setCurrentGeohash] = useState<string | null>(null);

  const postMsg = useCallback((msg: WebViewMessage) => {
    if (!isReady.current) {
      messageQueue.current.push(msg);
      return;
    }
    webviewRef.current?.postMessage(JSON.stringify(msg));
  }, []);

  const onWebViewReady = useCallback(() => {
    isReady.current = true;
    for (const msg of messageQueue.current) {
      webviewRef.current?.postMessage(JSON.stringify(msg));
    }
    messageQueue.current = [];
  }, []);

  const sendBanners = useCallback(
    (banners: GlobeBanner[]) => postMsg({ type: 'BANNERS_UPDATE', payload: banners }),
    [postMsg],
  );

  const sendSearchWeights = useCallback(
    (weights: SearchWeights) => postMsg({ type: 'SEARCH_WEIGHTS', payload: weights }),
    [postMsg],
  );

  const sendCameraSet = useCallback(
    (state: CameraState) => postMsg({ type: 'CAMERA_SET', payload: state }),
    [postMsg],
  );

  const sendLocation = useCallback(
    (lat: number, lng: number) =>
      postMsg({ type: 'CAMERA_SET', payload: { latitude: lat, longitude: lng, altitude: 0 } }),
    [postMsg],
  );

  const getCameraState = useCallback(() => cameraStateRef.current, []);

  const pushAllBanners = useCallback(() => {
    postMsg({ type: 'BANNERS_UPDATE', payload: Array.from(bannerMap.current.values()) });
  }, [postMsg]);

  const onWsBannersUpdate = useCallback(
    (banners: GlobeBanner[]) => {
      for (const b of banners) bannerMap.current.set(b.id, b);
      pushAllBanners();
    },
    [pushAllBanners],
  );

  useGlobeWebSocket(currentGeohash, onWsBannersUpdate);

  const handleWebViewMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const msg = JSON.parse(event.nativeEvent.data) as WebViewMessage;
        switch (msg.type) {
          case 'BANNER_TAPPED':
            setLastTappedBannerId(msg.payload.bannerId);
            break;

          case 'CAMERA_MOVED':
            cameraStateRef.current = msg.payload;
            break;

          case 'GLOBE_TELEMETRY':
            Sentry.setMeasurement('globe.fps', (msg.payload as { fps: number }).fps, 'none');
            break;

          case 'REGION_CHANGED': {
            setRegion(msg.payload);
            const { minLatitude, maxLatitude, minLongitude, maxLongitude } = msg.payload;
            const centerLat = (minLatitude + maxLatitude) / 2;
            const centerLng = (minLongitude + maxLongitude) / 2;
            setCurrentGeohash(encodeGeohash(centerLat, centerLng, 3));

            fetchBanners(msg.payload)
              .then((banners) => {
                for (const b of banners) bannerMap.current.set(b.id, b);
                pushAllBanners();
              })
              .catch(() => {});
            break;
          }
        }
      } catch {}
    },
    [pushAllBanners],
  );

  const value: GlobeContextValue = {
    webviewRef,
    onWebViewReady,
    sendBanners,
    sendSearchWeights,
    sendCameraSet,
    sendLocation,
    getCameraState,
    region,
    lastTappedBannerId,
    handleWebViewMessage,
  };

  return <GlobeContext.Provider value={value}>{children}</GlobeContext.Provider>;
}

export function GlobeProvider({ children }: { children: React.ReactNode }) {
  // Monitor auth state so the WS hook inside stops reconnecting after logout.
  // We still render GlobeProviderInner regardless — the globe is always mounted.
  React.useEffect(() => {
    return onAuthStateChanged(auth, () => {});
  }, []);

  return <GlobeProviderInner>{children}</GlobeProviderInner>;
}
