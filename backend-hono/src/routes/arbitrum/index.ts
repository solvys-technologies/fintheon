// [claude-code 2026-04-24] S35-T1/T12 Phase B: Arbitrum HTTP surface.
//   GET  /api/arbitrum/latest[?trigger=event|session|manual]
//   GET  /api/arbitrum/:id
//   POST /api/arbitrum/deliberate   — manual-trigger chamber (smoke test)
// Public read endpoints; auth middleware isn't applied — verdicts are UI
// content (digest_text), not user-owned data. Matches the
// "authenticated_read_arbitrum_verdicts" RLS policy shipped in T2.

import { Hono } from "hono";
import { createLogger } from "../../lib/logger.js";
import {
  getLatest,
  getLatestByTrigger,
  getVerdict,
  runChamber,
  type ArbitrumTriggerType,
} from "../../services/arbitrum/index.js";

const log = createLogger("ArbitrumRoutes");

const VALID_TRIGGERS: ReadonlySet<ArbitrumTriggerType> = new Set([
  "event",
  "session",
  "manual",
]);

export function createArbitrumRoutes(): Hono {
  const app = new Hono();

  app.get("/latest", async (c) => {
    const rawTrigger = c.req.query("trigger");
    if (rawTrigger && VALID_TRIGGERS.has(rawTrigger as ArbitrumTriggerType)) {
      const v = await getLatestByTrigger(rawTrigger as ArbitrumTriggerType);
      return c.json({ verdict: v });
    }
    const v = await getLatest();
    return c.json({ verdict: v });
  });

  app.get("/:id", async (c) => {
    const id = c.req.param("id");
    if (!id) return c.json({ error: "id required" }, 400);
    const v = await getVerdict(id);
    if (!v) return c.json({ error: "not found" }, 404);
    return c.json({ verdict: v });
  });

  app.post("/deliberate", async (c) => {
    let body: Record<string, unknown>;
    try {
      body = (await c.req.json()) as Record<string, unknown>;
    } catch {
      return c.json({ error: "invalid JSON body" }, 400);
    }

    const question = typeof body.question === "string" ? body.question : "";
    const category =
      typeof body.category === "string" ? body.category : "custom";
    const context = typeof body.context === "string" ? body.context : undefined;
    const rounds = typeof body.rounds === "number" ? body.rounds : undefined;

    if (question.trim().length === 0) {
      return c.json({ error: "question is required" }, 400);
    }

    try {
      const result = await runChamber(
        { question, category, context },
        "manual",
        { rounds },
      );
      return c.json({
        verdict_id: result.verdict.verdict_id,
        persisted: result.persisted,
        consensus_probability: result.verdict.consensus_probability,
        confidence: result.verdict.confidence,
        dissent: result.verdict.dissent,
        digest_text: result.verdict.digest_text,
      });
    } catch (err) {
      log.error("runChamber failed on /deliberate", {
        error: err instanceof Error ? err.message : String(err),
      });
      return c.json({ error: "chamber invocation failed" }, 500);
    }
  });

  return app;
}
