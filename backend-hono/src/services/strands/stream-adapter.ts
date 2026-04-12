// [claude-code 2026-04-05] Strands → UIMessageStream SSE adapter
// Encodes UIMessageStream events directly as SSE bytes in a single ReadableStream.
// Avoids pipeThrough(TransformStream) which causes ERR_INCOMPLETE_CHUNKED_ENCODING in Bun.
// SSE heartbeats every 8s keep the connection alive during long tool-call silences.
import type { Agent, ContentBlock } from "@strands-agents/sdk";
import { createLogger } from "../../lib/logger.js";
import type { HermesAgentId } from "../agent-bus/types.js";

const log = createLogger("StrandsStream");

/**
 * UIMessageStream event types expected by @assistant-ui/react
 */
type UIEvent =
  | { type: "start"; messageId: string }
  | { type: "start-step" }
  | { type: "text-start"; id: string }
  | { type: "text-delta"; id: string; delta: string }
  | { type: "text-end"; id: string }
  | { type: "reasoning-start"; id: string }
  | { type: "reasoning-delta"; id: string; delta: string }
  | { type: "reasoning-end"; id: string }
  | { type: "finish-step" }
  | { type: "finish"; finishReason: string }
  | { type: "error"; errorText: string };

const encoder = new TextEncoder();
const SSE_HEARTBEAT = encoder.encode(": heartbeat\n\n");
const SSE_DONE = encoder.encode("data: [DONE]\n\n");
const HEARTBEAT_INTERVAL_MS = 8_000;

/** Encode a UIEvent as an SSE `data:` line */
function sseEncode(event: UIEvent): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
}

/**
 * Stream a Strands agent response as SSE-encoded UIMessageStream bytes.
 * Single ReadableStream — no pipeThrough — for reliable chunked encoding in Bun.
 * Sends SSE comment heartbeats every 8s to prevent connection drops during tool calls.
 */
export function strandsToUIStream(
  agent: Agent,
  input: string | ContentBlock[],
  options?: {
    messageId?: string;
    onFinish?: (text: string) => Promise<void>;
    /** When set, each SSE event payload includes `agentId` for multi-stream merger labelling */
    agentId?: HermesAgentId;
  },
): ReadableStream<Uint8Array> {
  const messageId = options?.messageId ?? `msg-${Date.now()}`;
  const agentId = options?.agentId;
  let cancelled = false;

  return new ReadableStream<Uint8Array>({
    start(controller) {
      (async () => {
        let fullText = "";
        let stepCount = 0;
        let textStarted = false;
        let reasoningStarted = false;
        let reasoningEnded = false;
        let currentTextId = "";
        let currentReasoningId = "";
        let inToolPhase = false;

        // Heartbeat timer — keeps Bun/Chrome from dropping the connection during tool-call silences
        const heartbeat = setInterval(() => {
          if (!cancelled) {
            try {
              controller.enqueue(SSE_HEARTBEAT);
            } catch {
              /* stream already closed */
            }
          }
        }, HEARTBEAT_INTERVAL_MS);

        function emit(event: UIEvent) {
          // When agentId is set, stamp it onto the payload for multi-stream merger labelling
          const payload = agentId ? { ...event, agentId } : event;
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(payload)}\n\n`),
          );
        }

        function finish() {
          clearInterval(heartbeat);
          controller.enqueue(SSE_DONE);
          controller.close();
        }

        /** Close the current text block if open */
        function closeText() {
          if (textStarted) {
            emit({ type: "text-end", id: currentTextId });
            textStarted = false;
          }
        }

        /** Close the current reasoning block if open */
        function closeReasoning() {
          if (reasoningStarted && !reasoningEnded) {
            reasoningEnded = true;
            emit({ type: "reasoning-end", id: currentReasoningId });
          }
        }

        /** Close the current step (text + reasoning + finish-step) */
        function closeStep() {
          closeReasoning();
          closeText();
          if (stepCount > 0) {
            emit({ type: "finish-step" });
          }
        }

        /** Open a new step with fresh IDs */
        function openStep() {
          stepCount++;
          currentTextId = `text-${Date.now()}-${stepCount}`;
          currentReasoningId = `reasoning-${Date.now()}-${stepCount}`;
          textStarted = false;
          reasoningStarted = false;
          reasoningEnded = false;
          emit({ type: "start-step" });
        }

        // Protocol framing
        emit({ type: "start", messageId });
        openStep();

        try {
          for await (const event of agent.stream(input)) {
            if (cancelled) break;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const ev = event as any;

            if (ev.type === "modelStreamUpdateEvent" && ev.event) {
              const inner = ev.event;

              if (inner.type === "modelContentBlockDeltaEvent" && inner.delta) {
                const delta = inner.delta;

                if (delta.type === "textDelta" && delta.text) {
                  // If returning from a tool phase, close old step and open new one
                  if (inToolPhase) {
                    inToolPhase = false;
                    closeStep();
                    openStep();
                  }
                  // Close reasoning before first text in this step
                  closeReasoning();
                  if (!textStarted) {
                    textStarted = true;
                    emit({ type: "text-start", id: currentTextId });
                  }
                  fullText += delta.text;
                  emit({
                    type: "text-delta",
                    id: currentTextId,
                    delta: delta.text,
                  });
                } else if (
                  delta.type === "reasoningContentDelta" &&
                  delta.text
                ) {
                  if (!reasoningStarted) {
                    reasoningStarted = true;
                    emit({ type: "reasoning-start", id: currentReasoningId });
                  }
                  emit({
                    type: "reasoning-delta",
                    id: currentReasoningId,
                    delta: delta.text,
                  });
                }
              }
            } else if (ev.type === "toolResultEvent") {
              log.info("Tool result", { tool: ev.result?.toolName });
              inToolPhase = true;
            }
          }
        } catch (err) {
          const errorText = err instanceof Error ? err.message : String(err);
          log.error("Stream error", { error: errorText });

          closeStep();
          emit({ type: "error", errorText });
          emit({ type: "finish-step" });
          emit({ type: "finish", finishReason: "error" });

          if (!cancelled) {
            finish();
          }
          return;
        }

        // Clean close
        closeStep();
        emit({ type: "finish", finishReason: "stop" });

        if (options?.onFinish) {
          await options.onFinish(fullText);
        }

        if (!cancelled) {
          finish();
        }
      })().catch((error) => {
        log.error("Fatal stream error", { error: String(error) });
        clearInterval(0); // safety — interval ref is in enclosing scope
        try {
          controller.enqueue(
            sseEncode({
              type: "error",
              errorText: error instanceof Error ? error.message : String(error),
            }),
          );
          controller.enqueue(sseEncode({ type: "finish-step" }));
          controller.enqueue(
            sseEncode({ type: "finish", finishReason: "error" }),
          );
          controller.enqueue(SSE_DONE);
          controller.close();
        } catch {
          controller.error(error);
        }
      });
    },
    cancel() {
      cancelled = true;
    },
  });
}

/**
 * Wrap an SSE byte stream as a Response with correct headers.
 * The stream must already be SSE-encoded (data: ...\n\n).
 */
export function uiStreamToSSEResponse(
  stream: ReadableStream<Uint8Array>,
  headers?: Record<string, string>,
): Response {
  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "x-vercel-ai-ui-message-stream": "v1",
      ...headers,
    },
  });
}
