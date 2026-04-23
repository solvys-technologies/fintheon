// [claude-code 2026-04-23] S32-T2 Harper Vision — dispatch triggers, real status endpoint
/**
 * Harper Vision Routes
 * Screen + audio ingestion, scene building, and trigger detection
 * Inspired by OMI's screen_activity.rs + transcribe.py patterns
 */

import { Hono } from "hono";
import { authMiddleware, requireAuth } from "../../middleware/auth.js";
import {
  ingestFrames,
  getRecentFrames,
  getFrameById,
} from "../../services/harper-vision/frame-store.js";
import {
  buildScene,
  detectTriggers,
  ingestAudioChunk,
} from "../../services/harper-vision/engine.js";
import { dispatchTriggers } from "../../services/harper-vision/dispatcher.js";
import { getVisionStatus } from "../../services/harper-vision/status.js";
import type { HarperVisionFrameIngest } from "../../types/harper-vision.js";

export function createHarperVisionRoutes() {
  const app = new Hono();

  // POST /api/harper-vision/frames — Ingest screen capture frames
  app.post("/frames", async (c) => {
    try {
      const body = (await c.req.json()) as HarperVisionFrameIngest;

      // Basic validation
      if (!body.sessionId || !Array.isArray(body.frames)) {
        return c.json({ ok: false, error: "Invalid payload" }, 400);
      }

      const userId = (c.get("userId" as never) as string) || "anonymous";

      const result = await ingestFrames(userId, body);

      return c.json({ ok: true, ingested: result.count });
    } catch (err: any) {
      console.error("[HarperVision] Frame ingest error:", err.message);
      return c.json({ ok: false, error: err.message }, 500);
    }
  });

  // GET /api/harper-vision/frames — Retrieve recent frames
  app.get("/frames", authMiddleware, requireAuth, async (c) => {
    try {
      const userId = (c.get("userId" as never) as string) || "anonymous";
      const sessionId = c.req.query("sessionId") || undefined;
      const limit = Math.min(parseInt(c.req.query("limit") || "20", 10), 100);

      const frames = await getRecentFrames(userId, { sessionId, limit });
      return c.json({ ok: true, frames });
    } catch (err: any) {
      console.error("[HarperVision] Frame retrieval error:", err.message);
      return c.json({ ok: false, error: err.message }, 500);
    }
  });

  // GET /api/harper-vision/frames/:id — Single frame detail
  app.get("/frames/:id", authMiddleware, requireAuth, async (c) => {
    try {
      const userId = (c.get("userId" as never) as string) || "anonymous";
      const frame = await getFrameById(c.req.param("id"), userId);
      if (!frame) return c.json({ ok: false, error: "Not found" }, 404);
      return c.json({ ok: true, frame });
    } catch (err: any) {
      return c.json({ ok: false, error: err.message }, 500);
    }
  });

  // GET /api/harper-vision/scene — Build current scene from recent frames + transcripts
  app.get("/scene", authMiddleware, requireAuth, async (c) => {
    try {
      const userId = (c.get("userId" as never) as string) || "anonymous";
      const sessionId = c.req.query("sessionId") || undefined;
      const lookbackSeconds = Math.min(
        parseInt(c.req.query("lookback") || "60", 10),
        300,
      );

      const scene = await buildScene(userId, { sessionId, lookbackSeconds });
      return c.json({ ok: true, scene });
    } catch (err: any) {
      console.error("[HarperVision] Scene build error:", err.message);
      return c.json({ ok: false, error: err.message }, 500);
    }
  });

  // POST /api/harper-vision/triggers — Detect triggers from recent activity
  app.post("/triggers", authMiddleware, requireAuth, async (c) => {
    try {
      const userId = (c.get("userId" as never) as string) || "anonymous";
      const sessionId = c.req.query("sessionId") || undefined;
      const lookbackSeconds = Math.min(
        parseInt(c.req.query("lookbackSeconds") || "60", 10),
        300,
      );

      const triggers = await detectTriggers(userId, {
        sessionId,
        lookbackSeconds,
      });
      return c.json({ ok: true, triggers });
    } catch (err: any) {
      console.error("[HarperVision] Trigger detection error:", err.message);
      return c.json({ ok: false, error: err.message }, 500);
    }
  });

  // POST /api/harper-vision/audio-chunk — Ingest audio chunk for transcription
  app.post("/audio-chunk", async (c) => {
    try {
      const body = await c.req.json();
      if (!body.sessionId || !body.audioBase64) {
        return c.json(
          { ok: false, error: "sessionId and audioBase64 required" },
          400,
        );
      }

      const user = (c.get("userId" as never) as string) || "anonymous";
      const result = await ingestAudioChunk(user, body);
      return c.json(result);
    } catch (err: any) {
      console.error("[HarperVision] Audio chunk error:", err.message);
      return c.json({ ok: false, error: err.message }, 500);
    }
  });

  // GET /api/harper-vision/status — Overall vision system status
  app.get("/status", authMiddleware, requireAuth, async (c) => {
    try {
      const userId = (c.get("userId" as never) as string) || "anonymous";

      // TODO: Query actual capture status from session store
      return c.json({
        ok: true,
        status: {
          screen: { isCapturing: false, sessionId: null, frameCounter: 0 },
          audio: { isRecording: false, sessionId: null, mode: "placeholder" },
          lastFrameAt: null,
          lastTranscriptAt: null,
        },
      });
    } catch (err: any) {
      return c.json({ ok: false, error: err.message }, 500);
    }
  });

  return app;
}
