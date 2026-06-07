export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  encryptedContent: string;
  iv: string;
  createdAt: string;
  isDeleted: boolean;
}

export interface ConversationParticipant {
  userId: string;
  lastReadAt: string | null;
}

export interface Conversation {
  id: string;
  type: string;
  updatedAt: string;
  participants: ConversationParticipant[];
  lastMessage?: ChatMessage;
  unreadCount?: number;
}

export interface ChatMessagePayload {
  messageId: string;
  conversationId: string;
  senderId: string;
  recipientIds: string[];
  createdAt: string;
}
