// [claude-code 2026-04-23] S32-T2 Harper Vision — real status from Supabase
/**
 * Reports the active Harper Vision session state for a user by querying
 * the most recent frames and transcripts directly from Supabase.
 * Capture is considered active if a frame has arrived within the last 30s.
 */
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
);

const ACTIVE_WINDOW_MS = 30_000;

export interface HarperVisionStatus {
  screen: {
    isCapturing: boolean;
    sessionId: string | null;
    frameCounter: number;
  };
  audio: {
    isRecording: boolean;
    sessionId: string | null;
  };
  lastFrameAt: string | null;
  lastTranscriptAt: string | null;
}

export async function getVisionStatus(
  userId: string,
): Promise<HarperVisionStatus> {
  const sinceActive = new Date(Date.now() - ACTIVE_WINDOW_MS).toISOString();

  const { data: recentFrames } = await supabase
    .from("harper_vision_frames")
    .select("id, timestamp, session_id")
    .eq("user_id", userId)
    .gte("timestamp", sinceActive)
    .order("timestamp", { ascending: false });

  const { data: latestTranscript } = await supabase
    .from("harper_vision_transcripts")
    .select("timestamp, session_id")
    .eq("user_id", userId)
    .order("timestamp", { ascending: false })
    .limit(1)
    .maybeSingle();

  const latestFrame = recentFrames?.[0] ?? null;
  const frameCount = recentFrames?.length ?? 0;
  const isCapturing = frameCount > 0;

  const sinceActiveMs = Date.now() - ACTIVE_WINDOW_MS;
  const isRecording = latestTranscript
    ? new Date(latestTranscript.timestamp).getTime() > sinceActiveMs
    : false;

  return {
    screen: {
      isCapturing,
      sessionId: latestFrame?.session_id ?? null,
      frameCounter: frameCount,
    },
    audio: {
      isRecording,
      sessionId: latestTranscript?.session_id ?? null,
    },
    lastFrameAt: latestFrame?.timestamp ?? null,
    lastTranscriptAt: latestTranscript?.timestamp ?? null,
  };
}
