// [claude-code 2026-03-24] Added ER event persistence endpoints (er-event, er-history)
// [claude-code 2026-03-23] Added assess, dismiss-lockout, and debrief routes
import { Hono } from "hono";
import type { Context } from "hono";
import { authMiddleware } from "../middleware/auth.js";
import { createPsychAssistService } from "../services/psych-assist-service.js";
import type { TiltDetectorContext } from "../services/psych-assist-service.js";
import { writeEREvent, readEREvents } from "../services/supabase-service.js";

const service = createPsychAssistService();

interface AuthPayload {
  sub?: string;
  user_id?: string;
  userId?: string;
}

const getUserId = (c: Context): string | null => {
  const payload = c.get("auth") as AuthPayload | undefined;
  return payload?.sub ?? payload?.user_id ?? payload?.userId ?? null;
};

export const createPsychAssistRoutes = () => {
  const router = new Hono();

  router.use("*", authMiddleware);

  router.get("/profile", async (c) => {
    const userId = getUserId(c);
    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const profile = await service.getProfile(userId);
    return c.json({ profile });
  });

  router.put("/profile", async (c) => {
    const userId = getUserId(c);
    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    let body: Record<string, unknown> = {};
    try {
      body = await c.req.json();
    } catch {
      body = {};
    }

    const blindSpots = Array.isArray(body.blindSpots)
      ? (body.blindSpots as string[])
      : undefined;
    const goal = typeof body.goal === "string" ? body.goal : undefined;
    const orientationComplete =
      body.orientationComplete === true || body.source === "orientation";

    const profile = await service.updateProfile(userId, {
      blindSpots,
      goal,
      orientationComplete,
    });

    return c.json({ profile });
  });

  router.post("/scores", async (c) => {
    const userId = getUserId(c);
    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    let body: Record<string, unknown> = {};
    try {
      body = await c.req.json();
    } catch {
      body = {};
    }

    const profile = await service.updateScores(
      userId,
      body as Record<string, unknown>,
    );
    return c.json({ profile });
  });

  // --- Tilt Detection + Lockout Protocol ---

  router.post("/assess", async (c) => {
    const userId = getUserId(c);
    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    let body: Record<string, unknown> = {};
    try {
      body = await c.req.json();
    } catch {
      body = {};
    }

    const context: TiltDetectorContext = {
      accountResetsToday: Number(body.accountResetsToday ?? 0),
      morningRoutineDone: body.morningRoutineDone === true,
      consecutiveLosses: Number(body.consecutiveLosses ?? 0),
      currentPnL: Number(body.currentPnL ?? 0),
      lastBigWin: typeof body.lastBigWin === "string" ? body.lastBigWin : null,
      evalBehavior: body.evalBehavior as TiltDetectorContext["evalBehavior"],
      fundedBehavior:
        body.fundedBehavior as TiltDetectorContext["fundedBehavior"],
    };

    const result = await service.assessTradingReadiness(userId, context);
    return c.json(result);
  });

  router.post("/dismiss-lockout", async (c) => {
    const userId = getUserId(c);
    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const session = service.dismissLockout(userId);
    return c.json({ session });
  });

  router.post("/debrief", async (c) => {
    const userId = getUserId(c);
    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    let body: Record<string, unknown> = {};
    try {
      body = await c.req.json();
    } catch {
      body = {};
    }

    const answers = (body.answers ?? {}) as Record<string, string>;
    if (Object.keys(answers).length === 0) {
      return c.json({ error: "Debrief answers required" }, 400);
    }

    const session = service.submitDebrief(userId, answers);
    return c.json({ session });
  });

  // --- ER Event Persistence (deterministic scoring engine) ---

  router.post("/er-event", async (c) => {
    const userId = getUserId(c);
    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    let body: Record<string, unknown> = {};
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid body" }, 400);
    }

    const eventType = body.eventType as string;
    if (
      !eventType ||
      !["curse", "breathing", "decay_reset"].includes(eventType)
    ) {
      return c.json({ error: "Invalid eventType" }, 400);
    }

    const penalty = Number(body.penalty ?? 0);
    const scoreBefore = Number(body.scoreBefore ?? 0);
    const scoreAfter = Number(body.scoreAfter ?? 0);
    const curseCount = Number(body.curseCount ?? 0);

    if (
      !Number.isFinite(penalty) ||
      !Number.isFinite(scoreBefore) ||
      !Number.isFinite(scoreAfter)
    ) {
      return c.json({ error: "Invalid numeric fields" }, 400);
    }

    try {
      const ok = await writeEREvent({
        user_id: userId,
        event_type: eventType,
        trigger_text:
          typeof body.triggerText === "string" ? body.triggerText : null,
        penalty,
        score_before: scoreBefore,
        score_after: scoreAfter,
        curse_count: curseCount,
        decay_window_minutes:
          typeof body.decayWindowMinutes === "number"
            ? body.decayWindowMinutes
            : null,
        transcript_snippet:
          typeof body.transcriptSnippet === "string"
            ? body.transcriptSnippet.slice(0, 200)
            : null,
      });

      return c.json({ ok });
    } catch (error) {
      console.error("[PsychAssist] Failed to write ER event:", error);
      return c.json({ error: "Failed to persist ER event" }, 500);
    }
  });

  router.get("/er-history", async (c) => {
    const userId = getUserId(c);
    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const limitRaw = c.req.query("limit");
    const limit = limitRaw ? parseInt(limitRaw, 10) : 50;

    try {
      const events = await readEREvents(
        userId,
        Number.isFinite(limit) ? limit : 50,
      );
      return c.json({ events });
    } catch (error) {
      console.error("[PsychAssist] Failed to read ER history:", error);
      return c.json({ error: "Failed to read ER history" }, 500);
    }
  });

  return router;
};

export default createPsychAssistRoutes;
