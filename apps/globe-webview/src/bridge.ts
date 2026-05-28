import type { WebViewMessage } from '@blobe/shared-types';

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage(data: string): void };
  }
}

type OutboundMsg = Extract<
  WebViewMessage,
  { type: 'BANNER_TAPPED' } | { type: 'CAMERA_MOVED' } | { type: 'REGION_CHANGED' }
>;

export function sendToRN(msg: OutboundMsg): void {
  window.ReactNativeWebView?.postMessage(JSON.stringify(msg));
}

export function onRNMessage(handler: (msg: WebViewMessage) => void): void {
  const listener = (e: MessageEvent) => {
    try {
      handler(JSON.parse(e.data) as WebViewMessage);
    } catch {
      // ignore non-JSON or malformed messages
    }
  };
  window.addEventListener('message', listener);
  // Android WebView sometimes routes through document instead of window
  document.addEventListener('message', listener as EventListener);
}
