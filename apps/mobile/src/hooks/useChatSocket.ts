import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { io, Socket } from 'socket.io-client';
import { CHAT_SERVICE_URL } from '../config';
import type { ChatMessage } from '@blobe/shared-types';

interface UseChatSocketOptions {
  conversationId: string | null;
  onMessageNew: (message: ChatMessage) => void;
  onTypingStart: (data: { userId: string; conversationId: string }) => void;
  onTypingStop: (data: { userId: string; conversationId: string }) => void;
  onMessageRead: (data: { userId: string; conversationId: string; messageId: string }) => void;
  onPresenceUpdate: (data: { userId: string; online: boolean }) => void;
}

export function useChatSocket({
  conversationId,
  onMessageNew,
  onTypingStart,
  onTypingStop,
  onMessageRead,
  onPresenceUpdate,
}: UseChatSocketOptions) {
  const socketRef = useRef<Socket | null>(null);
  const isMounted = useRef(true);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const conversationIdRef = useRef<string | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    const socket = socketRef.current;
    if (socket) {
      socket.off('disconnect');
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    }
  }, []);

  const connect = useCallback(async () => {
    if (!isMounted.current) return;
    const token = await AsyncStorage.getItem('internal_jwt');
    if (!token) return;

    const socket = io(CHAT_SERVICE_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: false,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      reconnectAttemptRef.current = 0;
      if (conversationIdRef.current) {
        socket.emit('conversation:join', conversationIdRef.current);
      }
    });

    socket.on('message:new', onMessageNew);
    socket.on('typing:start', onTypingStart);
    socket.on('typing:stop', onTypingStop);
    socket.on('message:read', onMessageRead);
    socket.on('presence:update', onPresenceUpdate);

    socket.on('disconnect', () => {
      if (!isMounted.current) return;
      const delay = Math.min(1000 * 2 ** reconnectAttemptRef.current, 30_000);
      reconnectAttemptRef.current += 1;
      reconnectTimerRef.current = setTimeout(connect, delay);
    });

    socket.on('connect_error', () => {
      socket.close();
    });
  }, [onMessageNew, onTypingStart, onTypingStop, onMessageRead, onPresenceUpdate]);

  // Join new conversation room when conversationId changes
  useEffect(() => {
    const prev = conversationIdRef.current;
    conversationIdRef.current = conversationId;
    const socket = socketRef.current;
    if (!socket || !socket.connected) return;
    if (conversationId && conversationId !== prev) {
      socket.emit('conversation:join', conversationId);
    }
  }, [conversationId]);

  // Initial connect + AppState lifecycle
  useEffect(() => {
    isMounted.current = true;
    connect();

    const sub = AppState.addEventListener('change', (nextState) => {
      if (appStateRef.current === 'active' && nextState === 'background') {
        disconnect();
      } else if (appStateRef.current !== 'active' && nextState === 'active') {
        reconnectAttemptRef.current = 0;
        connect();
      }
      appStateRef.current = nextState;
    });

    return () => {
      isMounted.current = false;
      sub.remove();
      disconnect();
    };
  }, [connect, disconnect]);

  const sendMessage = useCallback(
    (data: { conversationId: string; encryptedContent: string; iv: string }) =>
      new Promise<{ messageId: string; createdAt: string }>((resolve, reject) => {
        if (!socketRef.current) return reject(new Error('Not connected'));
        socketRef.current.emit('message:send', data, (result: any) => {
          if ('error' in result) reject(new Error(result.error));
          else resolve(result);
        });
      }),
    [],
  );

  const emitTypingStart = useCallback((cId: string) => {
    socketRef.current?.emit('typing:start', cId);
  }, []);

  const emitTypingStop = useCallback((cId: string) => {
    socketRef.current?.emit('typing:stop', cId);
  }, []);

  const emitRead = useCallback((cId: string, mId: string) => {
    socketRef.current?.emit('message:read', { conversationId: cId, messageId: mId });
  }, []);

  return { sendMessage, emitTypingStart, emitTypingStop, emitRead };
}
