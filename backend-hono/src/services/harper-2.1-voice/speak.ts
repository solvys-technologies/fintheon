// [claude-code 2026-04-20] S28-T1: Agent→User speech helper.
// All agent-to-user audio routes through Harper 2.1 Voice's Notifications API with speak=true.
// Browser speechSynthesis is no longer used anywhere in the app.
import { getSupabaseClient } from "../../config/supabase.js";
import { createLogger } from "../../lib/logger.js";
import { sendNotification } from "./client.js";

const log = createLogger("Harper21VoiceSpeak");

/**
 * Speak `text` into the user's Omi earbuds via the Notifications API.
 * Silently no-ops if the user isn't paired or supabase is unavailable —
 * we never substitute a browser voice.
 */
export async function speakToUser(
  userId: string,
  text: string,
): Promise<boolean> {
  const message = text.trim();
  if (!message) return false;

  const sb = getSupabaseClient();
  if (!sb) {
    log.info("supabase unavailable — skipping Omi speak");
    return false;
  }

  const { data } = await sb
    .from("omi_pairings")
    .select("omi_uid")
    .eq("user_id", userId)
    .maybeSingle();

  const uid = data?.omi_uid;
  if (!uid) {
    log.info("user not paired with Omi — skipping speak", { userId });
    return false;
  }

  return sendNotification({ uid, message, speak: true });
}
