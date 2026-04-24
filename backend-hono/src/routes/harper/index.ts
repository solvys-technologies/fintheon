// [claude-code 2026-04-19] S25: mounted /approvals/:id + /dispatch subroutes for the mobile
//   catalyst DetailSheet flow — GET one approval with expiresAt, POST seeded conversation.
// [claude-code 2026-04-05] Strands Phase 8: Harper routes — streamHarperChat() replaces old CLI bridge + createUIMessageStreamResponse
/**
 * Harper Routes
 * POST /api/harper/chat — streaming SSE chat via Strands agent
 * GET  /api/harper/status — check if VProxy/Strands is available
 */

import { Hono } from "hono";
import {
  streamHarperChat,
  isStrandsAvailable,
  isVProxyEnabled,
  FINTHEON_PATHS,
} from "../../services/strands/index.js";
import { checkVProxyHealth } from "../../services/strands/provider.js";
import { uiStreamToSSEResponse } from "../../services/strands/stream-adapter.js";
import { createRequestCognition } from "../../services/cognition-emitter.js";
import * as conversationStore from "../../services/ai/conversation-store.js";
import {
  resolveApproval,
  getAllPermissions,
  revokePermission,
  getPendingApprovals,
  type ApprovalDecision,
} from "../../services/tool-approval-store.js";
import { createApprovalDetailRoutes } from "./approvals.js";
import { createDispatchRoute } from "./dispatch.js";
import {
  browseTask,
  BrowseTaskInputSchema,
  BROWSE_TASK_TOOL_SCHEMA,
} from "../../services/browser/operator.js";
import { agentBus } from "../../services/agent-bus/bus.js";
import { executeDag } from "../../services/agent-bus/dag-scheduler.js";
import { createAgentDeskDAG } from "../../services/agent-bus/templates/agent-desk-template.js";
import type {
  AgentStreamEvent,
  DAGProgressEvent,
  BusMessage,
} from "../../services/agent-bus/types.js";

