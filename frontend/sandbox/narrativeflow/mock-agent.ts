import {
  buildAssistantText,
  buildCognitionSteps,
  resolveMockNarrativeApproval,
  type CognitionStep,
} from "./mock-agent-toolkit";

interface MockAgentRequest {
  path: string;
  method: string;
  body: Record<string, unknown> | null;
}

interface MockMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

const cognitionStepsByRequest = new Map<string, CognitionStep[]>();
const conversations = new Map<string, MockMessage[]>();

export function handleMockAgentRequest(request: MockAgentRequest) {
  if (request.path === "/api/ai/skills") return json({ skills: [] });
  if (request.path === "/api/mcp") return json({ servers: [] });
  if (request.path.startsWith("/api/mcp/") && request.method === "PATCH") {
    return json({ ok: true });
  }
  if (
    request.path.startsWith("/api/ai/conversations/") &&
    request.method === "GET"
  ) {
    const id = decodeURIComponent(request.path.split("/").pop() ?? "");
    return json({ id, messages: conversations.get(id) ?? [] });
  }
  if (request.path === "/api/harper/chat" && request.method === "POST") {
    return handleMockHarperChat(request.body ?? {});
  }
  const approvalMatch = request.path.match(
    /^\/api\/harper\/ui-actions\/([^/]+)\/answer$/,
  );
  if (approvalMatch) {
    const result = resolveMockNarrativeApproval(approvalMatch[1], request.body);
    return json(result, result.status);
  }
  return null;
}

export function createNarrativeFlowMockEventSource() {
  return function MockEventSource(url: string) {
    const listeners = new Map<string, EventListener[]>();
    const timers: number[] = [];
    const source = {
      url,
      readyState: 1,
      withCredentials: false,
      onopen: null as ((event: Event) => void) | null,
      onmessage: null as ((event: MessageEvent) => void) | null,
      onerror: null as ((event: Event) => void) | null,
      addEventListener(type: string, listener: EventListener) {
        listeners.set(type, [...(listeners.get(type) ?? []), listener]);
      },
      removeEventListener(type: string, listener: EventListener) {
        listeners.set(
          type,
          (listeners.get(type) ?? []).filter((item) => item !== listener),
        );
      },
      dispatchEvent(event: Event) {
        fire(event);
        return true;
      },
      close() {
        source.readyState = 2;
        timers.forEach((timer) => window.clearTimeout(timer));
      },
    };

    function fire(event: Event) {
      if (event.type === "open") source.onopen?.(event);
      if (event.type === "message") source.onmessage?.(event as MessageEvent);
      (listeners.get(event.type) ?? []).forEach((listener) => listener(event));
    }

    timers.push(window.setTimeout(() => fire(new Event("open")), 0));
    const requestId = new URL(url, window.location.href).searchParams.get(
      "requestId",
    );
    if (requestId) {
      const steps = cognitionStepsByRequest.get(requestId) ?? [];
      steps.forEach((step, index) => {
        timers.push(
          window.setTimeout(
            () => {
              fire(new MessageEvent("step", { data: JSON.stringify(step) }));
            },
            180 + index * 260,
          ),
        );
      });
      timers.push(
        window.setTimeout(
          () => {
            fire(new MessageEvent("done", { data: "{}" }));
            source.close();
          },
          260 + steps.length * 260,
        ),
      );
    }

    return source;
  } as unknown as typeof EventSource;
}

function handleMockHarperChat(body: Record<string, unknown>) {
  const message = stringValue(body.message) ?? "Build the narrative.";
  const workspace = isRecord(body.workspace) ? body.workspace : null;
  const workspaceId = stringValue(workspace?.id);
  const workspaceTitle =
    stringValue(workspace?.title) ?? "NarrativeFlow workspace";
  const conversationId =
    stringValue(body.conversationId) ??
    `narrativeflow-sandbox-conversation-${Date.now().toString(36)}`;
  const requestId = `narrativeflow-sandbox-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const assistantText = buildAssistantText({ workspaceTitle });

  cognitionStepsByRequest.set(
    requestId,
    buildCognitionSteps({
      requestId,
      workspaceId,
      workspaceTitle,
    }),
  );
  conversations.set(conversationId, [
    ...(conversations.get(conversationId) ?? []),
    {
      id: `${requestId}-u`,
      role: "user",
      content: message,
      createdAt: new Date().toISOString(),
    },
    {
      id: `${requestId}-a`,
      role: "assistant",
      content: assistantText,
      createdAt: new Date().toISOString(),
    },
  ]);

  return uiStreamResponse(assistantText, {
    "X-Conversation-Id": conversationId,
    "X-Request-Id": requestId,
    "X-Hermes-Agent": "harper",
  });
}

function uiStreamResponse(text: string, headers: Record<string, string>) {
  const encoder = new TextEncoder();
  const id = `text-${Date.now()}`;
  const chunks = text.match(/.{1,96}(\s|$)/g) ?? [text];
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: Record<string, unknown>) =>
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
        );
      send({ type: "start", messageId: `harper-${Date.now()}` });
      send({ type: "start-step" });
      send({ type: "text-start", id });
      chunks.forEach((chunk) => send({ type: "text-delta", id, delta: chunk }));
      send({ type: "text-end", id });
      send({ type: "finish-step" });
      send({ type: "finish", finishReason: "stop" });
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "x-vercel-ai-ui-message-stream": "v1",
      "Access-Control-Expose-Headers":
        "X-Conversation-Id, X-Request-Id, X-Hermes-Agent",
      ...headers,
    },
  });
}

function json(data: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
