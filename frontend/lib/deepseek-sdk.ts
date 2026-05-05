// [claude-code 2026-05-03] S58-T2: shared client-side DeepSeek transport for desktop, web, mobile, and Electron.

// S38-T5: deepseek-direct is primary; opencode-go path retained for callers.
export type DeepSeekProvider = "deepseek-direct" | "deepseek-oc-api";

export interface DeepSeekKeyStatus {
  provider: string;
  hasKey: boolean;
  maskedKey?: string | null;
}

export interface DeepSeekChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface DeepSeekChatOptions {
  provider: DeepSeekProvider;
  apiBaseUrl?: string;
  conversationId?: string | null;
  getAccessToken?: () => Promise<string | null>;
  signal?: AbortSignal;
  model?: string;
  title?: string;
}

export interface DeepSeekStreamResult {
  response: Response;
  conversationId: string | null;
}

const DEFAULT_BACKEND_BASE =
  import.meta.env.VITE_API_URL || "http://localhost:8080";
const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";
const DEFAULT_MODEL = "deepseek-reasoner";
const encoder = new TextEncoder();

function normalizeBackendBase(apiBaseUrl?: string) {
  return (apiBaseUrl ?? DEFAULT_BACKEND_BASE).replace(/\/$/, "");
}

async function authHeaders(getAccessToken?: () => Promise<string | null>) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const token = getAccessToken ? await getAccessToken() : null;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function readKeyFromPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as Record<string, unknown>;
  const candidates = [data.apiKey, data.key, data.decryptedKey, data.value];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim())
      return candidate.trim();
  }
  if (Array.isArray(data.keys)) {
    const first = data.keys.find(
      (item) => item && typeof item === "object" && "apiKey" in item,
    ) as Record<string, unknown> | undefined;
    if (typeof first?.apiKey === "string") return first.apiKey;
  }
  return null;
}

export async function fetchUserApiKey(
  provider: string,
  options?: {
    apiBaseUrl?: string;
    getAccessToken?: () => Promise<string | null>;
  },
): Promise<string | null> {
  const base = normalizeBackendBase(options?.apiBaseUrl);
  const headers = await authHeaders(options?.getAccessToken);
  const res = await fetch(
    `${base}/api/settings/ai-keys?provider=${encodeURIComponent(provider)}`,
    { headers },
  ).catch(() => null);
  if (!res?.ok) return null;
  return readKeyFromPayload(await res.json().catch(() => null));
}

export async function fetchDeepSeekKey(options?: {
  apiBaseUrl?: string;
  getAccessToken?: () => Promise<string | null>;
}): Promise<string | null> {
  return fetchUserApiKey("deepseek", options);
}

export async function fetchOpenCodeGoSettings(options?: {
  apiBaseUrl?: string;
  getAccessToken?: () => Promise<string | null>;
}): Promise<{ apiKey: string; baseUrl: string } | null> {
  const base = normalizeBackendBase(options?.apiBaseUrl);
  const headers = await authHeaders(options?.getAccessToken);
  const res = await fetch(`${base}/api/settings/ai-keys?provider=opencode-go`, {
    headers,
  }).catch(() => null);
  if (!res?.ok) return null;
  const payload = (await res.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const apiKey = readKeyFromPayload(payload);
  const baseUrl =
    typeof payload?.baseUrl === "string"
      ? payload.baseUrl
      : typeof payload?.apiUrl === "string"
        ? payload.apiUrl
        : typeof payload?.url === "string"
          ? payload.url
          : null;
  if (!apiKey || !baseUrl) return null;
  return { apiKey, baseUrl: baseUrl.replace(/\/$/, "") };
}

export async function createConversationIfNeeded(options: {
  apiBaseUrl?: string;
  conversationId?: string | null;
  title?: string;
  getAccessToken?: () => Promise<string | null>;
}): Promise<string | null> {
  if (options.conversationId) return options.conversationId;
  const base = normalizeBackendBase(options.apiBaseUrl);
  const headers = await authHeaders(options.getAccessToken);
  const res = await fetch(`${base}/api/ai/conversations`, {
    method: "POST",
    headers,
    body: JSON.stringify({ title: options.title ?? "DeepSeek Direct" }),
  }).catch(() => null);
  if (!res?.ok) return null;
  const data = (await res.json().catch(() => null)) as { id?: string } | null;
  return data?.id ?? null;
}

export async function persistConversationMessage(options: {
  apiBaseUrl?: string;
  conversationId: string | null;
  role: "user" | "assistant";
  content: string;
  getAccessToken?: () => Promise<string | null>;
}): Promise<void> {
  if (!options.conversationId || !options.content.trim()) return;
  const base = normalizeBackendBase(options.apiBaseUrl);
  const headers = await authHeaders(options.getAccessToken);
  await fetch(
    `${base}/api/ai/conversations/${options.conversationId}/messages`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        role: options.role,
        content: options.content,
        model: DEFAULT_MODEL,
        metadata: { source: "client-deepseek-sdk" },
      }),
    },
  ).catch(() => undefined);
}

