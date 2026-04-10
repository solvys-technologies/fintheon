/**
 * AI Routes
 * Route registration for /api/ai endpoints
 * Day 19 - Phase 5 Implementation
 */

// [claude-code 2026-03-10] Added queue + cognition routes
// [claude-code 2026-03-10] Registered /quick-fintheon endpoint
import { Hono } from "hono";
import { handleChat, handleChatStream } from "./handlers/chat.js";
import { handleQuickFintheon } from "./handlers/quick-fintheon.js";
import {
  handleListConversations,
  handleGetConversation,
  handleCreateConversation,
  handleUpdateConversation,
  handleDeleteConversation,
  handleArchiveConversation,
  handleUnarchiveConversation,
} from "./handlers/conversations.js";
import { getFeatureFlags } from "../../config/feature-flags.js";
import {
  handleQueueEnqueue,
  handleQueueStatus,
  handleQueueCancel,
  handleCognitionStream,
} from "./handlers/queue.js";
import { handleGetSkills } from "./handlers/skills.js";
import { getSessionManager } from "../../services/claude-sdk/session-manager.js";

export function createAiRoutes(): Hono {
  const router = new Hono();

  // Feature flags endpoint
  router.get("/features", (c) => c.json(getFeatureFlags()));

  // Skills endpoint — dynamic skill list with enabled/disabled state
  // GET /api/ai/skills
  router.get("/skills", handleGetSkills);

  // Usage endpoint — session stats for usage ring indicator
  // GET /api/ai/usage
  router.get("/usage", (c) => {
    const session = getSessionManager();
    const stats = session.getStats();
    const dailyCap = Number(process.env.CLAUDE_SESSION_DAILY_CAP ?? "50");
    const refreshHour = Number(
      process.env.CLAUDE_SESSION_REFRESH_HOUR_ET ?? "18",
    );

    // Calculate next reset time in ET
    const now = new Date();
    const etNow = new Date(
      now.toLocaleString("en-US", { timeZone: "America/New_York" }),
    );
    const etHour = etNow.getHours();
    let hoursUntilReset: number;
    if (etHour < refreshHour) {
      hoursUntilReset = refreshHour - etHour;
    } else {
      hoursUntilReset = 24 - etHour + refreshHour;
    }
    const msUntilReset =
      hoursUntilReset * 3600_000 -
      etNow.getMinutes() * 60_000 -
      etNow.getSeconds() * 1000;

    return c.json({
      requestCount: stats.requestCount,
      dailyCap,
      pct: Math.min(100, Math.round((stats.requestCount / dailyCap) * 100)),
      alive: stats.alive,
      resetsInMs: msUntilReset,
      refreshHourET: refreshHour,
    });
  });

  // QuickFintheon — multimodal chart analysis
  // POST /api/ai/quick-fintheon
  router.post("/quick-fintheon", handleQuickFintheon);

  // Chat endpoints
  // POST /api/ai/chat - Send message and get response
  router.post("/chat", handleChat);

  // POST /api/ai/chat/stream - Stream response (SSE)
  router.post("/chat/stream", handleChatStream);

  // Queue endpoints (max 2 messages per conversation)
  // POST /api/ai/queue/enqueue — add message to queue
  router.post("/queue/enqueue", handleQueueEnqueue);
  // GET /api/ai/queue/status/:conversationId — queue depth + job info
  router.get("/queue/status/:conversationId", handleQueueStatus);
  // DELETE /api/ai/queue/:jobId — cancel a job
  router.delete("/queue/:jobId", handleQueueCancel);

  // Cognition SSE stream
  // GET /api/ai/cognition/stream?requestId=xxx
  router.get("/cognition/stream", handleCognitionStream);

  // Conversation endpoints
  // GET /api/ai/conversations - List conversations
  router.get("/conversations", handleListConversations);

  // POST /api/ai/conversations - Create new conversation
  router.post("/conversations", handleCreateConversation);

  // GET /api/ai/conversations/:id - Get conversation with messages
  router.get("/conversations/:id", handleGetConversation);

  // PATCH /api/ai/conversations/:id - Update conversation
  router.patch("/conversations/:id", handleUpdateConversation);

  // DELETE /api/ai/conversations/:id - Delete conversation
  router.delete("/conversations/:id", handleDeleteConversation);

  // POST /api/ai/conversations/:id/archive - Archive conversation
  router.post("/conversations/:id/archive", handleArchiveConversation);

  // POST /api/ai/conversations/:id/unarchive - Unarchive conversation
  router.post("/conversations/:id/unarchive", handleUnarchiveConversation);

  return router;
}
