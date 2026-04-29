// [claude-code 2026-04-20] S21-T1/T2: Harper Voice (formerly Omi) integration routes.
// Public webhook endpoints (no Fintheon JWT — request authenticity is the
// `uid` query param issued by Omi at OAuth time) + authed session endpoints.
//
// Mounted at /api/harper-voice in routes/index.ts. Webhook paths are NOT gated by
// authMiddleware; session + pair paths are.

import { Hono } from "hono";
import type { Context } from "hono";
import { authMiddleware, requireAuth } from "../middleware/auth.js";
import { createLogger } from "../lib/logger.js";
import { getSupabaseClient } from "../config/supabase.js";
import {
  appendTranscript,
  endSession,
  getActiveSession,
  resolveUserIdForHarperVoiceUid,
  setPrimaryAgent,
  startSession,
} from "../services/harper-voice/session-manager.js";
import type {
  HarperVoiceMemoryWebhookBody,
  HarperVoiceTranscriptWebhookBody,
  HarperVoiceTrigger,
} from "../services/harper-voice/types.js";
import { routeIntent } from "../services/harper-voice/router.js";
import {
  computeFeatures,
  persistSample,
} from "../services/prosody/extractor.js";
import { sendNotification } from "../services/harper-voice/client.js";

const log = createLogger("HarperVoiceRoutes");

const VALID_TRIGGERS: readonly HarperVoiceTrigger[] = [
  "psych_assist",
  "voice_assistant",
  "performance_chat",
];

