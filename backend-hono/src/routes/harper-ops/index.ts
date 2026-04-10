// [claude-code 2026-04-04] Harper Ops routes — autonomous loop monitoring + control

import { Hono } from "hono";
import {
  getOpsFeed,
  getOpsStatus,
  getPendingApprovals,
  updateApproval,
  getRecentEntries,
  searchJournal,
  isAlive,
  getStatus,
  triggerHeartbeat,
  enqueueTask,
  opsEmitter,
  type HarperTask,
} from "../../services/harper-autonomous/index.js";
import type { OpsEntry } from "../../services/harper-autonomous/ops-store.js";

// [claude-code 2026-04-05] SSE client management for ops stream
const sseClients = new Set<ReadableStreamDefaultController>();
const encoder = new TextEncoder();

function broadcastOpsEntry(entry: OpsEntry) {
  const payload = `data: ${JSON.stringify(entry)}\n\n`;
  sseClients.forEach((controller) => {
    try {
      controller.enqueue(encoder.encode(payload));
    } catch {
      sseClients.delete(controller);
    }
  });
}

// Wire emitter to broadcaster
opsEmitter.on("entry", broadcastOpsEntry);

export function createHarperOpsRoutes() {
  const app = new Hono();

  // ── Status ────────────────────────────────────────────────────────────────
  app.get("/status", async (c) => {
    const [loopStatus, opsStatus] = await Promise.all([
      Promise.resolve(getStatus()),
      getOpsStatus(),
    ]);
    return c.json({
      loop: loopStatus,
      ops: opsStatus,
    });
  });

  // ── Ops Feed (paginated) ─────────────────────────────────────────────────
  app.get("/feed", async (c) => {
    const limit = Math.min(Number(c.req.query("limit") ?? "50"), 100);
    const offset = Number(c.req.query("offset") ?? "0");
    const result = await getOpsFeed(limit, offset);
    return c.json(result);
  });

  // ── Pending Approvals ────────────────────────────────────────────────────
  app.get("/approvals", async (c) => {
    const approvals = await getPendingApprovals();
    return c.json({ approvals });
  });

  // ── Approve / Deny ───────────────────────────────────────────────────────
  app.post("/approve/:id", async (c) => {
    const { id } = c.req.param();
    const entry = await updateApproval(id, "approved");
    if (!entry) return c.json({ error: "Not found" }, 404);
    return c.json({ entry });
  });

  app.post("/deny/:id", async (c) => {
    const { id } = c.req.param();
    const entry = await updateApproval(id, "denied");
    if (!entry) return c.json({ error: "Not found" }, 404);
    return c.json({ entry });
  });

  // ── Journal ──────────────────────────────────────────────────────────────
  app.get("/journal", async (c) => {
    const limit = Math.min(Number(c.req.query("limit") ?? "20"), 50);
    const entryType = c.req.query("type") ?? undefined;
    const entries = await getRecentEntries(limit, entryType);
    return c.json({ entries });
  });

  app.get("/journal/search", async (c) => {
    const query = c.req.query("q");
    if (!query) return c.json({ error: "Missing query parameter q" }, 400);
    const limit = Math.min(Number(c.req.query("limit") ?? "10"), 50);
    const entries = await searchJournal(query, limit);
    return c.json({ entries });
  });

  // [claude-code 2026-04-05] Latest narrative-synthesis or scoring-qa journal entry
  app.get("/journal/latest-synthesis", async (c) => {
    const [narrativeEntries, scoringEntries] = await Promise.all([
      getRecentEntries(1, "narrative"),
      getRecentEntries(1, "scoring_qa"),
    ]);
    const n = narrativeEntries[0] ?? null;
    const s = scoringEntries[0] ?? null;
    let entry = n;
    if (s && (!n || (s.createdAt && n.createdAt && s.createdAt > n.createdAt)))
      entry = s;
    return c.json({ entry });
  });

  // [claude-code 2026-04-05] SSE stream for real-time ops feed updates
  app.get("/stream", (c) => {
    let ctrl: ReadableStreamDefaultController;
    const stream = new ReadableStream({
      start(controller) {
        ctrl = controller;
        controller.enqueue(encoder.encode(":ok\n\n"));
        sseClients.add(controller);
      },
      cancel() {
        sseClients.delete(ctrl);
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  });

  // [claude-code 2026-04-04] Direct write endpoints for ops + journal (maintenance-tier)
  app.post("/feed", async (c) => {
    const body = await c.req.json<Partial<OpsEntry>>().catch(() => null);
    if (!body || !body.title) return c.json({ error: "title required" }, 400);
    const { writeOpsEntry } =
      await import("../../services/harper-autonomous/ops-store.js");
    const entry = await writeOpsEntry({
      actionType: body.actionType ?? "alert",
      title: body.title,
      detail: body.detail,
      severity: body.severity ?? "info",
      metadata: body.metadata,
    });
    return c.json({ ok: true, entry });
  });

  app.post("/journal", async (c) => {
    const body = await c.req
      .json<{
        entryType?: string;
        content?: string;
        tags?: string[];
        context?: Record<string, unknown>;
      }>()
      .catch(() => null);
    if (!body || !body.content)
      return c.json({ error: "content required" }, 400);
    const { writeJournalEntry } =
      await import("../../services/harper-autonomous/journal-store.js");
    const entry = await writeJournalEntry({
      entryType: (body.entryType ?? "observation") as any,
      content: body.content,
      tags: body.tags ?? [],
      context: body.context,
    });
    return c.json({ ok: true, entry });
  });

  // ── Manual Triggers ──────────────────────────────────────────────────────
  app.post("/trigger", async (c) => {
    const body = (await c.req
      .json<{ type?: string; message?: string }>()
      .catch(() => ({ type: undefined, message: undefined }))) as {
      type?: string;
      message?: string;
    };

    if (body.type === "heartbeat" || !body.type) {
      triggerHeartbeat();
      return c.json({ ok: true, action: "heartbeat triggered" });
    }

    // Allow manual task injection
    const validTypes = [
      "scoring-qa",
      "narrative-synthesis",
      "brief-review",
      "regime-memo",
      "manual",
    ];
    if (!validTypes.includes(body.type)) {
      return c.json(
        { error: `Invalid task type. Valid: ${validTypes.join(", ")}` },
        400,
      );
    }

    enqueueTask({
      type: body.type as HarperTask["type"],
      payload: {
        message: body.message,
        manual: true,
        timestamp: new Date().toISOString(),
      },
      priority: "normal",
    });

    return c.json({ ok: true, action: `${body.type} task enqueued` });
  });

  return app;
}
