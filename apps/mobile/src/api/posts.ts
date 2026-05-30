import AsyncStorage from '@react-native-async-storage/async-storage';
import { POST_SERVICE_URL } from '../config';

export interface CreatePostBody {
  latitude: number;
  longitude: number;
  title: string;
  content?: string;
  frontText?: string;
  backText?: string;
}

export interface PostRow {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  content: string | null;
  frontText: string | null;
  backText: string | null;
  authorId: string;
  mediaUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePostResponse {
  post: PostRow;
  uploadUrl: string;
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await AsyncStorage.getItem('internal_jwt');
  if (!token) throw new Error('Not authenticated');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export async function createPost(body: CreatePostBody): Promise<CreatePostResponse> {
  const headers = await authHeaders();
  const res = await fetch(`${POST_SERVICE_URL}/posts`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
