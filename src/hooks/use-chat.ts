"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { playNotificationSound } from '@/lib/notification-sounds';

// ─── Types ───

export interface ChatMessage {
  id: string;
  conversationId: string;
  tenantId: string;
  senderType: 'landlord' | 'renter';
  senderId: string | null;
  content: string;
  messageType: 'text' | 'image' | 'document' | 'system';
  fileUrl: string | null;
  fileName: string | null;
  landlordReadAt: string | null;
  renterReadAt: string | null;
  createdAt: string;
}

export interface UseChatOptions {
  /** Auth token (Bearer token) for API calls */
  token: string;
  /** Tenant ID for the landlord API */
  tenantId: string;
  /** Optional: role of the current user ('landlord' | 'renter'). Defaults to 'landlord'. */
  role?: 'landlord' | 'renter';
  /** Optional: renter ID (required when role is 'renter') */
  renterId?: string;
  /** Whether to play a sound on new incoming messages */
  playSound?: boolean;
  /** Sound type to play on new messages */
  soundType?: string;
}

export interface UseChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  isConnected: boolean;
  error: string | null;
  sendMessage: (content: string, messageType?: string) => Promise<boolean>;
  markAsRead: () => Promise<void>;
}

// ─── Hook ───

export function useChat(
  conversationId: string,
  options: UseChatOptions
): UseChatReturn {
  const {
    token,
    tenantId,
    role = 'landlord',
    renterId,
    playSound = true,
    soundType = 'message',
  } = options;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const knownMessageIds = useRef<Set<string>>(new Set());

  // Build API base URL depending on role
  const getApiUrl = useCallback(() => {
    if (role === 'renter' && renterId) {
      return `/api/renter/${renterId}/chat`;
    }
    return `/api/tenant/${tenantId}/chat`;
  }, [role, renterId, tenantId]);

  // Build SSE URL
  const getSSEUrl = useCallback(() => {
    const lastMsgId = messages.length > 0 ? messages[messages.length - 1].id : null;
    let url = `/api/tenant/${tenantId}/chat/stream?conversationId=${conversationId}`;
    if (lastMsgId) {
      url += `&lastMessageId=${lastMsgId}`;
    }
    return url;
  }, [tenantId, conversationId, messages]);

  // Fetch initial messages
  const fetchMessages = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${getApiUrl()}?renterId=${role === 'renter' ? renterId : ''}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!res.ok) throw new Error('Failed to fetch messages');

      // We need to fetch messages directly. Since the GET returns conversations,
      // let's use the SSE endpoint with no lastMessageId to get all messages.
      // Actually, let's create a simpler approach: fetch messages via a dedicated param
      // For now, we'll rely on SSE for initial load too.
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [getApiUrl, token, role, renterId]);

  // Connect to SSE for real-time updates
  const connectSSE = useCallback(() => {
    if (!conversationId || !token) return;

    // Close any existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // We can't set custom headers on EventSource, so we use fetch + ReadableStream
    // to create a custom SSE-like connection with auth
    const sseUrl = getSSEUrl();

    // Use fetch with streaming to support auth headers
    const controller = new AbortController();

    fetch(sseUrl, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok || !response.body) {
          setError('Failed to connect to chat stream');
          return;
        }

        setIsConnected(true);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            // Parse SSE events from buffer
            const lines = buffer.split('\n');
            buffer = '';

            let currentEvent = '';
            let currentData = '';

            for (const line of lines) {
              if (line.startsWith('event: ')) {
                currentEvent = line.substring(7).trim();
              } else if (line.startsWith('data: ')) {
                currentData = line.substring(6);
              } else if (line === '' && currentEvent && currentData) {
                // Dispatch complete event
                handleSSEEvent(currentEvent, currentData);
                currentEvent = '';
                currentData = '';
              } else if (line !== '') {
                // Incomplete line, put back in buffer
                buffer = line;
              }
            }
          }
        } catch (err: any) {
          if (err.name !== 'AbortError') {
            console.error('SSE read error:', err);
            setError('Chat connection lost');
          }
        } finally {
          setIsConnected(false);
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          console.error('SSE connection error:', err);
          setError('Failed to connect to chat');
        }
      });

    // Store abort controller for cleanup
    (eventSourceRef as any).current = { close: () => controller.abort() };
  }, [conversationId, token, getSSEUrl]);

  // Handle incoming SSE events
  const handleSSEEvent = useCallback(
    (eventType: string, rawData: string) => {
      try {
        const data = JSON.parse(rawData);

        if (eventType === 'message') {
          // Deduplicate messages
          if (knownMessageIds.current.has(data.id)) return;
          knownMessageIds.current.add(data.id);

          setMessages((prev) => {
            // Avoid duplicates by checking if we already have this message
            if (prev.some((m) => m.id === data.id)) return prev;
            return [...prev, data];
          });

          setIsLoading(false);

          // Play notification sound for new incoming messages
          if (playSound && data.senderType !== role) {
            playNotificationSound(soundType);
          }
        } else if (eventType === 'heartbeat' || eventType === 'connected') {
          // Keep-alive, nothing to do
        } else if (eventType === 'error') {
          setError(data.error || 'Stream error');
        }
      } catch {
        // Ignore malformed events
      }
    },
    [playSound, role, soundType]
  );

  // Send a message
  const sendMessage = useCallback(
    async (content: string, messageType: string = 'text'): Promise<boolean> => {
      try {
        const url = getApiUrl();
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            _action: 'sendMessage',
            conversationId,
            content,
            messageType,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          setError(errData.error || 'Failed to send message');
          return false;
        }

        return true;
      } catch (err: any) {
        setError(err.message || 'Failed to send message');
        return false;
      }
    },
    [getApiUrl, token, conversationId]
  );

  // Mark messages as read
  const markAsRead = useCallback(async () => {
    try {
      const url = getApiUrl();
      await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ conversationId }),
      });
    } catch (err: any) {
      console.error('Mark as read error:', err);
    }
  }, [getApiUrl, token, conversationId]);

  // Lifecycle: connect on mount, disconnect on unmount
  useEffect(() => {
    if (conversationId) {
      fetchMessages();
      connectSSE();
    }

    return () => {
      if (eventSourceRef.current) {
        (eventSourceRef.current as any).close?.();
        eventSourceRef.current = null;
      }
    };
  }, [conversationId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reconnect SSE when token or tenant changes
  useEffect(() => {
    if (conversationId && token) {
      connectSSE();
    }
  }, [token, tenantId]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    messages,
    isLoading,
    isConnected,
    error,
    sendMessage,
    markAsRead,
  };
}
