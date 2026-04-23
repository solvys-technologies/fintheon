// [claude-code 2026-04-23] S32-T2 Harper Vision refinement — drop stale result.confidence, add dispatchTriggers
/**
 * Harper Vision Engine
 * The intermediary layer between screen/audio capture and Harper + desk agents
 * Inspired by OMI's pusher.py + conversation processing pipeline
 *
 * Responsibilities:
 * 1. Correlate frames + transcripts by timestamp
 * 2. Build scene descriptions
 * 3. Detect triggers for desk agent routing
 * 4. Inject vision context into Harper prompts
 */

import { createClient } from "@supabase/supabase-js";
import type {
  HarperVisionScene,
  HarperVisionTrigger,
  HarperVisionFrameRecord,
  HarperVisionTranscript,
} from "../../types/harper-vision.js";

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Build a scene from recent frames and transcripts
 */
export async function buildScene(
  userId: string,
  options: { sessionId?: string; lookbackSeconds?: number } = {},
): Promise<HarperVisionScene> {
  const lookback = (options.lookbackSeconds || 60) * 1000;
  const since = new Date(Date.now() - lookback).toISOString();

  // Fetch recent frames
  let framesQuery = supabase
    .from("harper_vision_frames")
    .select("id, timestamp, description, app_name, window_title")
    .eq("user_id", userId)
    .gte("timestamp", since)
    .order("timestamp", { ascending: false })
    .limit(10);

  if (options.sessionId) {
    framesQuery = framesQuery.eq("session_id", options.sessionId);
  }

  const { data: frames } = await framesQuery;

  // Fetch recent transcripts
  let transcriptQuery = supabase
    .from("harper_vision_transcripts")
    .select("id, timestamp, transcript, speaker_label")
    .eq("user_id", userId)
    .gte("timestamp", since)
    .order("timestamp", { ascending: false })
    .limit(20);

  if (options.sessionId) {
    transcriptQuery = transcriptQuery.eq("session_id", options.sessionId);
  }

  const { data: transcripts } = await transcriptQuery;

  const frameList = (frames || []).map((f) => ({
    id: f.id,
    timestamp: f.timestamp,
    description:
      f.description ||
      `${f.app_name || "Unknown app"} — ${f.window_title || "Unknown window"}`,
  }));

  const transcriptList = (transcripts || []).map((t) => ({
    id: t.id,
    timestamp: t.timestamp,
    transcript: t.transcript,
    speaker_label: t.speaker_label,
  }));

  // Build summary from frame descriptions + transcript snippets
  const summary = generateSceneSummary(frameList, transcriptList);

  return {
    timestamp: new Date().toISOString(),
    sessionId: options.sessionId || "default",
    summary,
    frames: frameList,
    transcripts: transcriptList,
  };
}

function generateSceneSummary(
  frames: { description: string }[],
  transcripts: { transcript: string }[],
): string {
  const parts: string[] = [];

  if (frames.length > 0) {
    const apps = [
      ...new Set(
        frames.map((f) => f.description.split(" — ")[0]).filter(Boolean),
      ),
    ];
    if (apps.length > 0) {
      parts.push(`Active apps: ${apps.join(", ")}.`);
    }
  }

  if (transcripts.length > 0) {
    const recentText = transcripts
      .slice(0, 3)
      .map((t) => t.transcript)
      .join(" ");
    const truncated =
      recentText.length > 200 ? recentText.slice(0, 200) + "..." : recentText;
    parts.push(`Recent audio: "${truncated}"`);
  }

  if (parts.length === 0) {
    return "No recent screen or audio activity recorded.";
  }

  return parts.join(" ");
}

/**
 * Ingest an audio chunk — transcribe via Hermes sidecar and store transcript
 * Called by Electron audio capture service every 5s
 */
