// [claude-code 2026-05-13] Lockout route — GET /status, POST /toggle, POST /set, POST /schedule, GET /next-window
// [claude-code 2026-05-13] S64 T3: Added POST /schedule, GET /next-window, windowStartTime on toggle
import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import {
  getLockout,
  setLockout,
  scheduleAutoRelease,
} from "../../services/lockout.js";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("lockout-route");

const ToggleSchema = z.object({
  locked: z.boolean(),
  durationMinutes: z.number().int().min(1).max(480).optional(),
  windowStartTime: z.string().optional(),
});

const SetSchema = z.object({
  durationMinutes: z.number().int().min(1).max(480).default(30),
});

const ScheduleSchema = z.object({
  lockUntil: z.string().optional(),
  windowStartTime: z.string().optional(),
  durationMinutes: z.number().int().min(1).max(480).optional(),
  autoReleaseMinutes: z.number().int().min(0).max(120).optional(),
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
      const userId = getUserId(c);

      if (body.locked) {
        // Compute auto-release if windowStartTime provided
        let autoReleaseAt: string | undefined;
        if (body.windowStartTime) {
          autoReleaseAt =
            scheduleAutoRelease(userId, body.windowStartTime) ?? undefined;
        }
        const state = setLockout(
          userId,
          true,
          body.durationMinutes ? body.durationMinutes * 60 * 1000 : undefined,
          { autoReleaseAt, scheduledBy: "manual" },
        );
        return c.json({ ok: true, ...state });
      }

      const state = setLockout(userId, false);
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
        { scheduledBy: "manual" },
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

  /**
   * POST /api/lockout/schedule
   * Accepts { lockUntil: string } or { windowStartTime: string }.
   * Sets lockout with auto-release timestamp.
   */
  app.post("/schedule", async (c) => {
    try {
      const body = ScheduleSchema.parse(await c.req.json());
      const userId = getUserId(c);

      if (body.lockUntil && body.windowStartTime) {
        return c.json(
          {
            ok: false,
            reason: "Provide lockUntil OR windowStartTime, not both",
          },
          400,
        );
      }

      if (body.lockUntil) {
        const untilMs = new Date(body.lockUntil).getTime();
        if (isNaN(untilMs)) {
          return c.json(
            { ok: false, reason: "Invalid lockUntil timestamp" },
            400,
          );
        }
        const now = Date.now();
        const durationMs = Math.max(untilMs - now, 60_000); // at least 1 minute
        const state = setLockout(userId, true, durationMs, {
          autoReleaseAt: body.lockUntil,
          scheduledBy: "system",
        });
        return c.json({ ok: true, ...state });
      }

      if (body.windowStartTime) {
        const autoReleaseAt = scheduleAutoRelease(
          userId,
          body.windowStartTime,
          body.autoReleaseMinutes,
        );
        if (!autoReleaseAt) {
          return c.json(
            { ok: false, reason: "Invalid windowStartTime timestamp" },
            400,
          );
        }
        const releaseMs = new Date(autoReleaseAt).getTime();
        const durationMs = body.durationMinutes
          ? body.durationMinutes * 60 * 1000
          : Math.max(releaseMs - Date.now(), 60_000);
        const state = setLockout(userId, true, durationMs, {
          autoReleaseAt,
          scheduledBy: "desk_plan",
        });
        return c.json({ ok: true, ...state });
      }

      if (body.durationMinutes) {
        const state = setLockout(
          userId,
          true,
          body.durationMinutes * 60 * 1000,
          { scheduledBy: "system" },
        );
        return c.json({ ok: true, ...state });
      }

      return c.json(
        {
          ok: false,
          reason: "Provide lockUntil, windowStartTime, or durationMinutes",
        },
        400,
      );
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

  /**
   * GET /api/lockout/next-window
   * Returns next scheduled window info from the current lockout state.
   */
  app.get("/next-window", async (c) => {
    const state = getLockout(getUserId(c));
    return c.json({
      ok: true,
      locked: state.locked,
      autoReleaseAt: state.autoReleaseAt ?? null,
      scheduledBy: state.scheduledBy ?? null,
      until: state.until,
      remaining: state.remaining,
    });
  });

  return app;
}
