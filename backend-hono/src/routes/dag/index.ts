// [claude-code 2026-04-10] S8-T2: DAG API — status, SSE stream, cancel

import { Hono } from "hono";
import { agentBus } from "../../services/agent-bus/bus.js";
import type {
  DAGProgressEvent,
  AgentStreamEvent,
  BusMessage,
  BusTopic,
} from "../../services/agent-bus/types.js";
import { getSupabaseClient } from "../../config/supabase.js";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("DAGRoutes");
const encoder = new TextEncoder();

const HEARTBEAT_INTERVAL_MS = 8_000;

export function createDagRoutes(): Hono {
  const router = new Hono();

  // Shared SSE factory for surface.* bus topics
  function surfaceSSE(topic: BusTopic) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (c: any) => {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          let closed = false;
          const heartbeat = setInterval(() => {
            if (!closed) {
              try {
                controller.enqueue(encoder.encode(": heartbeat\n\n"));
              } catch {
                clearInterval(heartbeat);
              }
            }
          }, HEARTBEAT_INTERVAL_MS);

          const unsub = agentBus.subscribe(topic, (msg) => {
            if (!closed) {
              try {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify(msg.payload)}\n\n`),
                );
              } catch {
                /* closed */
              }
            }
          });

          c.req.raw.signal?.addEventListener("abort", () => {
            if (!closed) {
              closed = true;
              clearInterval(heartbeat);
              unsub();
            }
          });
        },
      });
      return new Response(stream, {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        },
      });
    };
  }

  // SSE surface endpoints — frontend subscribes for live push events
  router.get("/surface/sidebar", surfaceSSE("surface.sidebar") as never);
  router.get("/surface/narrative", surfaceSSE("surface.narrative") as never);

  /**
   * GET /api/dag/:dagId
   * Returns the DAGRecord + all associated TaskRecords.
   * Used by frontend to poll initial state.
   */
  router.get("/:dagId", async (c) => {
    const dagId = c.req.param("dagId");
    const sb = getSupabaseClient();

    if (!sb) {
      return c.json({ error: "Supabase not configured" }, 503);
    }

    const [dagResult, tasksResult] = await Promise.all([
      sb.from("agent_dags").select("*").eq("id", dagId).single(),
      sb.from("agent_tasks").select("*").eq("dag_id", dagId).order("wave"),
    ]);

    if (dagResult.error || !dagResult.data) {
      return c.json({ error: "DAG not found" }, 404);
    }

    return c.json({
      dag: dagResult.data,
      tasks: tasksResult.data ?? [],
    });
  });

  /**
   * GET /api/dag/:dagId/stream
   * SSE stream of DAG events (dag.status + surface.boardroom filtered to this dagId).
   * Frontend subscribes here for live progress panels.
   */
  router.get("/:dagId/stream", (c) => {
    const dagId = c.req.param("dagId");
    log.info("DAG SSE client connected", { dagId });

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        let closed = false;

        function send(data: unknown) {
          if (!closed) {
            try {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
              );
            } catch {
              // Controller already closed
            }
          }
        }

        // Heartbeat to keep the connection alive
        const heartbeat = setInterval(() => {
          if (!closed) {
            try {
              controller.enqueue(encoder.encode(": heartbeat\n\n"));
            } catch {
              clearInterval(heartbeat);
            }
          }
        }, HEARTBEAT_INTERVAL_MS);

        // Subscribe to DAG-level progress events (filtered to this dagId)
        const unsubProgress = agentBus.subscribe<DAGProgressEvent>(
          "dag.status",
          (msg: BusMessage<DAGProgressEvent>) => {
            if (msg.dagId !== dagId) return;
            send(msg.payload);

            // Auto-close on terminal states
            const type = msg.payload?.type;
            if (type === "dag-complete" || type === "dag-error") {
              setTimeout(() => {
                if (!closed) {
                  closed = true;
                  clearInterval(heartbeat);
                  unsubProgress();
                  unsubStream();
                  try {
                    controller.close();
                  } catch {
                    // already closed
                  }
                }
              }, 500); // small delay so last event flushes
            }
          },
        );

        // Subscribe to agent stream events for this DAG (text deltas, agent lifecycle)
        const unsubStream = agentBus.subscribe<AgentStreamEvent>(
          "surface.boardroom",
          (msg: BusMessage<AgentStreamEvent>) => {
            if (msg.dagId !== dagId) return;
            send(msg.payload);
          },
        );

        // Cleanup on client disconnect
        c.req.raw.signal?.addEventListener("abort", () => {
          if (!closed) {
            closed = true;
            clearInterval(heartbeat);
            unsubProgress();
            unsubStream();
          }
        });
      },

      cancel() {
        // Browser closed the connection — unsubscribers already registered above
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  });

  /**
   * POST /api/dag/:dagId/cancel
   * Cancel a running DAG: set all pending/running tasks + the DAG itself to cancelled.
   */
  router.post("/:dagId/cancel", async (c) => {
    const dagId = c.req.param("dagId");
    const sb = getSupabaseClient();

    if (!sb) {
      return c.json({ error: "Supabase not configured" }, 503);
    }

    const now = new Date().toISOString();

    const [dagUpdate, tasksUpdate] = await Promise.all([
      sb
        .from("agent_dags")
        .update({ status: "cancelled", completed_at: now })
        .eq("id", dagId)
        .in("status", ["pending", "running"]),
      sb
        .from("agent_tasks")
        .update({ status: "cancelled", completed_at: now })
        .eq("dag_id", dagId)
        .in("status", ["pending", "running"]),
    ]);

    if (dagUpdate.error) {
      log.warn("DAG cancel DB error", {
        dagId,
        error: dagUpdate.error.message,
      });
      return c.json({ error: "Failed to cancel DAG" }, 500);
    }

    log.info("DAG cancelled", { dagId });

    // Publish cancellation event so SSE clients can close
    agentBus.publish<DAGProgressEvent>("dag.status", {
      dagId,
      payload: {
        type: "dag-error",
        dagId,
        wave: -1,
        tasks: [],
      },
    });

    return c.json({ ok: true, dagId, cancelledTasks: tasksUpdate.count ?? 0 });
  });

  return router;
}