export async function ingestAudioChunk(
  userId: string,
  payload: {
    sessionId: string;
    audioBase64: string;
    mimeType?: string;
    timestamp?: string;
  },
): Promise<{ ok: boolean; transcript?: string; error?: string }> {
  try {
    // Transcribe via existing voice service (Hermes sidecar Whisper)
    const { transcribeVoice } = await import("../voice-service.js");
    const result = await transcribeVoice({
      audioBase64: payload.audioBase64,
      mimeType: payload.mimeType || "audio/webm",
    });

    if (!result.text || result.text.trim().length === 0) {
      return { ok: true, transcript: "" };
    }

    // Store transcript
    const { error } = await supabase.from("harper_vision_transcripts").insert({
      user_id: userId,
      session_id: payload.sessionId,
      timestamp: payload.timestamp || new Date().toISOString(),
      transcript: result.text,
      speaker_label: "USER",
      prosody: null,
    });

    if (error) {
      console.error("[HarperVision] Transcript insert error:", error.message);
    }

    return { ok: true, transcript: result.text };
  } catch (err: any) {
    console.error("[HarperVision] Audio chunk ingest error:", err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Detect triggers for desk agent routing
 * Hybrid approach: heuristics for speed, LLM for accuracy
 */
export async function detectTriggers(
  userId: string,
  options: { sessionId?: string; lookbackSeconds?: number } = {},
): Promise<HarperVisionTrigger[]> {
  const scene = await buildScene(userId, options);
  const triggers: HarperVisionTrigger[] = [];

  // Heuristic detection on transcripts
  for (const t of scene.transcripts) {
    const text = t.transcript.toLowerCase();

    // Chart pattern keywords -> Feucht
    if (
      /\b(head and shoulders|double top|double bottom|triangle|flag|pennant|support|resistance|breakout|reversal)\b/.test(
        text,
      )
    ) {
      triggers.push({
        type: "chart_pattern",
        confidence: 0.7,
        agent: "feucht",
        description: t.transcript,
      });
    }

    // News/earnings keywords -> Oracle
    if (
      /\b(earnings|fed|fomc|cpi|ppi|jobs report|unemployment|gdp|recession|inflation)\b/.test(
        text,
      )
    ) {
      triggers.push({
        type: "news_event",
        confidence: 0.75,
        agent: "oracle",
        description: t.transcript,
      });
    }

    // Risk keywords -> Herald
    if (
      /\b(vix spike|margin call|stop loss|drawdown|volatility|crash|correction)\b/.test(
        text,
      )
    ) {
      triggers.push({
        type: "risk_alert",
        confidence: 0.8,
        agent: "herald",
        description: t.transcript,
      });
    }

    // Trade setup keywords -> Consul
    if (
      /\b(entry|exit|position|long|short|buy|sell|order|fill|slippage)\b/.test(
        text,
      )
    ) {
      triggers.push({
        type: "trade_opportunity",
        confidence: 0.65,
        agent: "consul",
        description: t.transcript,
      });
    }
  }

  // Heuristic detection on frame descriptions
  for (const f of scene.frames) {
    const desc = (f.description || "").toLowerCase();

    if (/tradingview|chart|candlestick|price|ticker/.test(desc)) {
      // Check if we already have a chart_pattern trigger
      const hasChart = triggers.some((t) => t.type === "chart_pattern");
      if (!hasChart) {
        triggers.push({
          type: "chart_pattern",
          confidence: 0.5,
          agent: "feucht",
          description: f.description,
        });
      }
    }

    if (/bloomberg|news|headline|terminal/.test(desc)) {
      const hasNews = triggers.some((t) => t.type === "news_event");
      if (!hasNews) {
        triggers.push({
          type: "news_event",
          confidence: 0.5,
          agent: "oracle",
          description: f.description,
        });
      }
    }
  }

  // Deduplicate by type + agent
  const seen = new Set<string>();
  return triggers.filter((t) => {
    const key = `${t.type}-${t.agent}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Inject vision context into a Harper prompt
 * Called by harper-handler.ts or strands agent before building system prompt
 */
export async function buildVisionContext(
  userId: string,
  options: { sessionId?: string; lookbackSeconds?: number } = {},
): Promise<string> {
  const scene = await buildScene(userId, options);

  if (scene.frames.length === 0 && scene.transcripts.length === 0) {
    return "";
  }

  let context = "\n[HARPER VISION — Recent Activity]\n";
  context += scene.summary + "\n";

  if (scene.frames.length > 0) {
    context += "\nRecent screen captures:\n";
    for (const f of scene.frames.slice(0, 3)) {
      context += `- ${f.description}\n`;
    }
  }

  if (scene.transcripts.length > 0) {
    context += "\nRecent conversation:\n";
    for (const t of scene.transcripts.slice(0, 3)) {
      context += `- [${t.speaker_label || "USER"}] ${t.transcript}\n`;
    }
  }

  return context;
}
