// [claude-code 2026-04-24] S36 ClusterBeam — POST /api/narrative/cluster-summary
// JWT-guarded, Zod-validated, per-user rate-limited (30/min) wrapper around the
// cluster-summarizer service. Happy path last; guard clauses early.

import type { Context } from "hono";
import { z } from "zod";
import { summarizeCluster } from "../../services/narrative/cluster-summarizer.js";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("ClusterSummaryRoute");

const RATE_LIMIT_PER_MIN = 30;
const RATE_WINDOW_MS = 60_000;
const windowsByUser = new Map<string, number[]>();

function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const window = (windowsByUser.get(userId) ?? []).filter(
    (ts) => now - ts < RATE_WINDOW_MS,
  );
  if (window.length >= RATE_LIMIT_PER_MIN) {
    windowsByUser.set(userId, window);
    return true;
  }
  window.push(now);
  windowsByUser.set(userId, window);
  return false;
}

const RequestSchema = z.object({
  groupId: z.string().min(1).max(200),
  narrativeSlug: z.string().max(100).optional(),
  narrativeTitle: z.string().max(200).optional(),
  cards: z
    .array(
      z.object({
        id: z.string().min(1).max(200),
        title: z.string().min(1).max(500),
        sentiment: z.enum(["bullish", "bearish", "neutral"]).optional(),
        severity: z.enum(["low", "medium", "high"]).optional(),
        date: z.string().max(64).optional(),
        ivScore: z.number().optional(),
      }),
    )
    .min(1)
    .max(100),
});

export async function clusterSummary(c: Context) {
  const userId = c.get("userId") as string | undefined;
  if (!userId || userId === "anonymous") {
    return c.json({ error: "unauthorized" }, 401);
  }

  if (isRateLimited(userId)) {
    return c.json(
      {
        error: `Rate limit exceeded: max ${RATE_LIMIT_PER_MIN} summaries per minute`,
      },
      429,
    );
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "validation failed", issues: parsed.error.issues },
      400,
    );
  }

  try {
    const response = await summarizeCluster(parsed.data);
    return c.json(response);
  } catch (err) {
    log.error("summarizeCluster failed", { error: String(err) });
    return c.json({ error: "summarization failed" }, 500);
  }
}
