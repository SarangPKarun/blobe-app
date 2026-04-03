import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';

export type GlobeScreenHandle = {
    sendLocation: (lat: number, lng: number) => void;
};

const GlobeScreen = forwardRef<GlobeScreenHandle>((_, ref) => {
    const webviewRef = useRef<WebView>(null);

    useImperativeHandle(ref, () => ({
        sendLocation: (lat: number, lng: number) => {
            // injectJavaScript is more reliable than postMessage for file:// URIs
            const js = `
                (function() {
                    try {
                        window.__rnAddMarker(${lat}, ${lng});
                    } catch(e) {
                        console.error('injectJS error:', e);
                    }
                })();
                true;
            `;
            webviewRef.current?.injectJavaScript(js);
        },
    }));

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
                onMessage={() => {}} // required to enable the JS bridge
                style={{ flex: 1 }}
            />
        </View>
    );
});

export default GlobeScreen;