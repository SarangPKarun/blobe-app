import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Region, SearchWeights } from '@blobe/shared-types';
import { SEARCH_SERVICE_URL } from '../config';

async function authHeaders(): Promise<Record<string, string>> {
  const token = await AsyncStorage.getItem('internal_jwt');
  if (!token) throw new Error('Not authenticated');
  return { Authorization: `Bearer ${token}` };
}

export async function searchWeights(q: string, region: Region): Promise<SearchWeights> {
  const bbox = `${region.minLongitude},${region.minLatitude},${region.maxLongitude},${region.maxLatitude}`;
  const headers = await authHeaders();
  const res = await fetch(
    `${SEARCH_SERVICE_URL}/search/weights?q=${encodeURIComponent(q)}&bbox=${bbox}`,
    { method: 'POST', headers },
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return (json?.data ?? {}) as SearchWeights;
}

export async function suggest(q: string): Promise<string[]> {
  const headers = await authHeaders();
  const res = await fetch(
    `${SEARCH_SERVICE_URL}/search/suggest?q=${encodeURIComponent(q)}`,
    { headers },
  );
  if (!res.ok) return [];
  const json = await res.json();
  return (json?.data?.suggestions ?? []) as string[];
}

export async function trending(): Promise<string[]> {
  const headers = await authHeaders();
  const res = await fetch(`${SEARCH_SERVICE_URL}/search/trending`, { headers });
  if (!res.ok) return [];
  const json = await res.json();
  return (json?.data?.trending ?? []) as string[];
}