export async function* streamDeepSeekResponse(
  response: Response,
): AsyncGenerator<string> {
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";
    for (const chunk of chunks) {
      const line = chunk
        .split("\n")
        .find((entry) => entry.trim().startsWith("data:"));
      if (!line) continue;
      const payload = line.replace(/^data:\s*/, "").trim();
      if (!payload || payload === "[DONE]") continue;
      const json = JSON.parse(payload) as {
        choices?: Array<{
          delta?: { content?: string };
          message?: { content?: string };
        }>;
      };
      const delta =
        json.choices?.[0]?.delta?.content ??
        json.choices?.[0]?.message?.content;
      if (delta) yield delta;
    }
  }
}

async function postChatCompletion(
  messages: DeepSeekChatMessage[],
  options: DeepSeekChatOptions,
): Promise<Response> {
  if (options.provider === "deepseek-oc-api") {
    const settings = await fetchOpenCodeGoSettings(options);
    if (!settings) throw new Error("Configure OpenCode Go API in Settings.");
    return fetch(`${settings.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: options.model ?? DEFAULT_MODEL,
        messages,
        stream: true,
      }),
      signal: options.signal,
    });
  }

  const apiKey = await fetchDeepSeekKey(options);
  if (!apiKey)
    throw new Error("No DeepSeek API key set. Add one in Settings -> API.");
  return fetch(DEEPSEEK_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: options.model ?? DEFAULT_MODEL,
      messages,
      stream: true,
    }),
    signal: options.signal,
  });
}

function sse(event: Record<string, unknown>) {
  return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
}

export async function createDeepSeekStreamResponse(
  messages: DeepSeekChatMessage[],
  options: DeepSeekChatOptions,
): Promise<DeepSeekStreamResult> {
  const conversationId = await createConversationIfNeeded(options);
  const lastUser = [...messages]
    .reverse()
    .find((message) => message.role === "user");
  await persistConversationMessage({
    ...options,
    conversationId,
    role: "user",
    content: lastUser?.content ?? "",
  });

  const upstream = await postChatCompletion(messages, options);
  if (!upstream.ok) {
    const text = await upstream.text().catch(() => upstream.statusText);
    throw new Error(text || `DeepSeek request failed (${upstream.status})`);
  }

  const messageId = `deepseek-${Date.now()}`;
  const textId = `txt-${Date.now()}`;
  let assistantText = "";
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(sse({ type: "start", messageId }));
      controller.enqueue(sse({ type: "start-step" }));
      controller.enqueue(sse({ type: "text-start", id: textId }));
      try {
        for await (const delta of streamDeepSeekResponse(upstream)) {
          assistantText += delta;
          controller.enqueue(sse({ type: "text-delta", id: textId, delta }));
        }
        controller.enqueue(sse({ type: "text-end", id: textId }));
        controller.enqueue(sse({ type: "finish-step" }));
        controller.enqueue(sse({ type: "finish", finishReason: "stop" }));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (error) {
        const errorText =
          error instanceof Error ? error.message : "DeepSeek stream failed";
        controller.enqueue(sse({ type: "error", errorText }));
        controller.enqueue(sse({ type: "finish", finishReason: "error" }));
      } finally {
        await persistConversationMessage({
          ...options,
          conversationId,
          role: "assistant",
          content: assistantText,
        });
        controller.close();
      }
    },
  });

  const headers = new Headers({ "Content-Type": "text/event-stream" });
  if (conversationId) headers.set("X-Conversation-Id", conversationId);
  return { response: new Response(stream, { headers }), conversationId };
}

export async function deepseekChatCompletion(
  messages: DeepSeekChatMessage[],
  options: Omit<DeepSeekChatOptions, "provider"> = {},
): Promise<DeepSeekStreamResult> {
  return createDeepSeekStreamResponse(messages, {
    ...options,
    provider: "deepseek-direct",
  });
}

export async function opencodeGoChatCompletion(
  messages: DeepSeekChatMessage[],
  options: Omit<DeepSeekChatOptions, "provider"> = {},
): Promise<DeepSeekStreamResult> {
  return createDeepSeekStreamResponse(messages, {
    ...options,
    provider: "deepseek-oc-api",
  });
}

export function createDeepSeekTransport(provider: DeepSeekProvider) {
  return { provider, createResponse: createDeepSeekStreamResponse };
}
