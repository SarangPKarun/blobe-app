import React, { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';
import { View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import type {
  GlobeBanner,
  SearchWeights,
  CameraState,
  Region,
  WebViewMessage,
} from '@blobe/shared-types';

export type GlobeScreenHandle = {
  sendBanners(banners: GlobeBanner[]): void;
  sendSearchWeights(weights: SearchWeights): void;
  sendCameraSet(state: CameraState): void;
  /** Convenience wrapper: pans globe to lat/lng at current altitude. */
  sendLocation(lat: number, lng: number): void;
};

export type GlobeEventHandlers = {
  onBannerTapped?: (bannerId: string) => void;
  onCameraMoved?: (state: CameraState) => void;
  onRegionChanged?: (region: Region) => void;
};

const GlobeScreen = forwardRef<GlobeScreenHandle, GlobeEventHandlers>(
  ({ onBannerTapped, onCameraMoved, onRegionChanged }, ref) => {
    const webviewRef = useRef<WebView>(null);

    const postMsg = useCallback((msg: WebViewMessage) => {
      webviewRef.current?.postMessage(JSON.stringify(msg));
    }, []);

    useImperativeHandle(ref, () => ({
      sendBanners: (banners) =>
        postMsg({ type: 'BANNERS_UPDATE', payload: banners }),
      sendSearchWeights: (weights) =>
        postMsg({ type: 'SEARCH_WEIGHTS', payload: weights }),
      sendCameraSet: (cameraState) =>
        postMsg({ type: 'CAMERA_SET', payload: cameraState }),
      sendLocation: (lat, lng) =>
        postMsg({ type: 'CAMERA_SET', payload: { latitude: lat, longitude: lng, altitude: 0 } }),
    }));

    const handleMessage = useCallback(
      (event: WebViewMessageEvent) => {
        try {
          const msg = JSON.parse(event.nativeEvent.data) as WebViewMessage;
          switch (msg.type) {
            case 'BANNER_TAPPED':
              onBannerTapped?.(msg.payload.bannerId);
              break;
            case 'CAMERA_MOVED':
              onCameraMoved?.(msg.payload);
              break;
            case 'REGION_CHANGED':
              onRegionChanged?.(msg.payload);
              break;
          }
        } catch {
          // ignore malformed messages
        }
      },
      [onBannerTapped, onCameraMoved, onRegionChanged],
    );

    return (
      <View style={{ flex: 1 }}>
        <WebView
          ref={webviewRef}
          originWhitelist={['*']}
          source={{ uri: 'file:///android_asset/globe/globe.html' }}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          allowFileAccess={true}
          allowUniversalAccessFromFileURLs={true}
          allowingReadAccessToURL={'file:///android_asset/'}
          mixedContentMode="always"
          onMessage={handleMessage}
          style={{ flex: 1 }}
        />
      </View>
    );
  },
);

export default GlobeScreen;
