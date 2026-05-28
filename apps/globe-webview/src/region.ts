import ngeohash from 'ngeohash';
import type { Region } from '@blobe/shared-types';
import type { SceneState } from './scene.js';
import { extractCameraState } from './camera.js';
import { sendToRN } from './bridge.js';

// Precision 3 = ~156km cells, matches globe-service's zoom 4-6 LOD tier
const GEOHASH_PRECISION = 3;
const GLOBE_SCALE = 5;

let lastGeohashPrefix = '';

export function tickRegionChecker(state: SceneState): void {
  const region = computeVisibleRegion(state);
  if (!region) return;

  const prefix = regionToGeohashPrefix(region);
  if (prefix === lastGeohashPrefix) return;

  lastGeohashPrefix = prefix;
  sendToRN({ type: 'REGION_CHANGED', payload: region });
}

function computeVisibleRegion(state: SceneState): Region | null {
  if (!state.globe) return null;

  const worldRadius = state.globeLocalRadius * GLOBE_SCALE;
  const dist = state.camera.position.length();
  if (dist <= worldRadius) return null;

  // Half-angle of the visible spherical cap
  const horizonAngle = Math.asin(worldRadius / dist);

  const center = extractCameraState(state);
  const deltaLatDeg = (horizonAngle * 180) / Math.PI;
  // Longitude spread widens near the poles
  const cosLat = Math.cos((center.latitude * Math.PI) / 180);
  const deltaLngDeg = cosLat > 0.01 ? deltaLatDeg / cosLat : 180;

  return {
    minLatitude: Math.max(-90, center.latitude - deltaLatDeg),
    maxLatitude: Math.min(90, center.latitude + deltaLatDeg),
    minLongitude: Math.max(-180, center.longitude - deltaLngDeg),
    maxLongitude: Math.min(180, center.longitude + deltaLngDeg),
  };
}

function regionToGeohashPrefix(region: Region): string {
  const corners = [
    ngeohash.encode(region.minLatitude, region.minLongitude, GEOHASH_PRECISION),
    ngeohash.encode(region.minLatitude, region.maxLongitude, GEOHASH_PRECISION),
    ngeohash.encode(region.maxLatitude, region.minLongitude, GEOHASH_PRECISION),
    ngeohash.encode(region.maxLatitude, region.maxLongitude, GEOHASH_PRECISION),
  ];
  let prefix = corners[0];
  for (const c of corners.slice(1)) {
    let i = 0;
    while (i < prefix.length && i < c.length && prefix[i] === c[i]) i++;
    prefix = prefix.slice(0, i);
    if (prefix.length === 0) break;
  }
  return prefix;
}
