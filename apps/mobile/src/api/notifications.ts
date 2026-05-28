import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const BASE_URL = process.env.API_GATEWAY_URL || 'http://10.0.2.2:8000';

async function authHeaders(): Promise<Record<string, string>> {
  const token = await AsyncStorage.getItem('internal_jwt');
  if (!token) throw new Error('Not authenticated');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export async function fetchNotifications(params: {
  limit?: number;
  cursor?: string;
  unreadOnly?: boolean;
}): Promise<{ notifications: any[]; hasMore: boolean; nextCursor: string | null }> {
  const headers = await authHeaders();
  const qs = new URLSearchParams();
  if (params.limit)     qs.set('limit', String(params.limit));
  if (params.cursor)    qs.set('cursor', params.cursor);
  if (params.unreadOnly) qs.set('unreadOnly', 'true');

  const res = await fetch(`${BASE_URL}/notifications?${qs}`, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function markNotificationRead(id: string): Promise<void> {
  const headers = await authHeaders();
  const res = await fetch(`${BASE_URL}/notifications/${id}/read`, {
    method: 'PATCH',
    headers,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export async function markAllRead(): Promise<void> {
  const headers = await authHeaders();
  const res = await fetch(`${BASE_URL}/notifications/read-all`, {
    method: 'PATCH',
    headers,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export async function updateNotificationPrefs(
  userId: string,
  prefs: Partial<{
    pushEnabled: boolean;
    emailEnabled: boolean;
    postCreated: boolean;
    trustVote: boolean;
    payment: boolean;
  }>
): Promise<void> {
  const headers = await authHeaders();
  const res = await fetch(`${BASE_URL}/users/${userId}/notification-prefs`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(prefs),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export async function registerDeviceToken(
  token: string,
  overrideJwt?: string
): Promise<void> {
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';
  const headers = overrideJwt
    ? { Authorization: `Bearer ${overrideJwt}`, 'Content-Type': 'application/json' }
    : await authHeaders();

  const res = await fetch(`${BASE_URL}/device-tokens`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ token, platform }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export async function deregisterDeviceToken(token: string): Promise<void> {
  const headers = await authHeaders();
  const res = await fetch(`${BASE_URL}/device-tokens`, {
    method: 'DELETE',
    headers,
    body: JSON.stringify({ token }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}
