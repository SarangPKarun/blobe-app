import type { GlobeBanner, Region } from '@blobe/shared-types';
import { GLOBE_SERVICE_URL } from '../config';

export async function fetchBanners(
  region: Region,
  zoom = 12,
): Promise<GlobeBanner[]> {
  const bbox = `${region.minLongitude},${region.minLatitude},${region.maxLongitude},${region.maxLatitude}`;
  const url = `${GLOBE_SERVICE_URL}/banners?bbox=${bbox}&zoom=${zoom}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const json = await res.json();
  return (json?.data?.banners ?? []) as GlobeBanner[];
}
