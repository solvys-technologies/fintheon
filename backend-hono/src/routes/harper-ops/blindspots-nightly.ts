// [claude-code 2026-04-23] S31-T6 — Routine-gated POST /api/harper-ops/blindspots-nightly.
// Iterates users with psychAssistEnabled=true and generates blindspot rows for
// the target date. Users with PsychAssist OFF are skipped entirely (no rows).

import { Hono } from "hono";
import { listPsychAssistEnabledUsers } from "../../services/psych/is-psych-assist-on.js";
import { generateBlindspots } from "../../services/blindspots/generator.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function gateRoutine(secretHeader: string | undefined): boolean {
  const expected = process.env.ROUTINE_SECRET;
  if (!expected) return false;
  return typeof secretHeader === "string" && secretHeader === expected;
}

function yesterdayISO(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function createBlindspotsNightlyRoute() {
  const app = new Hono();

  app.post("/", async (c) => {
    const secret = c.req.header("x-routine-secret");
    if (!gateRoutine(secret)) return c.json({ error: "unauthorized" }, 401);

    const body = (await c.req.json().catch(() => ({}))) as {
      date?: string;
      userId?: string;
      enableFluidPass?: boolean;
      vix?: number;
    };

    const date = body.date ?? yesterdayISO();
    if (!DATE_RE.test(date)) return c.json({ error: "invalid date" }, 400);

    const userIds = body.userId
      ? [body.userId]
      : await listPsychAssistEnabledUsers();

    const results: Array<{ userId: string; psych: number; trading: number }> =
      [];
    const errors: Array<{ userId: string; error: string }> = [];

    for (const userId of userIds) {
      try {
        const out = await generateBlindspots(userId, date, {
          enableFluidPass: body.enableFluidPass === true,
          vix: body.vix,
        });
        results.push({
          userId,
          psych: out.psych.length,
          trading: out.trading.length,
        });
      } catch (err) {
        errors.push({
          userId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return c.json({
      date,
      processed: results.length,
      skipped: 0,
      totalCandidates: userIds.length,
      results,
      errors,
    });
  });

  return app;
}