export function createHarperVoiceRoutes() {
  const router = new Hono();

  // ── PUBLIC WEBHOOK ENDPOINTS ────────────────────────────────────────────
  // Identified by `uid` query param issued by Omi OAuth; we resolve it to a
  // Fintheon user via omi_pairings. Omi retries 5xx so we fail fast on bad
  // payloads rather than silently dropping.

  router.post("/webhook/transcript", async (c: Context) => {
    const uid = c.req.query("uid");
    if (!uid) return c.json({ error: "missing uid" }, 400);

    const userId = await resolveUserIdForHarperVoiceUid(uid);
    if (!userId) {
      log.warn("transcript webhook from unpaired uid", { uid });
      return c.json({ error: "uid not paired" }, 404);
    }

    const body = (await c.req
      .json()
      .catch(() => null)) as HarperVoiceTranscriptWebhookBody | null;
    if (!body || !Array.isArray(body.segments)) {
      return c.json({ error: "bad body" }, 400);
    }

    const sessionId = await appendTranscript(userId, body.segments);

    // Opportunistic routing: re-classify on each transcript batch so the
    // active agent can change mid-session (e.g. user asks a market Q during
    // a performance_chat coaching conversation → handoff to Oracle).
    const session = getActiveSession(userId);
    if (session) {
      const utterance = body.segments
        .filter((s) => s.is_user !== false)
        .map((s) => s.text)
        .join(" ")
        .trim();
      if (utterance) {
        const intent = routeIntent(session.trigger, utterance);
        if (intent.agent !== session.primaryAgent) {
          setPrimaryAgent(userId, intent.agent);
          log.info("agent handoff", {
            sessionId: session.id,
            from: session.primaryAgent,
            to: intent.agent,
            reason: intent.reason,
          });
        }

        // Prosody from transcript only (no PCM here). The /webhook/audio
        // endpoint adds the energy dimension when audio bytes arrive.
        if (sessionId) {
          const features = computeFeatures(null, utterance);
          if (features.frustration > 0)
            await persistSample(sessionId, features);
          if (features.arousal >= 0.5) {
            // Signal the frontend tilt UI via a realtime channel. For v1 we
            // just log — the PsychAssist UI polls its own ER endpoint.
            log.info("tilt signal", {
              userId,
              arousal: features.arousal,
              frustration: features.frustration,
            });
          }
        }
      }
    }

    return c.json({ ok: true, sessionId });
  });

  router.post("/webhook/audio", async (c: Context) => {
    const uid = c.req.query("uid");
    if (!uid) return c.json({ error: "missing uid" }, 400);
    const userId = await resolveUserIdForHarperVoiceUid(uid);
    if (!userId) return c.json({ error: "uid not paired" }, 404);

    const session = getActiveSession(userId);
    if (!session) return c.json({ ok: true, dropped: "no active session" });

    const buf = await c.req.arrayBuffer();
    const pcm = new Uint8Array(buf);
    const features = computeFeatures(pcm, "");
    await persistSample(session.id, features);
    return c.json({ ok: true });
  });

  // Day Summary — Omi's end-of-day aggregate. Stored as a sessions row with a
  // synthetic `day_summary` trigger so the Performance journal can surface it
  // without a new table. Not tied to an active session.
  router.post("/webhook/day-summary", async (c: Context) => {
    const uid = c.req.query("uid");
    if (!uid) return c.json({ error: "missing uid" }, 400);
    const userId = await resolveUserIdForHarperVoiceUid(uid);
    if (!userId) return c.json({ error: "uid not paired" }, 404);

    const body = (await c.req.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (!body) return c.json({ error: "bad body" }, 400);

    const sb = getSupabaseClient();
    if (sb) {
      await sb.from("omi_sessions").insert({
        user_id: userId,
        trigger: "psych_assist",
        primary_agent: "coach",
        status: "ended",
        started_at: new Date().toISOString(),
        ended_at: new Date().toISOString(),
        transcript_snapshot: body,
        metadata: { kind: "day_summary" },
      });
    }
    return c.json({ ok: true });
  });

  router.post("/webhook/memory", async (c: Context) => {
    const uid = c.req.query("uid");
    if (!uid) return c.json({ error: "missing uid" }, 400);
    const userId = await resolveUserIdForHarperVoiceUid(uid);
    if (!userId) return c.json({ error: "uid not paired" }, 404);

    const body = (await c.req
      .json()
      .catch(() => null)) as HarperVoiceMemoryWebhookBody | null;
    if (!body) return c.json({ error: "bad body" }, 400);

    const sb = getSupabaseClient();
    if (sb) {
      // Attach the memory snapshot to the most-recent session for this user.
      // When there's no active session (trader wasn't actively using Fintheon
      // during the conversation), skip persistence — the Performance journal
      // only cares about in-app sessions for now.
      const session = getActiveSession(userId);
      if (session) {
        await sb
          .from("omi_sessions")
          .update({ transcript_snapshot: body })
          .eq("id", session.id);
      }
    }

    return c.json({ ok: true });
  });

  // ── AUTHED ENDPOINTS ────────────────────────────────────────────────────
  router.use("/session/*", authMiddleware, requireAuth);
  router.use("/pair/*", authMiddleware, requireAuth);
  router.use("/pairing", authMiddleware, requireAuth);

  router.post("/session/start", async (c: Context) => {
    const userId = c.get("userId") as string;
    const body = (await c.req.json().catch(() => ({}))) as {
      trigger?: string;
    };
    const trigger = body.trigger as HarperVoiceTrigger;
    if (!VALID_TRIGGERS.includes(trigger)) {
      return c.json({ error: "invalid trigger", allowed: VALID_TRIGGERS }, 400);
    }
    const session = await startSession(userId, trigger);
    return c.json({ session });
  });

  router.post("/session/stop", async (c: Context) => {
    const userId = c.get("userId") as string;
    const session = await endSession(userId, "ended");
    return c.json({ session });
  });

  router.get("/session/active", async (c: Context) => {
    const userId = c.get("userId") as string;
    const session = getActiveSession(userId);
    return c.json({ session: session ?? null });
  });

  router.get("/pairing", async (c: Context) => {
    const userId = c.get("userId") as string;
    const sb = getSupabaseClient();
    if (!sb) return c.json({ pairing: null });
    const { data } = await sb
      .from("omi_pairings")
      .select("omi_uid, paired_at")
      .eq("user_id", userId)
      .maybeSingle();
    return c.json({ pairing: data ?? null });
  });

  router.post("/pair/manual", async (c: Context) => {
    // Temporary manual-pair endpoint while OAuth app registration is in flight.
    // Accepts { omi_uid } and stores it so the webhook resolver can map uid → userId.
    // OAuth replaces this in a follow-up.
    const userId = c.get("userId") as string;
    const body = (await c.req.json().catch(() => ({}))) as {
      omi_uid?: string;
    };
    const omiUid = body.omi_uid?.trim();
    if (!omiUid) return c.json({ error: "omi_uid required" }, 400);
    const sb = getSupabaseClient();
    if (!sb) return c.json({ error: "database unavailable" }, 503);
    const { error } = await sb.from("omi_pairings").upsert({
      user_id: userId,
      omi_uid: omiUid,
      updated_at: new Date().toISOString(),
    });
    if (error) return c.json({ error: error.message }, 500);
    return c.json({ ok: true });
  });

  router.delete("/pairing", async (c: Context) => {
    const userId = c.get("userId") as string;
    const sb = getSupabaseClient();
    if (!sb) return c.json({ ok: true });
    await sb.from("omi_pairings").delete().eq("user_id", userId);
    return c.json({ ok: true });
  });

  // ── NOTIFICATIONS (agent → earbuds) ────────────────────────────────────
  router.post("/notify", async (c: Context) => {
    const userId = c.get("userId") as string;
    const body = (await c.req.json().catch(() => ({}))) as {
      title?: string;
      message?: string;
      speak?: boolean;
    };
    if (!body.message) return c.json({ error: "message required" }, 400);

    const sb = getSupabaseClient();
    if (!sb) return c.json({ error: "database unavailable" }, 503);
    const { data } = await sb
      .from("omi_pairings")
      .select("omi_uid")
      .eq("user_id", userId)
      .maybeSingle();
    if (!data?.omi_uid) return c.json({ error: "not paired" }, 404);

    const ok = await sendNotification({
      uid: data.omi_uid,
      title: body.title,
      message: body.message,
      speak: body.speak,
    });
    return c.json({ ok });
  });

  return router;
}
