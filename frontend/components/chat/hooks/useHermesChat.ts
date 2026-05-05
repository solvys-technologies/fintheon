/**
 * useHermesChat Hook
 * Simple chat hook for Hermes AI processing
 */

// [claude-code 2026-05-03] S58 deploy fix: default Harper chat provider to DeepSeek, not VProxy/local.
// [claude-code 2026-05-03] S58-T2: route personal CAO DeepSeek providers through client SDK when configured.
// [claude-code 2026-05-04] S38-T5: removed deepseek-oc-api provider, updated provider routing for v2 dropdown.
// [claude-code 2026-04-18] Clear cached conversationId on 404 during hydration — otherwise Electron
//   boots with a stale localStorage UUID, useHermesChat logs "starting fresh", but the consumer
//   (FintheonComposer) still sees the old ID and fires /api/relay/dispatch → 404 → user reports
//   "relay button bugged". clearConversationId is now threaded through from useHermesRuntime.
// [claude-code 2026-03-28] S9-T4: Route harper-cao through /api/harper/chat for full Fintheon context injection
// [claude-code 2026-03-09] Added conversation history hydration on remount
import { useCallback, useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import { API_BASE_URL } from "../constants.js";
import { getAccessToken } from "../../../lib/supabase";
import {
  createDeepSeekStreamResponse,
  type DeepSeekChatMessage,
  type DeepSeekProvider,
} from "../../../lib/deepseek-sdk";

/** Convert backend ChatMessage -> UIMessage for useChat hydration */
function backendToUIMessage(msg: {
  id: string;
  role: string;
  content: string;
  createdAt?: string;
}): UIMessage {
  return {
    id: msg.id,
    role: msg.role as "user" | "assistant" | "system",
    parts: [{ type: "text" as const, text: msg.content }],
  };
}

// S38-T5: Only deepseek-direct uses the client SDK; nous + opencode-go route through backend
function isDeepSeekProvider(provider: string): provider is DeepSeekProvider {
  return provider === "deepseek-direct";
}

function readHarperProvider(): string {
  try {
    const saved = localStorage.getItem("fintheon:harper-provider");
    return saved && saved !== "local" && saved !== "orouter"
      ? saved
      : "deepseek-direct";
  } catch {
    return "deepseek-direct";
  }
}

function bodyToDeepSeekMessages(
  body: BodyInit | null | undefined,
): DeepSeekChatMessage[] {
  if (!body || typeof body !== "string") return [];
  const parsed = JSON.parse(body) as {
    message?: string;
    history?: Array<{ role?: string; content?: string }>;
  };
  const history = (parsed.history ?? [])
    .filter(
      (message): message is { role: "user" | "assistant"; content: string } =>
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string" &&
        message.content.trim().length > 0,
    )
    .map((message) => ({ role: message.role, content: message.content }));
  if (typeof parsed.message === "string" && parsed.message.trim()) {
    history.push({ role: "user", content: parsed.message });
  }
  return history;
}

export function useHermesChat(
  conversationId: string | undefined,
  setConversationId: (id: string) => void,
  agentOverride?: string,
  thinkHarder?: boolean,
  clearConversationId?: () => void,
) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  // [claude-code 2026-03-10] Track requestId from X-Request-Id header for cognition stream
  const [lastRequestId, setLastRequestId] = useState<string | null>(null);
  const hydratedRef = useRef<string | undefined>(undefined);
  // Abort controller ref — allows stop button to kill the active fetch
  const abortRef = useRef<AbortController | null>(null);
  // [claude-code 2026-03-13] Ref to avoid stale closure in DefaultChatTransport's prepareSendMessagesRequest
  const thinkHarderRef = useRef(thinkHarder);
  useEffect(() => {
    thinkHarderRef.current = thinkHarder;
  }, [thinkHarder]);

  // [claude-code 2026-04-06] Ref for conversationId to avoid stale closures in transport callbacks
  const conversationIdRef = useRef(conversationId);
  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  const fetchFn = useCallback(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      const fullUrl = url.startsWith("http") ? url : `${API_BASE_URL}${url}`;

      const headers = new Headers(init?.headers);
      headers.set("Content-Type", "application/json");

      // Attach Supabase JWT for backend auth
      const token = await getAccessToken();
      if (token) headers.set("Authorization", `Bearer ${token}`);

      // Attach GitHub OAuth token for GitHub Models (DeepSeek R1)
      const ghToken = localStorage.getItem("github_token");
      if (ghToken) headers.set("X-GitHub-Token", ghToken);

      // Use ref to get current conversationId (avoids stale closure in transport)
      const currentConvId = conversationIdRef.current;
      let body = init?.body;
      if (body && currentConvId) {
        try {
          const bodyObj = typeof body === "string" ? JSON.parse(body) : body;
          if (typeof bodyObj === "object" && bodyObj !== null) {
            bodyObj.conversationId = currentConvId;
            body = JSON.stringify(bodyObj);
          }
        } catch (e) {
          console.warn("[useHermesChat] Could not inject conversationId:", e);
        }
      }

      // [claude-code 2026-04-05] No timeout for Harper — Strands tool loops can run 10+ minutes
      const controller = new AbortController();
      abortRef.current = controller;
      const isHarper = agentOverride === "harper-cao";
      const timeoutMs = isHarper ? 0 : 120_000; // No timeout for Harper, 2min for others
      const timeoutId =
        timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null;

      try {
        const selectedProvider = readHarperProvider();
        if (isHarper && isDeepSeekProvider(selectedProvider)) {
          const messages = bodyToDeepSeekMessages(body);
          if (messages.length === 0) {
            throw new Error("No chat message supplied for DeepSeek.");
          }
          const result = await createDeepSeekStreamResponse(messages, {
            provider: selectedProvider,
            apiBaseUrl: API_BASE_URL,
            conversationId: conversationIdRef.current,
            getAccessToken,
            signal: controller.signal,
            title: messages[messages.length - 1]?.content.slice(0, 80),
          });
          if (timeoutId) clearTimeout(timeoutId);
          if (result.conversationId) setConversationId(result.conversationId);
          setLastError(null);
          return result.response;
        }

        const response = await fetch(fullUrl, {
          ...init,
          headers,
          body,
          signal: controller.signal,
        });
        if (timeoutId) clearTimeout(timeoutId);

        if (!response.ok) {
          let errText = `Chat request failed (${response.status})`;
          try {
            const json = await response.clone().json();
            if (json?.error) errText = String(json.error);
            else if (json?.message) errText = String(json.message);
          } catch {
            /* response may not be JSON */
          }
          setLastError(errText);
          throw new Error(errText);
        }

        setLastError(null);
        const convId = response.headers.get("X-Conversation-Id");
        if (convId) setConversationId(convId);
        const reqId = response.headers.get("X-Request-Id");
        if (reqId) setLastRequestId(reqId);

        return response;
      } catch (error) {
        if (timeoutId) clearTimeout(timeoutId);
        if (error instanceof DOMException && error.name === "AbortError") {
          // User-initiated stop — don't show error
          setIsStreaming(false);
          throw error;
        }
        if (
          !(error instanceof Error) ||
          !error.message.startsWith("Chat request failed")
        ) {
          setLastError(
            "Cannot reach chat backend (expected on localhost:8080).",
          );
        }
        throw error;
      }
    },
    [setConversationId],
  );

  // Harper routes through dedicated /api/harper/chat for full Fintheon context injection
  const isHarperRoute = agentOverride === "harper-cao";
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
    id: conversationId ?? "new",
    transport: new DefaultChatTransport({
      api: chatEndpoint,
      fetch: fetchFn,
      prepareSendMessagesRequest: ({ messages }) => {
        // Harper: extract last message + history for harper-handler format
        if (isHarperRoute) {
          const lastUserMsg = [...messages]
            .reverse()
            .find((m) => m.role === "user");
          const msgText =
            lastUserMsg?.parts
              ?.filter((p: any) => p.type === "text")
              .map((p: any) => p.text)
              .join("") || "";
          // Extract base64 image data URIs from the current message
          const images: string[] = (lastUserMsg?.parts ?? [])
            .filter(
              (p: any) =>
                (p.type === "image" && typeof p.image === "string") ||
                (p.type === "file" &&
                  typeof p.url === "string" &&
                  p.mediaType?.startsWith("image/")),
            )
            .map((p: any) => (p.image ?? p.url) as string);
          const history = messages.slice(0, -1).map((m) => ({
            role: m.role as "user" | "assistant",
            content:
              (m.parts ?? [])
                .filter((p: any) => p.type === "text")
                .map((p: any) => p.text)
                .join("") || "",
          }));
          // Read provider from localStorage (set by ProviderDropdown)
          const harperProvider = (() => {
            try {
              return readHarperProvider();
            } catch {
              return "deepseek-direct";
            }
          })();
          return {
            body: {
              message: msgText,
              ...(images.length > 0 && { images }),
              history,
              provider: harperProvider,
              ...(conversationIdRef.current && {
                conversationId: conversationIdRef.current,
              }),
              ...(thinkHarderRef.current && { thinkHarder: true }),
              userContext: (() => {
                try {
                  const get = (k: string) => {
                    try {
                      return JSON.parse(localStorage.getItem(k) ?? "null");
                    } catch {
                      return localStorage.getItem(k);
                    }
                  };
                  return {
                    traderName: get("traderName") || undefined,
                    selectedSymbol: get("selectedSymbol") || undefined,
                    tradingGoals: get("tradingGoals") || undefined,
                    instrumentsTraded: get("instrumentsTraded") || undefined,
                    riskSettings: get("riskSettings") || undefined,
                  };
                } catch {
                  return {};
                }
              })(),
              activeConnectors: (() => {
                try {
                  const base: string[] = JSON.parse(
                    localStorage.getItem("fintheon:mcp-active-connectors") ??
                      "[]",
                  );
                  // [S23-T3] Auto-append "aquarium" when the user is on the Aquarium surface
                  // so Harper receives the latest AgentDesk context without manual toggling.
                  const surface = localStorage.getItem(
                    "fintheon:current-surface",
                  );
                  if (surface === "aquarium" && !base.includes("aquarium")) {
                    return [...base, "aquarium"];
                  }
                  return base;
                } catch {
                  return [];
                }
              })(),
              surface: (() => {
                try {
                  return (
                    localStorage.getItem("fintheon:current-surface") ??
                    undefined
                  );
                } catch {
                  return undefined;
                }
              })(),
            },
          };
        }

        // Standard Hermes/OpenRouter path
        return {
          body: {
            messages: messages.map((msg) => {
              const parts = msg.parts ?? [];
              const isImagePart = (p: any) =>
                (p.type === "image" && typeof p.image === "string") ||
                (p.type === "file" &&
                  typeof p.url === "string" &&
                  p.mediaType?.startsWith("image/"));
              const hasImages = parts.some(isImagePart);
              if (hasImages) {
                const contentParts = parts
                  .filter((p: any) => p.type === "text" || isImagePart(p))
                  .map((p: any) =>
                    p.type === "text"
                      ? { type: "text" as const, text: p.text }
                      : {
                          type: "image_url" as const,
                          image_url: { url: p.image ?? p.url },
                        },
                  );
                return { role: msg.role, content: contentParts };
              }
              return {
                role: msg.role,
                content:
                  parts
                    .filter((p: any) => p.type === "text")
                    .map((p: any) => p.text)
                    .join("") || "",
              };
            }),
            ...(conversationId && { conversationId }),
            ...(agentOverride && { agentOverride }),
            ...(thinkHarderRef.current && { thinkHarder: true }),
            mcpServers: (() => {
              try {
                return JSON.parse(
                  localStorage.getItem("fintheon:mcp-active-connectors") ??
                    "[]",
                );
              } catch {
                return [];
              }
            })(),
            // [S23-T3] Surface flag so Hermes handlers can auto-inject Aquarium context.
            surface: (() => {
              try {
                return (
                  localStorage.getItem("fintheon:current-surface") ?? undefined
                );
              } catch {
                return undefined;
              }
            })(),
          },
        };
      },
    }),
    onFinish: () => setIsStreaming(false),
    onError: (error) => {
      setIsStreaming(false);
      if (!lastError) {
        const msg =
          error instanceof Error ? error.message : "Chat request failed";
        // Replace browser-level network errors with a friendlier message
        if (/failed to fetch|networkerror|load failed/i.test(msg)) {
          setLastError(
            "Backend unavailable — run `fintheon start` in Terminal",
          );
        } else {
          setLastError(msg);
        }
      }
    },
  });

  // [claude-code 2026-04-10] Hydrate messages when conversationId changes (session switch or remount)
  useEffect(() => {
    console.debug("[useHermesChat] Hydration effect fired", {
      conversationId,
      hydrated: hydratedRef.current,
    });
    if (!conversationId || hydratedRef.current === conversationId) {
      console.debug(
        "[useHermesChat] Skipping hydration — already hydrated or no ID",
      );
      return;
    }

    let cancelled = false;

    // Clear existing messages so the new session loads fresh
    setUseChatMessages([]);
    // Reset hydrated ref so useChat with new id starts clean
    hydratedRef.current = undefined;

    (async () => {
      try {
        const token = await getAccessToken();
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;
        console.debug("[useHermesChat] Fetching conversation", conversationId);
        const res = await fetch(
          `${API_BASE_URL}/api/ai/conversations/${conversationId}`,
          { headers },
        );
        if (cancelled) return;
        if (!res.ok) {
          console.warn(
            `[useHermesChat] Conversation ${conversationId} not found (${res.status}) — starting fresh`,
          );
          // [claude-code 2026-04-18] Clear the stale cached ID so downstream consumers
          // (FintheonComposer relay dispatch, session list, hydration effect) don't keep
          // firing requests against a conversation that no longer exists. If the clear
          // function wasn't threaded, at least stamp hydratedRef so we don't loop.
          if (clearConversationId) {
            clearConversationId();
          } else {
            hydratedRef.current = conversationId;
          }
          return;
        }
        const data = await res.json();
        const msgs: UIMessage[] = (data.messages ?? [])
          .filter((m: any) => m.role === "user" || m.role === "assistant")
          .map(backendToUIMessage);
        console.debug(
          "[useHermesChat] Hydrated",
          msgs.length,
          "messages for",
          conversationId,
        );
        if (!cancelled) {
          setUseChatMessages(msgs);
          hydratedRef.current = conversationId;
        }
      } catch (err) {
        console.error("[useHermesChat] Conversation hydration failed:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [conversationId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Hard stop: abort the fetch AND tell useChat to stop processing
  const hardStop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    stop();
    setIsStreaming(false);
  }, [stop]);

  return {
    messages: useChatMessages,
    sendMessage,
    status,
    setMessages: setUseChatMessages,
    isLoading: isStreaming || status === "streaming" || status === "submitted",
    setIsStreaming,
    stop: hardStop,
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
