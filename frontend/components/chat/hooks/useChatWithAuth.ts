/**
 * useChatWithAuth Hook
 * Simplified for local single-user mode - no authentication
 */

import { useCallback, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { API_BASE_URL } from '../constants.js';

export function useChatWithAuth(conversationId: string | undefined, setConversationId: (id: string) => void) {
  const [isStreaming, setIsStreaming] = useState(false);

  const fetchWithAuth = useCallback(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;

    const headers = new Headers(init?.headers);
    headers.set('Content-Type', 'application/json');
    // No auth header needed in local mode

    let body = init?.body;
    if (body && conversationId) {
      try {
        const bodyObj = typeof body === 'string' ? JSON.parse(body) : body;
        if (typeof bodyObj === 'object' && bodyObj !== null) {
          bodyObj.conversationId = conversationId;
          body = JSON.stringify(bodyObj);
        }
      } catch (e) {
        // Ignore parse errors
      }
    }

    const response = await fetch(fullUrl, {
      ...init,
      headers,
      body,
    });

    const convId = response.headers.get('X-Conversation-Id');
    if (convId) {
      setConversationId(convId);
    }

    return response;
  }, [conversationId, setConversationId]);

  const {
    messages: useChatMessages,
    sendMessage,
    status,
    setMessages: setUseChatMessages,
    stop,
  } = useChat({
    transport: new DefaultChatTransport({
      api: `${API_BASE_URL}/api/ai/chat`,
      fetch: fetchWithAuth,
      prepareSendMessagesRequest: ({ messages, id }) => {
        return {
          body: {
            messages: messages.map((msg) => ({
              role: msg.role,
              content: msg.parts
                ?.filter((part: any) => part.type === 'text')
                .map((part: any) => part.text)
                .join('') || '',
            })),
            ...(conversationId && { conversationId }),
          },
        };
      },
    }),
    onFinish: () => {
      setIsStreaming(false);
    },
    onError: () => {
      setIsStreaming(false);
    },
  });

  const isLoading = isStreaming || status === 'streaming' || status === 'submitted';

  return {
    messages: useChatMessages,
    sendMessage,
    status,
    setMessages: setUseChatMessages,
    isLoading,
    setIsStreaming,
    stop,
  };
}
