import { initScene, showError } from './scene.js';
import { updateBanners, applySearchWeights } from './banners.js';
import { handleCameraSet, tickCameraEmitter } from './camera.js';
import { initRaycaster } from './raycaster.js';
import { tickRegionChecker } from './region.js';
import { onRNMessage } from './bridge.js';
import type { WebViewMessage } from '@blobe/shared-types';

window.onerror = (msg, _src, line) => {
  showError(`JS Error: ${msg} (line ${line})`);
};

const state = initScene();

state.onGlobeReady(() => {
  initRaycaster(state);
});

state.onAnimationFrame(() => {
  tickCameraEmitter(state);
  tickRegionChecker(state);
});

onRNMessage((msg: WebViewMessage) => {
  switch (msg.type) {
    case 'BANNERS_UPDATE':
      state.onGlobeReady(() => updateBanners(msg.payload, state));
      break;
    case 'SEARCH_WEIGHTS':
      applySearchWeights(msg.payload, state);
      break;
    case 'CAMERA_SET':
      state.onGlobeReady(() => handleCameraSet(msg.payload, state));
      break;
  }
});
