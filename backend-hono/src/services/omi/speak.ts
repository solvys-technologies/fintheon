// [claude-code 2026-04-20] S28-T1: single funnel for agent → user speech.
// All agent-originated voice output routes through Omi's Notifications API
// with `speak: true`. Returns silently if the user isn't paired or the text
// is empty — never falls back to browser TTS.

import { getSupabaseClient } from "../../config/supabase.js";
import { createLogger } from "../../lib/logger.js";
import { sendNotification } from "./client.js";

const log = createLogger("OmiSpeak");

export async function speakToUser(
  userId: string,
  text: string,
  title?: string,
): Promise<void> {
  const message = text?.trim();
  if (!userId || !message) return;

  const sb = getSupabaseClient();
  if (!sb) return;

  const { data } = await sb
    .from("omi_pairings")
    .select("omi_uid")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data?.omi_uid) {
    log.info("speakToUser skipped — no omi pairing", { userId });
    return;
  }

  try {
    await sendNotification({
      uid: data.omi_uid,
      title,
      message,
      speak: true,
    });
  } catch (err) {
    log.warn("speakToUser failed (non-fatal)", { error: String(err) });
  }
}
