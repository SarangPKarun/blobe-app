import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useGlobe } from '../context/GlobeContext';

// Android bundles the globe HTML into the app assets.
// iOS support requires a separate asset-bundling step; render nothing until configured.
const globeSource =
  Platform.OS === 'android'
    ? { uri: 'file:///android_asset/globe/globe.html' }
    : null;

export default function PersistentGlobeWebView() {
  const { webviewRef, onWebViewReady, handleWebViewMessage } = useGlobe();

  if (!globeSource) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <WebView
        ref={webviewRef}
        source={globeSource}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        allowFileAccess
        allowUniversalAccessFromFileURLs
        allowingReadAccessToURL="file:///android_asset/"
        mixedContentMode="always"
        onLoadEnd={onWebViewReady}
        onMessage={handleWebViewMessage}
        style={styles.webview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  webview: { flex: 1 },
});