export function createHarperRoutes() {
  const app = new Hono();

  // ── Status check ─────────────────────────────────────────────────────────
  app.get("/status", async (c) => {
    const available = await isStrandsAvailable();
    const usingVProxy = isVProxyEnabled();
    return c.json({
      available,
      agent: "harper-opus",
      model: usingVProxy
        ? (process.env.VPROXY_ANTHROPIC_MODEL ?? "claude-opus-4-6")
        : "claude-opus-local",
      provider: usingVProxy ? "strands-vproxy" : "strands-local",
    });
  });

  // ── Chat (streaming SSE) ─────────────────────────────────────────────────
  // Chat writes to ai_conversations / ai_messages scoped by userId. When no JWT
  // is present the auth middleware sets userId = "anonymous", so without this
  // guard every unauthed request would write into one shared row bucket. Reject
  // up front and force callers to carry a Supabase token.
  app.post("/chat", async (c) => {
    const authedUserId = c.get("userId" as never) as string | undefined;
    if (!authedUserId || authedUserId === "anonymous") {
      return c.json(
        {
          error: "Authentication required",
          hint: "Chat writes per-user conversation history — sign in with Supabase before POSTing to /api/harper/chat.",
        },
        401,
      );
    }

    const startTime = Date.now();
    const requestId = `harper-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const cognition = createRequestCognition(requestId, startTime);

    c.header("X-Request-Id", requestId);

    try {
      const body = await c.req.json<{
        message: string;
        /** Base64 data-URI images attached to the message */
        images?: string[];
        conversationId?: string;
        history?: Array<{ role: "user" | "assistant"; content: string }>;
        thinkHarder?: boolean;
        persona?: string;
        riskFlowContext?: string;
        activeConnectors?: string[];
        provider?: "local" | "nous" | "orouter";
        /** Explicit boardroom surface flag — triggers multi-agent DAG dispatch */
        surface?: string;
        boardroom?: boolean;
        userContext?: {
          traderName?: string;
          selectedSymbol?: { symbol: string; name: string };
          tradingGoals?: string;
          instrumentsTraded?: string[];
          riskSettings?: Record<string, unknown>;
        };
      }>();

      const message = body.message?.trim();
      if (!message) {
        return c.json({ error: "Message is required" }, 400);
      }

      // ── Boardroom mode: dispatch to multi-agent DAG instead of single chat ──
      // Only trigger DAG when explicitly requested (surface or flag), NOT from connector list.
      // The connector list signals available tools, not desired routing.
      const isBoardroomMode =
        body.surface === "boardroom" || body.boardroom === true;

      if (isBoardroomMode) {
        const userId = authedUserId;
        const dagDef = await createAgentDeskDAG({
          lanes: [
            {
              id: "boardroom-query",
              name: message.slice(0, 60),
              sentiment: 0.5,
            },
          ],
          userInjection: message,
          conversationId: body.conversationId,
          userId,
        });

        // Capture dagId before firing
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

        void executeDag(dagDef).catch((err: unknown) => {
          console.error("[Harper Boardroom DAG] error:", err);
        });

        const dagId = await dagIdPromise;

        // Bridge DAG bus events into UIMessageStream so the chat shows real-time
        // agent output instead of a static placeholder string.
        const enc = new TextEncoder();
        const msgId = `harper-dag-${Date.now()}`;
        let streamClosed = false;
        const AGENT_LABELS: Record<string, string> = {
          oracle: "Oracle (All-Seer)",
          feucht: "Feucht (Futures & Risk)",
          consul: "Consul (Fundamentals)",
          herald: "Herald (News & Sentiment)",
          harper: "Harper (Synthesis)",
        };

        const dagStream = new ReadableStream<Uint8Array>({
          start(ctrl) {
            const sse = (ev: object) =>
              enc.encode(`data: ${JSON.stringify(ev)}\n\n`);

            function cleanup(): void {
              streamClosed = true;
              if (heartbeatHandle) {
                clearInterval(heartbeatHandle);
                heartbeatHandle = null;
              }
              unsubSurface();
              unsubDag();
            }

            // Heartbeat every 8s to keep connection alive
            let heartbeatHandle: ReturnType<typeof setInterval> | null =
              setInterval(() => {
                if (streamClosed) return;
                try {
                  ctrl.enqueue(enc.encode(": heartbeat\n\n"));
                } catch {
                  streamClosed = true;
                }
              }, 8_000);

            // Track which agents have started (to emit headers)
            const agentStarted = new Set<string>();
            let textIdCounter = 0;
            const nextTextId = () => `txt-${++textIdCounter}`;

            // Emit UIMessageStream preamble
            ctrl.enqueue(sse({ type: "start", messageId: msgId }));
            ctrl.enqueue(sse({ type: "start-step" }));
            const mainTextId = nextTextId();
            ctrl.enqueue(sse({ type: "text-start", id: mainTextId }));

            // [S28-T1] Analysts are prompted to reply with pure JSON
            //   (see agent-bus/templates/agent-desk-template.ts → buildAnalystPrompt).
            //   Streaming those deltas verbatim leaked raw `{"agentId":"feucht",...}`
            //   into the Harper chat bubble. Buffer per agent, parse on completion,
            //   and emit a one-line prose summary — the source truth (JSON) stays
            //   available via the Aquarium/AgentDesk surfaces where it belongs.
            const agentBuffers = new Map<string, string>();
            const agentCompleted = new Set<string>();

            function summarizeAgent(agentId: string): string {
              const raw = (agentBuffers.get(agentId) ?? "").trim();
              if (!raw) return "";
              const cleaned = raw
                .replace(/```json\n?/g, "")
                .replace(/```\n?/g, "")
                .trim();
              try {
                const parsed = JSON.parse(cleaned);
                if (typeof parsed === "object" && parsed !== null) {
                  const p = parsed as Record<string, unknown>;
                  const lines: string[] = [];
                  if (typeof p.assessment === "string") {
                    lines.push(String(p.assessment).trim());
                  }
                  if (typeof p.reasoning === "string") {
                    lines.push(String(p.reasoning).trim());
                  }
                  if (typeof p.finalBriefing === "string") {
                    lines.push(String(p.finalBriefing).trim());
                  }
                  const stats: string[] = [];
                  if (typeof p.projectedIVScore === "number") {
                    stats.push(`IV ${Number(p.projectedIVScore).toFixed(1)}`);
                  }
                  if (typeof p.compositeIV === "number") {
                    stats.push(
                      `Composite IV ${Number(p.compositeIV).toFixed(1)}`,
                    );
                  }
                  if (typeof p.confidence === "number") {
                    stats.push(
                      `conf ${Math.round(Number(p.confidence) * 100)}%`,
                    );
                  }
                  if (typeof p.verdict === "string") {
                    stats.push(`verdict: ${String(p.verdict)}`);
                  }
                  if (stats.length > 0) {
                    lines.push(`(${stats.join(" · ")})`);
                  }
                  if (typeof p.keyConcern === "string" && p.keyConcern) {
                    lines.push(`Key concern: ${String(p.keyConcern).trim()}`);
                  }
                  const out = lines.filter(Boolean).join(" ").trim();
                  if (out) return out;
                }
              } catch {
                /* not JSON — fall through to prose path */
              }
              // Not parseable as JSON, but still strip any dossier-shaped blobs
              // before surfacing to the chat bubble.
              return cleaned
                .replace(/\{\s*"agentId"[\s\S]*?\}\s*$/g, "")
                .trim();
            }

            // Subscribe to agent stream events — bridge deltas into UIMessageStream
            const unsubSurface = agentBus.subscribe<AgentStreamEvent>(
              "surface.boardroom",
              (msg: BusMessage<AgentStreamEvent>) => {
                if (msg.dagId !== dagId || streamClosed) return;
                const ev = msg.payload;

                if (
                  ev.type === "agent-start" &&
                  !agentStarted.has(ev.agentId)
                ) {
                  agentStarted.add(ev.agentId);
                  agentBuffers.set(ev.agentId, "");
                  const label = AGENT_LABELS[ev.agentId] ?? ev.agentId;
                  ctrl.enqueue(
                    sse({
                      type: "text-delta",
                      id: mainTextId,
                      delta: `\n\n**${label}:**\n`,
                    }),
                  );
                }

                if (ev.type === "agent-delta" && typeof ev.data === "string") {
                  const prev = agentBuffers.get(ev.agentId) ?? "";
                  agentBuffers.set(ev.agentId, prev + ev.data);
                }

                if (
                  ev.type === "agent-complete" &&
                  !agentCompleted.has(ev.agentId)
                ) {
                  agentCompleted.add(ev.agentId);
                  const summary = summarizeAgent(ev.agentId);
                  if (summary) {
                    ctrl.enqueue(
                      sse({
                        type: "text-delta",
                        id: mainTextId,
                        delta: summary,
                      }),
                    );
                  }
                }

                if (ev.type === "agent-error") {
                  const errMsg =
                    typeof ev.data === "string"
                      ? ev.data
                      : ((ev.data as Record<string, unknown>)?.error ??
                        "error");
                  ctrl.enqueue(
                    sse({
                      type: "text-delta",
                      id: mainTextId,
                      delta: `\n[${ev.agentId} error: ${errMsg}]\n`,
                    }),
                  );
                }
              },
            );

            // Subscribe to DAG lifecycle — close stream on terminal events
            const unsubDag = agentBus.subscribe<DAGProgressEvent>(
              "dag.status",
              (msg: BusMessage<DAGProgressEvent>) => {
                if (msg.dagId !== dagId || streamClosed) return;

                if (
                  msg.payload.type === "dag-complete" ||
                  msg.payload.type === "dag-error"
                ) {
                  // Flush any agents whose buffer was never closed by a
                  // terminal agent-end event — protects against DAG shortcuts.
                  for (const agentId of agentBuffers.keys()) {
                    if (agentCompleted.has(agentId)) continue;
                    agentCompleted.add(agentId);
                    const summary = summarizeAgent(agentId);
                    if (summary) {
                      ctrl.enqueue(
                        sse({
                          type: "text-delta",
                          id: mainTextId,
                          delta: summary,
                        }),
                      );
                    }
                  }
                  if (msg.payload.type === "dag-error") {
                    ctrl.enqueue(
                      sse({
                        type: "text-delta",
                        id: mainTextId,
                        delta: "\n\n*Deliberation encountered an error.*",
                      }),
                    );
                  }
                  // Close UIMessageStream
                  ctrl.enqueue(sse({ type: "text-end", id: mainTextId }));
                  ctrl.enqueue(sse({ type: "finish-step" }));
                  ctrl.enqueue(sse({ type: "finish", finishReason: "stop" }));
                  ctrl.enqueue(enc.encode("data: [DONE]\n\n"));
                  cleanup();
                  try {
                    ctrl.close();
                  } catch {
                    /* already closed */
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
                /* already closed */
              }
            });
          },
        });

        return uiStreamToSSEResponse(dagStream, {
          "Access-Control-Allow-Origin": c.req.header("Origin") || "*",
          "X-Request-Id": requestId,
          "X-DAG-Id": dagId,
          "X-Conversation-Id": body.conversationId ?? "",
        });
      }

      // Get or create conversation
      const userId = authedUserId;
      const reqConversationId = body.conversationId ?? undefined;
      let conversation = reqConversationId
        ? await conversationStore.getConversation(reqConversationId, userId)
        : null;
      if (!conversation) {
        conversation = await conversationStore.createConversation(userId, {
          title: message.slice(0, 60),
          model: "harper-opus",
        });
      }

      // Store user message
      await conversationStore.addMessage(conversation.id, {
        conversationId: conversation.id,
        role: "user",
        content: message,
        model: "harper-opus",
      });

      // VProxy pre-flight — if Local selected but VProxy is down, stream a friendly error
      const isLocalProvider = !body.provider || body.provider === "local";
      if (isLocalProvider) {
        const health = await checkVProxyHealth(true); // force fresh check
        if (!health.available) {
          const enc = new TextEncoder();
          const msgId = `harper-${Date.now()}`;
          const sseError = (ev: object) =>
            enc.encode(`data: ${JSON.stringify(ev)}\n\n`);
          const stream = new ReadableStream<Uint8Array>({
            start(ctrl) {
              ctrl.enqueue(sseError({ type: "start", messageId: msgId }));
              ctrl.enqueue(sseError({ type: "start-step" }));
              ctrl.enqueue(sseError({ type: "text-start", id: "txt-1" }));
              const msg = `⚠️ VProxy (Local) is not available right now. Switch the provider dropdown to **Nous** or **ORouter** to continue. (${health.error ?? "connection refused"})`;
              ctrl.enqueue(
                sseError({ type: "text-delta", id: "txt-1", delta: msg }),
              );
              ctrl.enqueue(sseError({ type: "text-end", id: "txt-1" }));
              ctrl.enqueue(sseError({ type: "finish-step" }));
              ctrl.enqueue(sseError({ type: "finish", finishReason: "stop" }));
              ctrl.enqueue(enc.encode("data: [DONE]\n\n"));
              ctrl.close();
            },
          });
          return uiStreamToSSEResponse(stream, {
            "Access-Control-Allow-Origin": c.req.header("Origin") || "*",
            "X-Request-Id": requestId,
          });
        }
      }

      const providerLabel =
        body.provider === "nous"
          ? "Nous (Arcee/Qwen)"
          : body.provider === "orouter"
            ? "OpenRouter Opus"
            : "VProxy Local";
      cognition.step(
        "agent-route",
        `Harper (${providerLabel})`,
        `Persona: ${body.persona ?? "harper-opus"}`,
      );
      cognition.step(
        "gateway-call",
        `Streaming via ${providerLabel}`,
        "Strands agent, MCP tools available",
      );

      const response = await streamHarperChat(
        {
          message,
          images: body.images,
          conversationId: conversation.id,
          requestId,
          userId,
          history: body.history,
          thinkHarder: body.thinkHarder,
          persona: body.persona,
          riskFlowContext: body.riskFlowContext,
          activeConnectors: body.activeConnectors,
          surface: body.surface,
          userContext: body.userContext,
          provider: body.provider,
        },
        {
          "Access-Control-Allow-Origin": c.req.header("Origin") || "*",
          "Access-Control-Allow-Credentials": "true",
          "Access-Control-Expose-Headers":
            "X-Conversation-Id, X-Request-Id, X-Hermes-Agent",
        },
      );

      const duration = Date.now() - startTime;
      cognition.step(
        "response-ready",
        "Stream initiated",
        `${duration}ms to first byte`,
      );
      cognition.done();

      return response;
    } catch (error) {
      console.error(`[HarperOpus][${requestId}] Handler error:`, error);
      cognition.done();
      return c.json(
        {
          error: "Harper request failed",
          details: error instanceof Error ? error.message : String(error),
        },
        500,
      );
    }
  });

  // ── Tool Decision (approve/deny pending tool use) ─────────────────────────
  app.post("/tool-decision", async (c) => {
    const body = await c.req.json<{
      approvalId: string;
      decision: ApprovalDecision;
    }>();
    if (!body.approvalId || !["approved", "denied"].includes(body.decision)) {
      return c.json(
        { error: "approvalId and decision (approved|denied) required" },
        400,
      );
    }

    const result = await resolveApproval(body.approvalId, body.decision);
    if (!result.found) {
      return c.json({ error: "Approval not found or already resolved" }, 404);
    }

    return c.json({
      ok: true,
      toolName: result.toolName,
      decision: body.decision,
    });
  });

  // ── Permissions CRUD ─────────────────────────────────────────────────────
  app.get("/permissions", (c) => {
    return c.json({
      permissions: getAllPermissions(),
      pending: getPendingApprovals(),
    });
  });

  app.delete("/permissions/:toolName", async (c) => {
    const toolName = c.req.param("toolName");
    await revokePermission(toolName);
    return c.json({ ok: true, revoked: toolName });
  });

  // ── Fintheon Paths (for frontend display) ────────────────────────────────
  app.get("/paths", (c) => {
    return c.json(FINTHEON_PATHS);
  });

  // [S27-T6] Browser Operator — Harper invokes this via MCP tool wrapper or
  // run_command/curl. Gated by universal-mode env flag for non-allowlisted URLs.
  app.post("/browse-task", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = BrowseTaskInputSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: "invalid input", issues: parsed.error.issues },
        400,
      );
    }
    const result = await browseTask(parsed.data);
    const status = result.success
      ? 200
      : result.error_code === "URL_NOT_ALLOWED"
        ? 403
        : result.error_code === "BUDGET_EXCEEDED"
          ? 402
          : 500;
    return c.json(result, status);
  });

  // [S27-T6] Tool-schema advertisement — any MCP bridge that registers Harper's
  // first-party tools reads the schema from here.
  app.get("/tools/browse_task", (c) => {
    return c.json(BROWSE_TASK_TOOL_SCHEMA);
  });

  // [S25] Approval detail fetch — used by mobile DetailSheet on push tap.
  app.route("/approvals", createApprovalDetailRoutes());

  // [S25] Ask CAO dispatch — seeded conversation from catalyst/riskflow/brief context.
  app.route("/dispatch", createDispatchRoute());

  return app;
}
