export interface KafkaEvent<T = any> {
  topic: string;
  timestamp: string;
  traceId: string;
  payload: T;
}

export interface PostCreatedPayload {
  id: string;
  authorId: string;
  latitude: number;
  longitude: number;
  frontText?: string | null;
  backText?: string | null;
  mediaUrl?: string | null;
  createdAt: string;
}

export interface TrustVoteCreatedPayload {
  id: string;
  postId: string;
  postAuthorId: string;
  voterId: string;
  value: number;
  createdAt: string;
}

export interface PaymentCreatedPayload {
  id: string;
  recipientId: string;
  senderId: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
}

export type PostCreatedEvent      = KafkaEvent<PostCreatedPayload>;
export type TrustVoteCreatedEvent = KafkaEvent<TrustVoteCreatedPayload>;
export type PaymentCreatedEvent   = KafkaEvent<PaymentCreatedPayload>;
