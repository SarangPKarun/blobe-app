import AsyncStorage from '@react-native-async-storage/async-storage';
import { CHAT_SERVICE_URL } from '../config';
import type { Conversation, ChatMessage } from '@blobe/shared-types';

async function authHeaders(): Promise<Record<string, string>> {
  const token = await AsyncStorage.getItem('internal_jwt');
  if (!token) throw new Error('Not authenticated');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export async function listConversations(): Promise<Conversation[]> {
  const headers = await authHeaders();
  const res = await fetch(`${CHAT_SERVICE_URL}/conversations`, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function getOrCreateConversation(recipientId: string): Promise<Conversation> {
  const headers = await authHeaders();
  const res = await fetch(`${CHAT_SERVICE_URL}/conversations`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ recipientId }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchMessages(
  conversationId: string,
  cursor?: string,
  limit = 30,
): Promise<{ messages: ChatMessage[]; hasMore: boolean; nextCursor: string | null }> {
  const headers = await authHeaders();
  const qs = new URLSearchParams({ limit: String(limit) });
  if (cursor) qs.set('cursor', cursor);
  const res = await fetch(
    `${CHAT_SERVICE_URL}/conversations/${conversationId}/messages?${qs}`,
    { headers },
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function registerPublicKey(publicKey: string): Promise<void> {
  const headers = await authHeaders();
  const res = await fetch(`${CHAT_SERVICE_URL}/keys`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ publicKey }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export async function fetchPublicKey(userId: string): Promise<string> {
  const headers = await authHeaders();
  const res = await fetch(`${CHAT_SERVICE_URL}/keys/${userId}`, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data: { publicKey: string } = await res.json();
  return data.publicKey;
}
