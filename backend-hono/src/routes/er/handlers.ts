import type { Context } from "hono";
import {
  evaluateOvertrading,
  listSessions,
  saveSession,
  saveSnapshot,
} from "../../services/er-service.js";

function getUserId(c: Context): string | null {
  const userId = c.get("userId") as string | undefined;
  return userId ?? null;
}

export async function handleGetSessions(c: Context) {
  const userId = getUserId(c);
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const limitRaw = c.req.query("limit");
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;

  try {
    const sessions = await listSessions(userId, {
      limit: Number.isFinite(limit) ? limit : undefined,
    });
    return c.json({ sessions });
  } catch (error) {
    console.error("[ER] Failed to fetch sessions:", error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch ER sessions";
    return c.json({ error: message }, 500);
  }
}

export async function handleSaveSession(c: Context) {
  const userId = getUserId(c);
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req
    .json<{
      sessionId?: number;
      finalScore?: number;
      timeInTiltSeconds?: number;
      infractionCount?: number;
      sessionDurationSeconds?: number;
      maxTiltScore?: number;
      maxTiltTime?: string;
    }>()
    .catch(() => null);

  if (!body) {
    return c.json({ error: "Invalid body" }, 400);
  }

  const finalScore = Number(body.finalScore ?? 0);
  const timeInTiltSeconds = Number(body.timeInTiltSeconds ?? 0);
  const infractionCount = Number(body.infractionCount ?? 0);
  const sessionDurationSeconds = Number(body.sessionDurationSeconds ?? 0);

  if (
    !Number.isFinite(finalScore) ||
    !Number.isFinite(timeInTiltSeconds) ||
    !Number.isFinite(infractionCount) ||
    !Number.isFinite(sessionDurationSeconds)
  ) {
    return c.json({ error: "Invalid numeric ER session fields" }, 400);
  }

  try {
    const result = await saveSession(userId, {
      sessionId:
        typeof body.sessionId === "number" ? body.sessionId : undefined,
      finalScore,
      timeInTiltSeconds,
      infractionCount,
      sessionDurationSeconds,
      maxTiltScore:
        typeof body.maxTiltScore === "number" ? body.maxTiltScore : undefined,
      maxTiltTime:
        typeof body.maxTiltTime === "string" ? body.maxTiltTime : undefined,
    });

    return c.json({
      sessionId: result.sessionId,
      finalized: result.finalized,
    });
  } catch (error) {
    console.error("[ER] Failed to save session:", error);
    const message =
      error instanceof Error ? error.message : "Failed to save ER session";
    return c.json({ error: message }, 500);
  }
}

export async function handleSaveSnapshot(c: Context) {
  const userId = getUserId(c);
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req
    .json<{
      sessionId?: number;
      score?: number;
      state?: "stable" | "neutral" | "tilt";
      audioLevels?: string;
      keywords?: string[];
    }>()
    .catch(() => null);

  if (!body?.sessionId || typeof body.score !== "number" || !body.state) {
    return c.json({ error: "sessionId, score, and state are required" }, 400);
  }

  if (!["stable", "neutral", "tilt"].includes(body.state)) {
    return c.json({ error: "Invalid ER state" }, 400);
  }

  try {
    const result = await saveSnapshot(userId, {
      sessionId: body.sessionId,
      score: body.score,
      state: body.state,
      audioLevels:
        typeof body.audioLevels === "string" ? body.audioLevels : undefined,
      keywords: Array.isArray(body.keywords) ? body.keywords : undefined,
    });

    return c.json({ snapshotId: result.snapshotId });
  } catch (error) {
    console.error("[ER] Failed to save snapshot:", error);
    const message =
      error instanceof Error ? error.message : "Failed to save ER snapshot";
    return c.json({ error: message }, 500);
  }
}

export async function handleCheckOvertrading(c: Context) {
  const userId = getUserId(c);
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body: { windowMinutes?: number; threshold?: number } = await c.req
    .json<{
      windowMinutes?: number;
      threshold?: number;
    }>()
    .catch(() => ({}) as { windowMinutes?: number; threshold?: number });

  try {
    const result = await evaluateOvertrading(userId, {
      windowMinutes:
        typeof body.windowMinutes === "number" ? body.windowMinutes : undefined,
      threshold:
        typeof body.threshold === "number" ? body.threshold : undefined,
    });

    return c.json(result);
  } catch (error) {
    console.error("[ER] Failed to check overtrading:", error);
    const message =
      error instanceof Error ? error.message : "Failed to check overtrading";
    return c.json({ error: message }, 500);
  }
}
