import * as THREE from 'three';
import type { GlobeBanner, SearchWeights } from '@blobe/shared-types';
import { latLngToVector3 } from './scene.js';
import type { SceneState } from './scene.js';

const bannerMeshMap = new Map<string, THREE.Mesh>();
const bannerDataMap = new Map<string, GlobeBanner>();
let currentWeights: SearchWeights = { relevance: 1, recency: 1, popularity: 1 };
let weightsDebounceTimer: ReturnType<typeof setTimeout> | null = null;

export function getBannerMeshMap(): Map<string, THREE.Mesh> {
  return bannerMeshMap;
}

export function updateBanners(banners: GlobeBanner[], state: SceneState): void {
  const incomingIds = new Set(banners.map((b) => b.id));

  // Create or update
  for (const banner of banners) {
    bannerDataMap.set(banner.id, banner);
    const existing = bannerMeshMap.get(banner.id);
    if (existing) {
      positionMesh(existing, banner, state);
      scaleMesh(existing, banner, state);
    } else {
      const mesh = createBannerMesh(banner, state);
      bannerMeshMap.set(banner.id, mesh);
      state.globe!.add(mesh);
    }
  }

  // Remove stale
  for (const [id, mesh] of bannerMeshMap) {
    if (!incomingIds.has(id)) {
      state.globe!.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      bannerMeshMap.delete(id);
      bannerDataMap.delete(id);
    }
  }
}

export function applySearchWeights(weights: SearchWeights, state: SceneState): void {
  if (weightsDebounceTimer !== null) clearTimeout(weightsDebounceTimer);
  weightsDebounceTimer = setTimeout(() => {
    currentWeights = weights;
    for (const [id, mesh] of bannerMeshMap) {
      const banner = bannerDataMap.get(id);
      if (banner) scaleMesh(mesh, banner, state);
    }
  }, 200);
}

function createBannerMesh(banner: GlobeBanner, state: SceneState): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(1, 1);
  const material = new THREE.MeshBasicMaterial({
    color: 0x4a90d9,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.85,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.bannerId = banner.id;
  positionMesh(mesh, banner, state);
  scaleMesh(mesh, banner, state);
  return mesh;
}

function positionMesh(mesh: THREE.Mesh, banner: GlobeBanner, state: SceneState): void {
  // 1.01 offset keeps banners just above the surface in LOCAL space
  const pos = latLngToVector3(banner.latitude, banner.longitude, state.globeLocalRadius * 1.01);
  mesh.position.copy(pos);
  // Face outward from globe center
  mesh.lookAt(new THREE.Vector3(0, 0, 0));
  mesh.rotateY(Math.PI);
}

function scaleMesh(mesh: THREE.Mesh, banner: GlobeBanner, state: SceneState): void {
  const s = computeScale(banner, state);
  mesh.scale.set(s, s, s);
}

function computeScale(banner: GlobeBanner, state: SceneState): number {
  const base = state.globeLocalRadius * 0.04;
  const score = banner.score?.total ?? 0.5;
  const weighted =
    score *
    (currentWeights.relevance * 0.5 +
      currentWeights.popularity * 0.3 +
      currentWeights.recency * 0.2);
  return base * (0.5 + Math.min(weighted, 1.0) * 1.5);
}
