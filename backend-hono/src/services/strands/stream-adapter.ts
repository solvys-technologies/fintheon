// [claude-code 2026-04-25] S42-T1: extend UIEvent with thinking/tool_call/citation/artifact/complete; wire emission of thinking + tool_call + complete (additive, backwards-compatible)
// [claude-code 2026-04-05] Strands → UIMessageStream SSE adapter
// Encodes UIMessageStream events directly as SSE bytes in a single ReadableStream.
// Avoids pipeThrough(TransformStream) which causes ERR_INCOMPLETE_CHUNKED_ENCODING in Bun.
// SSE heartbeats every 8s keep the connection alive during long tool-call silences.
import type { Agent, ContentBlock } from "@strands-agents/sdk";
import { createLogger } from "../../lib/logger.js";
import type { HermesAgentId } from "../agent-bus/types.js";

const log = createLogger("StrandsStream");

/**
 * UIMessageStream event types expected by @assistant-ui/react.
 *
 * [S42-T1] The variants below `error` are additive Fintheon extensions.
 * Frontend consumers ignore unknown event types until the matching track wires them up:
 *   thinking   — reasoning-token stream for the thinking-trace surface (T3)
 *   tool_call  — tool-use lifecycle pill with running/done/failed status (T3)
 *   citation   — RiskFlow / SEC fetcher / Arbitrum source chip (T3)
 *   artifact   — out-of-band payload for TradingView / Browserbase / report cards (T4)
 *   complete   — message footer with latency_ms / source_count / model / token counts (T2)
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
  | { type: "error"; errorText: string }
  | { type: "thinking"; token: string }
  | {
      type: "tool_call";
      id: string;
      name: string;
      status: "pending" | "running" | "done" | "failed";
      duration_ms?: number;
    }
  | {
      type: "citation";
      id: number;
      source: string;
      url?: string;
      snippet?: string;
    }
  | {
      type: "artifact";
      kind: "tradingview" | "browserbase" | "report" | "citation";
      payload: Record<string, unknown>;
    }
  | {
      type: "complete";
      latency_ms?: number;
      source_count?: number;
      model?: string;
      prompt_tokens?: number;
      completion_tokens?: number;
    };

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
    /** [S42-T1] Surfaces in the `complete` event footer */
    model?: string;
    /** [S42-T1] Number of citation sources injected into the prompt this turn */
    sourceCount?: number;
  },
): ReadableStream<Uint8Array> {
  const messageId = options?.messageId ?? `msg-${Date.now()}`;
  const agentId = options?.agentId;
  const model = options?.model;
  const sourceCount = options?.sourceCount;
  let cancelled = false;

  return new ReadableStream<Uint8Array>({
    start(controller) {
      (async () => {
        const startTime = Date.now();
        let fullText = "";
        let stepCount = 0;
        let textStarted = false;
        let reasoningStarted = false;
        let reasoningEnded = false;
        let currentTextId = "";
        let currentReasoningId = "";
        let inToolPhase = false;
        let promptTokens: number | undefined;
        let completionTokens: number | undefined;
        // [S42-T1] Track open tool_call lifecycles so we can pair start→done with duration_ms
        const toolStarts = new Map<string, { name: string; startedAt: number }>();

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

        // [claude-code 2026-04-26] v5.29.4 hotfix: assistant-ui v6's custom-data
        // wire format is `{type: "data-X", id?, data: {...}}` — extra top-level
        // keys are rejected as unrecognized_keys even on the `custom` arm.
        // v5.29.2 only renamed the type and left latency_ms/model as flat keys
        // which still failed Zod. We now (a) rename T1 types to data-* (b) move
        // every non-{type,id} field under `data` so the SDK accepts them as
        // data parts and routes them to message.parts as { type: "data-foo",
        // data: ... }.
        const T1_TYPES = new Set([
          "thinking",
          "tool_call",
          "citation",
          "artifact",
          "complete",
        ]);

        function emit(event: UIEvent) {
          const e = event as Record<string, unknown> & { type: string };
          const isT1 = T1_TYPES.has(e.type);
          let safeEvent: Record<string, unknown>;
          if (isT1) {
            const { type, id, ...rest } = e;
            safeEvent = {
              type: `data-${type}`,
              ...(typeof id === "string" ? { id } : {}),
              data: rest,
            };
          } else {
            safeEvent = e;
          }
          // When agentId is set, stamp it onto the payload for multi-stream merger labelling
          const payload = agentId ? { ...safeEvent, agentId } : safeEvent;
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
                  // [S42-T1] Mirror provider reasoning tokens onto the new
                  // `thinking` channel so T3 can render the thinking trace
                  // without coupling to the legacy reasoning-* events.
                  emit({ type: "thinking", token: delta.text });
                }
              } else if (
                inner.type === "modelContentBlockStartEvent" &&
                inner.start?.toolUse
              ) {
                // [S42-T1] Tool lifecycle start — emit running pill
                const tu = inner.start.toolUse;
                const tid = String(tu.toolUseId ?? `tool-${Date.now()}`);
                const tname = String(tu.name ?? "tool");
                toolStarts.set(tid, { name: tname, startedAt: Date.now() });
                emit({
                  type: "tool_call",
                  id: tid,
                  name: tname,
                  status: "running",
                });
              } else if (
                inner.type === "messageMetadataEvent" &&
                inner.usage
              ) {
                // [S42-T1] Capture token counts for the `complete` footer
                const u = inner.usage;
                if (typeof u.inputTokens === "number") promptTokens = u.inputTokens;
                if (typeof u.outputTokens === "number") completionTokens = u.outputTokens;
              }
            } else if (ev.type === "toolResultEvent") {
              log.info("Tool result", { tool: ev.result?.toolName });
              inToolPhase = true;
              // [S42-T1] Tool lifecycle end — emit done/failed pill with duration
              const tid = String(ev.result?.toolUseId ?? "");
              const open = tid ? toolStarts.get(tid) : undefined;
              const duration_ms = open ? Date.now() - open.startedAt : undefined;
              const status: "done" | "failed" =
                ev.result?.status === "error" ? "failed" : "done";
              emit({
                type: "tool_call",
                id: tid || `tool-${Date.now()}`,
                name: String(ev.result?.toolName ?? open?.name ?? "tool"),
                status,
                ...(duration_ms !== undefined ? { duration_ms } : {}),
              });
              if (tid) toolStarts.delete(tid);
            }
          }
        } catch (err) {
          const errorText = err instanceof Error ? err.message : String(err);
          log.error("Stream error", { error: errorText });

          closeStep();
          emit({ type: "error", errorText });
          // [S42-T1] Footer fires on error path too so the UI can still render
          // latency / model in the message footer when a stream half-completes.
          emit({
            type: "complete",
            latency_ms: Date.now() - startTime,
            ...(model !== undefined ? { model } : {}),
            ...(sourceCount !== undefined ? { source_count: sourceCount } : {}),
            ...(promptTokens !== undefined ? { prompt_tokens: promptTokens } : {}),
            ...(completionTokens !== undefined ? { completion_tokens: completionTokens } : {}),
          });
          emit({ type: "finish-step" });
          emit({ type: "finish", finishReason: "error" });

          if (!cancelled) {
            finish();
          }
          return;
        }

        // Clean close
        closeStep();
        // [S42-T1] Message footer event — fields are all optional so older
        // frontends that don't recognise the type discard it harmlessly.
        emit({
          type: "complete",
          latency_ms: Date.now() - startTime,
          ...(model !== undefined ? { model } : {}),
          ...(sourceCount !== undefined ? { source_count: sourceCount } : {}),
          ...(promptTokens !== undefined ? { prompt_tokens: promptTokens } : {}),
          ...(completionTokens !== undefined ? { completion_tokens: completionTokens } : {}),
        });
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
