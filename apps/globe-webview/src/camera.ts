import type { CameraState } from '@blobe/shared-types';
import { latLngToVector3 } from './scene.js';
import type { SceneState } from './scene.js';
import { sendToRN } from './bridge.js';

const THROTTLE_MS = 100;
// Globe scale factor matching scene.ts GLOBE_SCALE constant
const GLOBE_SCALE = 5;

let lastEmitTime = 0;

export function tickCameraEmitter(state: SceneState): void {
  const now = performance.now();
  if (now - lastEmitTime < THROTTLE_MS) return;
  lastEmitTime = now;
  sendToRN({ type: 'CAMERA_MOVED', payload: extractCameraState(state) });
}

export function handleCameraSet(payload: CameraState, state: SceneState): void {
  const radius = state.camera.position.length();
  state.targetCameraPos = latLngToVector3(payload.latitude, payload.longitude, radius);
  state.isAnimatingCamera = true;
}

export function extractCameraState(state: SceneState): CameraState {
  const pos = state.camera.position;
  const worldRadius = state.globeLocalRadius * GLOBE_SCALE;
  const dist = pos.length();

  // Inverse of latLngToVector3
  const lat = 90 - (Math.acos(pos.y / dist) * 180) / Math.PI;
  const lngRaw = (Math.atan2(pos.z, -pos.x) * 180) / Math.PI - 180;
  const lng = ((lngRaw + 540) % 360) - 180;

  return {
    latitude: lat,
    longitude: lng,
    altitude: dist - worldRadius,
  };
}
