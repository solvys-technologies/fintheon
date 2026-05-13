// [claude-code 2026-05-13] Lockout route — GET /status, POST /toggle, POST /set
import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import { getLockout, setLockout } from "../../services/lockout.js";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("lockout-route");

const ToggleSchema = z.object({
  locked: z.boolean(),
  durationMinutes: z.number().int().min(1).max(480).optional(),
});

const SetSchema = z.object({
  durationMinutes: z.number().int().min(1).max(480).default(30),
});

function getUserId(c: Context): string {
  try {
    return (c.get("userId") as string) || "default";
  } catch {
    return "default";
  }
}

export function createLockoutRoutes() {
  const app = new Hono();

  app.get("/status", async (c) => {
    const state = getLockout(getUserId(c));
    return c.json({ ok: true, ...state });
  });

  app.post("/toggle", async (c) => {
    try {
      const body = ToggleSchema.parse(await c.req.json());
      const state = setLockout(
        getUserId(c),
        body.locked,
        body.durationMinutes ? body.durationMinutes * 60 * 1000 : undefined,
      );
      return c.json({ ok: true, ...state });
    } catch (err) {
      return c.json(
        {
          ok: false,
          reason: err instanceof Error ? err.message : "invalid body",
        },
        400,
      );
    }
  });

  app.post("/set", async (c) => {
    try {
      const body = SetSchema.parse(await c.req.json());
      const state = setLockout(
        getUserId(c),
        true,
        body.durationMinutes * 60 * 1000,
      );
      return c.json({ ok: true, ...state });
    } catch (err) {
      return c.json(
        {
          ok: false,
          reason: err instanceof Error ? err.message : "invalid body",
        },
        400,
      );
    }
  });

  return app;
}
