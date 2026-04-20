// [claude-code 2026-04-20] S21-T2: Omi session manager.
// Tracks active voice sessions per user. One active session per user at a time.
// Session state lives in-memory for hot path (status, current agent) + persisted
// to Supabase for transcript snapshots and post-session Performance journal review.

import { randomUUID } from "node:crypto";
import { getSupabaseClient } from "../../config/supabase.js";
import { createLogger } from "../../lib/logger.js";
import type {
  OmiPrimaryAgent,
  OmiSession,
  OmiSessionStatus,
  OmiTrigger,
  OmiTranscriptSegment,
} from "./types.js";

const log = createLogger("OmiSessionManager");

const TRIGGER_DEFAULT_AGENT: Record<OmiTrigger, OmiPrimaryAgent> = {
  psych_assist: "coach",
  voice_assistant: "harper",
  performance_chat: "coach",
};

const active = new Map<string, OmiSession>();

export function getActiveSession(userId: string): OmiSession | undefined {
  return active.get(userId);
}

export async function startSession(
  userId: string,
  trigger: OmiTrigger,
): Promise<OmiSession> {
  const existing = active.get(userId);
  if (existing && existing.status === "active") {
    log.info("re-using active session", {
      userId,
      sessionId: existing.id,
      trigger,
    });
    return existing;
  }

  const session: OmiSession = {
    id: randomUUID(),
    userId,
    trigger,
    primaryAgent: TRIGGER_DEFAULT_AGENT[trigger],
    status: "active",
    startedAt: new Date().toISOString(),
  };

  active.set(userId, session);

  const sb = getSupabaseClient();
  if (sb) {
    const { error } = await sb.from("omi_sessions").insert({
      id: session.id,
      user_id: userId,
      trigger,
      primary_agent: session.primaryAgent,
      status: "active",
      started_at: session.startedAt,
    });
    if (error) log.warn("persist session failed", { error: error.message });
  }

  log.info("session started", {
    userId,
    sessionId: session.id,
    trigger,
    agent: session.primaryAgent,
  });
  return session;
}

export async function endSession(
  userId: string,
  status: OmiSessionStatus = "ended",
): Promise<OmiSession | null> {
  const session = active.get(userId);
  if (!session) return null;

  session.status = status;
  session.endedAt = new Date().toISOString();
  active.delete(userId);

  const sb = getSupabaseClient();
  if (sb) {
    await sb
      .from("omi_sessions")
      .update({ status, ended_at: session.endedAt })
      .eq("id", session.id);
  }

  log.info("session ended", { userId, sessionId: session.id, status });
  return session;
}

export function setPrimaryAgent(userId: string, agent: OmiPrimaryAgent): void {
  const s = active.get(userId);
  if (s) s.primaryAgent = agent;
}

/**
 * Append transcript segments to the active session (called from the Omi
 * real-time transcript webhook). Returns the session id or null when there is
 * no active session — in which case segments are dropped (Omi also keeps them).
 */
export async function appendTranscript(
  userId: string,
  segments: OmiTranscriptSegment[],
): Promise<string | null> {
  const session = active.get(userId);
  if (!session) return null;

  const sb = getSupabaseClient();
  if (!sb || segments.length === 0) return session.id;

  const rows = segments.map((s) => ({
    session_id: session.id,
    speaker: s.speaker ?? null,
    speaker_id: s.speakerId ?? null,
    is_user: s.is_user ?? false,
    text: s.text,
    start_ms: typeof s.start === "number" ? Math.round(s.start * 1000) : null,
    end_ms: typeof s.end === "number" ? Math.round(s.end * 1000) : null,
  }));

  const { error } = await sb.from("omi_transcript_segments").insert(rows);
  if (error) log.warn("persist transcript failed", { error: error.message });

  return session.id;
}

/**
 * Look up a session by its Omi `uid` → Fintheon user mapping. The webhook
 * receiver uses this to resolve which user a webhook call belongs to.
 */
export async function resolveUserIdForOmiUid(
  omiUid: string,
): Promise<string | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;
  const { data } = await sb
    .from("omi_pairings")
    .select("user_id")
    .eq("omi_uid", omiUid)
    .maybeSingle();
  return data?.user_id ?? null;
}
