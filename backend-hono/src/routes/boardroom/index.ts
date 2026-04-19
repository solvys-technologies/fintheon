// [claude-code 2026-04-10] S8-T3: Added POST /dag dispatch + GET /dag/:dagId/stream SSE routes
import { Hono } from "hono";
import {
  handleGetBoardroomMessages,
  handleGetInterventionMessages,
  handleSendInterventionMessage,
  handleSendMentionMessage,
  handleGetBoardroomStatus,
  handleGetBoardroomMeetingSchedule,
  handleTriggerIntervention,
  handlePostTradeIdea,
  handleTriggerStandup,
  handleBreakingNewsTrigger,
  handleHeraldAlert,
  handleGetSchedulerStatus,
  handleGetDevelopments,
  handleGetScorecards,
  handleGetPredictions,
  handleResolvePrediction,
  handleGetThoughts,
  handleGetThoughtById,
  handleGetAgentThoughts,
  handleShowFullAnalysis,
} from "./handlers.js";
import { agentBus } from "../../services/agent-bus/bus.js";
import { executeDag } from "../../services/agent-bus/dag-scheduler.js";
import { createAgentDeskDAG } from "../../services/agent-bus/templates/agent-desk-template.js";
import type {
  AgentStreamEvent,
  DAGProgressEvent,
  BusMessage,
  HermesAgentId,
} from "../../services/agent-bus/types.js";

