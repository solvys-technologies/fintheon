import { Hono } from "hono";
import type { Context } from "hono";
import {
  getAntilagSummary,
  listAntilagTimes,
  recordTradingViewAntilagAlert,
} from "../../services/agent-desk/antilag-service.js";

export function createAgentDeskAntilagRoutes(): Hono {
  const router = new Hono();

  router.post("/alerts", handleTradingViewAlert);
  router.get("/times", handleListTimes);
  router.get("/summary", handleSummary);

  return router;
}

async function handleTradingViewAlert(c: Context) {
  const body = await c.req.json<Record<string, unknown>>().catch(() => null);
  if (!body) return c.json({ error: "Invalid JSON payload" }, 400);

  const secretError = validateSecret(c, body);
  if (secretError)
    return c.json({ error: secretError.message }, secretError.status);

  const userId =
    (c.get("supabaseUid") as string | undefined) ??
    (c.get("userId") as string | undefined) ??
    process.env.SYSTEM_USER_ID ??
    "system";
  const result = await recordTradingViewAntilagAlert({ userId, payload: body });
  const status = result.recorded ? 201 : 202;
  return c.json(result, status);
}

async function handleListTimes(c: Context) {
  const instrument = c.req.query("instrument") ?? undefined;
  const events = await listAntilagTimes({ instrument });
  return c.json({ events, total: events.length });
}

async function handleSummary(c: Context) {
  const summary = await getAntilagSummary();
  return c.json(summary);
}

function validateSecret(
  c: Context,
  body: Record<string, unknown>,
): { status: 401 | 503; message: string } | null {
  const expected = process.env.TV_ANTILAG_WEBHOOK_SECRET;
  if (!expected) {
    return {
      status: 503,
      message: "TV_ANTILAG_WEBHOOK_SECRET is not configured",
    };
  }

  const provided =
    c.req.header("x-antilag-secret") ?? String(body.secret ?? "");
  if (provided !== expected) {
    return { status: 401, message: "Invalid Antilag webhook secret" };
  }
  return null;
}
