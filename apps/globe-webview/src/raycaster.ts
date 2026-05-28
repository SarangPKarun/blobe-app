import * as THREE from 'three';
import type { SceneState } from './scene.js';
import { getBannerMeshMap } from './banners.js';
import { sendToRN } from './bridge.js';

const DRAG_THRESHOLD_PX = 10;

export function initRaycaster(state: SceneState): void {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let pointerDownX = 0;
  let pointerDownY = 0;

  const canvas = state.renderer.domElement;

  canvas.addEventListener('pointerdown', (e: PointerEvent) => {
    pointerDownX = e.clientX;
    pointerDownY = e.clientY;
  });

  canvas.addEventListener('pointerup', (e: PointerEvent) => {
    const dx = e.clientX - pointerDownX;
    const dy = e.clientY - pointerDownY;
    if (Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD_PX) return;

    const rect = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(pointer, state.camera);

    const meshes = Array.from(getBannerMeshMap().values());
    const hits = raycaster.intersectObjects(meshes, false);
    if (hits.length === 0) return;

    const bannerId = (hits[0].object as THREE.Mesh).userData.bannerId as string | undefined;
    if (bannerId) {
      sendToRN({ type: 'BANNER_TAPPED', payload: { bannerId } });
    }
  });
}