export function createBoardroomRoutes(): Hono {
  const router = new Hono();

  // ── Legacy polling (deprecated — use /dag + SSE stream instead) ───────────
  /** @deprecated Use POST /dag + GET /dag/:dagId/stream for real-time results */
  router.get("/messages", handleGetBoardroomMessages);
  router.get("/intervention/messages", handleGetInterventionMessages);
  router.post("/intervention/send", handleSendInterventionMessage);
  router.post("/mention/send", handleSendMentionMessage);
  router.get("/status", handleGetBoardroomStatus);
  router.get("/meeting-schedule", handleGetBoardroomMeetingSchedule);
  router.post("/intervention/trigger", handleTriggerIntervention);
  router.post("/trade-idea", handlePostTradeIdea);

  // Standup triggers (manual or cron-invoked)
  router.post("/standup/:task", handleTriggerStandup);

  // Breaking news + Herald sentinel
  router.post("/trigger/breaking-news", handleBreakingNewsTrigger);
  router.post("/herald-alert", handleHeraldAlert);

  // Scheduler status
  router.get("/scheduler/status", handleGetSchedulerStatus);

  // Thought Bank (agent deep analysis storage)
  router.get("/thoughts", handleGetThoughts);
  router.get("/thoughts/agent/:agent", handleGetAgentThoughts);
  router.get("/thoughts/:id", handleGetThoughtById);
  router.post("/thoughts/:messageId/full", handleShowFullAnalysis);

  // Consilium Intelligence Layer
  router.get("/developments", handleGetDevelopments);
  router.get("/scorecards", handleGetScorecards);
  router.get("/predictions", handleGetPredictions);
  router.post("/predictions/:id/resolve", handleResolvePrediction);

  // ── DAG dispatch ─────────────────────────────────────────────────────────
  /**
   * POST /api/boardroom/dag
   * Body: { message, conversationId?, userId?, agents?: HermesAgentId[] }
   * Returns: { dagId }
   *
   * Creates and fires a DAG for the boardroom surface. Multi-agent by default
   * (AgentDesk template). Frontend subscribes to GET /dag/:dagId/stream for
   * real-time events.
   */
  router.post("/dag", async (c) => {
    try {
      const body = await c.req.json<{
        message: string;
        conversationId?: string;
        userId?: string;
        agents?: HermesAgentId[];
      }>();

      const message = body.message?.trim();
      if (!message) {
        return c.json({ error: "message is required" }, 400);
      }

      const userId =
        (c.get("userId" as never) as string) || body.userId || "anonymous";
      const conversationId = body.conversationId;
      const agents = body.agents;

      // Build the DAG definition
      const dagDef =
        agents?.length === 1
          ? // Single-agent: minimal single-task DAG
            {
              conversationId,
              userId,
              surface: "boardroom" as const,
              template: "ad-hoc",
              input: { message },
              tasks: [
                {
                  key: `${agents[0]}-task`,
                  agentId: agents[0],
                  taskType: "analysis" as const,
                  depKeys: [] as string[],
                  input: { prompt: message },
                },
              ],
            }
          : // Multi-agent: full AgentDesk deliberation
            await createAgentDeskDAG({
              lanes: [
                {
                  id: "boardroom-query",
                  name: message.slice(0, 60),
                  sentiment: 0.5,
                  category: detectLaneCategory(message),
                },
              ],
              userInjection: message,
              conversationId,
              userId,
            });

      // Subscribe to dag-start BEFORE firing to capture the dagId
      const dagIdPromise = new Promise<string>((resolve) => {
        const unsub = agentBus.subscribe<DAGProgressEvent>(
          "dag.status",
          (msg: BusMessage<DAGProgressEvent>) => {
            if (msg.payload.type === "dag-start") {
              unsub();
              resolve(msg.dagId);
            }
          },
        );
      });

      // Fire the DAG async — client subscribes to SSE stream for results
      void executeDag(dagDef).catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[Boardroom DAG] execution error:", msg);
      });

      // Wait for dagId from the first bus event (fires synchronously with dag-start)
      const dagId = await dagIdPromise;

      return c.json({ dagId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[Boardroom DAG] dispatch error:", msg);
      return c.json({ error: msg }, 500);
    }
  });

  // ── DAG SSE stream ────────────────────────────────────────────────────────
  /**
   * GET /api/boardroom/dag/:dagId/stream
   * Server-Sent Events stream for a specific DAG.
   * Emits: AgentStreamEvent (agent-start, agent-delta, agent-complete, agent-error)
   *        DAGProgressEvent (dag-start, dag-wave, dag-complete, dag-error)
   * Closes on dag-complete / dag-error or client disconnect.
   * Heartbeat: every 8 seconds.
   */
  router.get("/dag/:dagId/stream", (c) => {
    const dagId = c.req.param("dagId");
    if (!dagId) {
      return c.json({ error: "dagId required" }, 400);
    }

    const enc = new TextEncoder();
    let closed = false;
    let heartbeatHandle: ReturnType<typeof setInterval> | null = null;

    const stream = new ReadableStream<Uint8Array>({
      start(ctrl) {
        function send(event: string, data: unknown): void {
          if (closed) return;
          try {
            ctrl.enqueue(
              enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
            );
          } catch {
            closed = true;
          }
        }

        function cleanup(): void {
          closed = true;
          if (heartbeatHandle) {
            clearInterval(heartbeatHandle);
            heartbeatHandle = null;
          }
          unsubSurface();
          unsubStatus();
        }

        // 8-second heartbeat to keep the connection alive
        heartbeatHandle = setInterval(() => {
          if (closed) {
            cleanup();
            return;
          }
          try {
            ctrl.enqueue(enc.encode(`: heartbeat\n\n`));
          } catch {
            closed = true;
          }
        }, 8_000);

        // Subscribe to agent stream events for this DAG
        const unsubSurface = agentBus.subscribe<AgentStreamEvent>(
          "surface.boardroom",
          (msg: BusMessage<AgentStreamEvent>) => {
            if (msg.dagId !== dagId) return;
            send(msg.payload.type, msg.payload);
          },
        );

        // Subscribe to DAG progress events for this DAG
        const unsubStatus = agentBus.subscribe<DAGProgressEvent>(
          "dag.status",
          (msg: BusMessage<DAGProgressEvent>) => {
            if (msg.dagId !== dagId) return;
            send(msg.payload.type, msg.payload);

            if (
              msg.payload.type === "dag-complete" ||
              msg.payload.type === "dag-error"
            ) {
              cleanup();
              try {
                ctrl.close();
              } catch {
                // already closed
              }
            }
          },
        );

        // Handle client disconnect
        c.req.raw.signal?.addEventListener("abort", () => {
          cleanup();
          try {
            ctrl.close();
          } catch {
            // already closed
          }
        });
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": c.req.header("Origin") || "*",
        "Access-Control-Allow-Credentials": "true",
        "X-DAG-Id": dagId,
      },
    });
  });

  return router;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Infer a NarrativeLane category from freeform message content */
function detectLaneCategory(message: string): string {
  const lower = message.toLowerCase();
  if (
    lower.includes("tariff") ||
    lower.includes("geopolit") ||
    lower.includes("war") ||
    lower.includes("sanction") ||
    lower.includes("china") ||
    lower.includes("russia")
  ) {
    return "geopolitical";
  }
  if (
    lower.includes("fed") ||
    lower.includes("fomc") ||
    lower.includes("inflation") ||
    lower.includes("powell") ||
    lower.includes("monetary") ||
    lower.includes("rate hike") ||
    lower.includes("rate cut")
  ) {
    return "monetary-policy";
  }
  if (
    lower.includes("earnings") ||
    lower.includes("revenue") ||
    lower.includes("eps") ||
    lower.includes("guidance") ||
    lower.includes("quarterly")
  ) {
    return "earnings-corporate";
  }
  return "market-structure";
}
