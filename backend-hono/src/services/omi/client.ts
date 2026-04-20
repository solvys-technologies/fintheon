// [claude-code 2026-04-20] S21-T1: Omi REST + Notifications API wrapper.
// All outbound calls to Omi cloud go through here so rate-limit handling + auth live in one spot.
// Docs: https://docs.omi.me — REST at https://api.omi.me/v1/dev with Bearer `omi_dev_...` keys.

import { createLogger } from "../../lib/logger.js";
import type { OmiNotificationPayload, OmiTranscriptSegment } from "./types.js";

const log = createLogger("OmiClient");

const OMI_API_BASE = process.env.OMI_API_BASE || "https://api.omi.me/v1/dev";

function apiKey(): string {
  const key = process.env.OMI_DEV_API_KEY || "";
  if (!key) {
    log.warn("OMI_DEV_API_KEY not set — Omi client calls will fail");
  }
  return key;
}

async function omiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T | null> {
  const key = apiKey();
  if (!key) return null;

  try {
    const res = await fetch(`${OMI_API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
    });
    if (!res.ok) {
      log.error(`Omi API ${path} failed`, {
        status: res.status,
        body: await res.text().catch(() => ""),
      });
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    log.error(`Omi API ${path} threw`, { error: String(err) });
    return null;
  }
}

export async function listConversations(uid: string, limit = 20) {
  return omiFetch<{ conversations: unknown[] }>(
    `/user/conversations?uid=${encodeURIComponent(uid)}&limit=${limit}`,
  );
}

export async function createConversationFromSegments(
  uid: string,
  segments: OmiTranscriptSegment[],
) {
  return omiFetch("/user/conversations/from-segments", {
    method: "POST",
    body: JSON.stringify({ uid, segments }),
  });
}

/**
 * Send an in-ear notification to the user's Omi. When `speak=true` Omi reads
 * the message aloud via its built-in TTS — which is our primary voice-response
 * path in S21 (ElevenLabs is explicitly out of scope for v1).
 */
export async function sendNotification(
  payload: OmiNotificationPayload,
): Promise<boolean> {
  const res = await omiFetch<{ ok: boolean }>("/user/notifications", {
    method: "POST",
    body: JSON.stringify({
      uid: payload.uid,
      title: payload.title,
      message: payload.message,
      speak: payload.speak ?? true,
    }),
  });
  return !!res;
}
