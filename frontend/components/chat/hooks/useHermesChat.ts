/**
 * useHermesChat Hook
 * Simple chat hook for Hermes AI processing
 */

// [claude-code 2026-03-28] S9-T4: Route harper-cao through /api/harper/chat for full Fintheon context injection
// [claude-code 2026-03-09] Added conversation history hydration on remount
import { useCallback, useEffect, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { UIMessage } from 'ai';
import { API_BASE_URL } from '../constants.js';
import { getAccessToken } from '../../../lib/supabase';

/** Convert backend ChatMessage -> UIMessage for useChat hydration */
function backendToUIMessage(msg: { id: string; role: string; content: string; createdAt?: string }): UIMessage {
  return {
    id: msg.id,
    role: msg.role as 'user' | 'assistant' | 'system',
    parts: [{ type: 'text' as const, text: msg.content }],
  };
}

export function useHermesChat(
  conversationId: string | undefined,
  setConversationId: (id: string) => void,
  agentOverride?: string,
  thinkHarder?: boolean
) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  // [claude-code 2026-03-10] Track requestId from X-Request-Id header for cognition stream
  const [lastRequestId, setLastRequestId] = useState<string | null>(null);
  const hydratedRef = useRef<string | undefined>(undefined);
  // [claude-code 2026-03-13] Ref to avoid stale closure in DefaultChatTransport's prepareSendMessagesRequest
  const thinkHarderRef = useRef(thinkHarder);
  useEffect(() => { thinkHarderRef.current = thinkHarder; }, [thinkHarder]);

  // [claude-code 2026-04-06] Ref for conversationId to avoid stale closures in transport callbacks
  const conversationIdRef = useRef(conversationId);
  useEffect(() => { conversationIdRef.current = conversationId; }, [conversationId]);

  const fetchFn = useCallback(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;

    const headers = new Headers(init?.headers);
    headers.set('Content-Type', 'application/json');

    // Attach Supabase JWT for backend auth
    const token = await getAccessToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);

    // Attach GitHub OAuth token for GitHub Models (DeepSeek R1)
    const ghToken = localStorage.getItem('github_token');
    if (ghToken) headers.set('X-GitHub-Token', ghToken);

    // Use ref to get current conversationId (avoids stale closure in transport)
    const currentConvId = conversationIdRef.current;
    let body = init?.body;
    if (body && currentConvId) {
      try {
        const bodyObj = typeof body === 'string' ? JSON.parse(body) : body;
        if (typeof bodyObj === 'object' && bodyObj !== null) {
          bodyObj.conversationId = currentConvId;
          body = JSON.stringify(bodyObj);
        }
      } catch (e) {
        console.warn('[useHermesChat] Could not inject conversationId:', e);
      }
    }

    // [claude-code 2026-04-05] No timeout for Harper — Strands tool loops can run 10+ minutes
    const controller = new AbortController();
    const isHarper = agentOverride === 'harper-cao';
    const timeoutMs = isHarper ? 0 : 120_000; // No timeout for Harper, 2min for others
    const timeoutId = timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null;

    try {
      const response = await fetch(fullUrl, { ...init, headers, body, signal: controller.signal });
      if (timeoutId) clearTimeout(timeoutId);

      if (!response.ok) {
        let errText = `Chat request failed (${response.status})`;
        try {
          const json = await response.clone().json();
          if (json?.error) errText = String(json.error);
          else if (json?.message) errText = String(json.message);
        } catch { /* response may not be JSON */ }
        setLastError(errText);
        throw new Error(errText);
      }

      setLastError(null);
      const convId = response.headers.get('X-Conversation-Id');
      if (convId) setConversationId(convId);
      const reqId = response.headers.get('X-Request-Id');
      if (reqId) setLastRequestId(reqId);

      return response;
    } catch (error) {
      if (timeoutId) clearTimeout(timeoutId);
      if (error instanceof DOMException && error.name === 'AbortError') {
        setLastError('Request timed out — please try again.');
        throw error;
      }
      if (!(error instanceof Error) || !error.message.startsWith('Chat request failed')) {
        setLastError('Cannot reach chat backend (expected on localhost:8080).');
      }
      throw error;
    }
  }, [setConversationId]);

  // Harper-Opus routes through dedicated /api/harper/chat for full Fintheon context injection
  const isHarperRoute = agentOverride === 'harper-cao';
  const chatEndpoint = isHarperRoute
    ? `${API_BASE_URL}/api/harper/chat`
    : `${API_BASE_URL}/api/ai/chat`;

  const {
    messages: useChatMessages,
    sendMessage,
    status,
    setMessages: setUseChatMessages,
    stop,
    regenerate,
    resumeStream,
    addToolResult,
    addToolOutput,
    addToolApprovalResponse,
  } = useChat({
    transport: new DefaultChatTransport({
      api: chatEndpoint,
      fetch: fetchFn,
      prepareSendMessagesRequest: ({ messages }) => {
        // Harper-Opus: extract last message + history for harper-handler format
        if (isHarperRoute) {
          const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
          const msgText = lastUserMsg?.parts
            ?.filter((p: any) => p.type === 'text')
            .map((p: any) => p.text)
            .join('') || '';
          const history = messages.slice(0, -1).map(m => ({
            role: m.role as 'user' | 'assistant',
            content: (m.parts ?? [])
              .filter((p: any) => p.type === 'text')
              .map((p: any) => p.text)
              .join('') || '',
          }));
          return {
            body: {
              message: msgText,
              history,
              ...(conversationIdRef.current && { conversationId: conversationIdRef.current }),
              ...(thinkHarderRef.current && { thinkHarder: true }),
              userContext: (() => {
                try {
                  const get = (k: string) => { try { return JSON.parse(localStorage.getItem(k) ?? 'null'); } catch { return localStorage.getItem(k); } };
                  return {
                    traderName: get('traderName') || undefined,
                    selectedSymbol: get('selectedSymbol') || undefined,
                    tradingGoals: get('tradingGoals') || undefined,
                    instrumentsTraded: get('instrumentsTraded') || undefined,
                    riskSettings: get('riskSettings') || undefined,
                  };
                } catch { return {}; }
              })(),
              activeConnectors: (() => {
                try { return JSON.parse(localStorage.getItem('fintheon:mcp-active-connectors') ?? '[]'); }
                catch { return []; }
              })(),
            },
          };
        }

        // Standard Hermes/OpenRouter path
        return {
          body: {
            messages: messages.map((msg) => {
              const parts = msg.parts ?? [];
              const hasImages = parts.some((p: any) => p.type === 'image');
              if (hasImages) {
                const contentParts = parts
                  .filter((p: any) => p.type === 'text' || p.type === 'image')
                  .map((p: any) =>
                    p.type === 'text'
                      ? { type: 'text' as const, text: p.text }
                      : { type: 'image_url' as const, image_url: { url: p.image } }
                  );
                return { role: msg.role, content: contentParts };
              }
              return {
                role: msg.role,
                content: parts.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('') || '',
              };
            }),
            ...(conversationId && { conversationId }),
            ...(agentOverride && { agentOverride }),
            ...(thinkHarderRef.current && { thinkHarder: true }),
            mcpServers: (() => {
              try { return JSON.parse(localStorage.getItem('fintheon:mcp-active-connectors') ?? '[]'); }
              catch { return []; }
            })(),
          },
        };
      },
    }),
    onFinish: () => setIsStreaming(false),
    onError: (error) => {
      setIsStreaming(false);
      if (!lastError) {
        const msg = error instanceof Error ? error.message : 'Chat request failed';
        // Replace browser-level network errors with a friendlier message
        if (/failed to fetch|networkerror|load failed/i.test(msg)) {
          setLastError('Backend unavailable — start it with `cd backend-hono && bun run dev`');
        } else {
          setLastError(msg);
        }
      }
    },
  });

  // [claude-code 2026-04-05] Hydrate messages when conversationId changes (session switch or remount)
  useEffect(() => {
    if (!conversationId || hydratedRef.current === conversationId) return;

    let cancelled = false;
    hydratedRef.current = conversationId;

    // Clear existing messages so the new session loads fresh
    setUseChatMessages([]);

    (async () => {
      try {
        const token = await getAccessToken();
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const res = await fetch(`${API_BASE_URL}/api/ai/conversations/${conversationId}`, { headers });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const msgs: UIMessage[] = (data.messages ?? [])
          .filter((m: any) => m.role === 'user' || m.role === 'assistant')
          .map(backendToUIMessage);
        if (!cancelled && msgs.length > 0) {
          setUseChatMessages(msgs);
        }
      } catch {
        // Backend unreachable — start with fresh thread, no error shown
      }
    })();

    return () => { cancelled = true; };
  }, [conversationId]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    messages: useChatMessages,
    sendMessage,
    status,
    setMessages: setUseChatMessages,
    isLoading: isStreaming || status === 'streaming' || status === 'submitted',
    setIsStreaming,
    stop,
    regenerate,
    resumeStream,
    addToolResult,
    addToolOutput,
    addToolApprovalResponse,
    lastError,
    clearError: () => setLastError(null),
    lastRequestId,
  };
}
