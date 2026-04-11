// [claude-code 2026-04-10] S8-T2: Multi-stream merger — N concurrent agent streams → single SSE ReadableStream

import type { AgentStreamEvent, HermesAgentId } from "./types.js";

export interface AgentStream {
  agentId: HermesAgentId;
  taskId: string;
  dagId: string;
  stream: ReadableStream<string>; // text chunks from Strands agent
}

const encoder = new TextEncoder();
const HEARTBEAT_INTERVAL_MS = 8_000;

function sseEvent(payload: AgentStreamEvent): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);
}

function sseHeartbeat(): Uint8Array {
  return encoder.encode(": heartbeat\n\n");
}

/**
 * Merge N concurrent Strands agent streams into a single SSE-encoded ReadableStream.
 *
 * Each text chunk is wrapped with agent identity:
 *   { type: 'agent-delta', agentId, taskId, dagId, data: chunk }
 *
 * Lifecycle events emitted per agent: agent-start → agent-delta* → agent-complete | agent-error
 * A shared heartbeat fires every 8s. The stream closes when ALL agents finish.
 */
export function createMergedStream(
  agentStreams: AgentStream[],
): ReadableStream<Uint8Array> {
  if (agentStreams.length === 0) {
    return new ReadableStream<Uint8Array>({
      start(controller) {
        controller.close();
      },
    });
  }

  return new ReadableStream<Uint8Array>({
    start(controller) {
      let finished = 0;
      const total = agentStreams.length;
      let closed = false;

      function tryEnqueue(bytes: Uint8Array) {
        if (!closed) {
          try {
            controller.enqueue(bytes);
          } catch {
            // Controller already closed — ignore
          }
        }
      }

      function emit(payload: AgentStreamEvent) {
        tryEnqueue(sseEvent(payload));
      }

      function onAgentDone() {
        finished++;
        if (finished >= total && !closed) {
          closed = true;
          clearInterval(heartbeat);
          try {
            controller.close();
          } catch {
            // already closed
          }
        }
      }

      // Shared heartbeat — prevents connection drops during silent stretches
      const heartbeat = setInterval(() => {
        tryEnqueue(sseHeartbeat());
      }, HEARTBEAT_INTERVAL_MS);

      // Consume each stream concurrently (fire-and-forget, errors handled per-stream)
      for (const { agentId, taskId, dagId, stream } of agentStreams) {
        (async () => {
          emit({ type: "agent-start", dagId, taskId, agentId, data: "" });

          try {
            const reader = stream.getReader();
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              if (value) {
                emit({
                  type: "agent-delta",
                  dagId,
                  taskId,
                  agentId,
                  data: value,
                });
              }
            }
            emit({ type: "agent-complete", dagId, taskId, agentId, data: "" });
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            emit({ type: "agent-error", dagId, taskId, agentId, data: msg });
          } finally {
            onAgentDone();
          }
        })();
      }
    },

    cancel() {
      // Consumer cancelled — streams will close on their own when readers are released
    },
  });
}
