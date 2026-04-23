/**
 * Harper Vision — Backend-local types
 * [claude-code 2026-04-23] Copied from shared/ to satisfy rootDir constraint.
 */

export interface HarperVisionFrame {
  timestamp: string;
  base64: string;
  width: number;
  height: number;
  displayId: string;
  appName?: string;
  windowTitle?: string;
  frameIndex: number;
}

export interface HarperVisionFrameIngest {
  sessionId: string;
  frames: HarperVisionFrame[];
}

export interface HarperVisionFrameRecord {
  id: string;
  user_id: string;
  session_id: string;
  timestamp: string;
  app_name: string | null;
  window_title: string | null;
  image_path: string | null;
  description: string | null;
  description_embedding: number[] | null;
  display_id: string | null;
  created_at: string;
}

export interface HarperVisionTranscript {
  id: string;
  user_id: string;
  session_id: string;
  timestamp: string;
  transcript: string;
  speaker_label: string | null;
  confidence: number | null;
  prosody: Record<string, unknown> | null;
  created_at: string;
}

export interface HarperVisionScene {
  timestamp: string;
  sessionId: string;
  summary: string;
  frames: Pick<HarperVisionFrameRecord, "id" | "timestamp" | "description">[];
  transcripts: Pick<HarperVisionTranscript, "id" | "timestamp" | "transcript" | "speaker_label">[];
}

export interface HarperVisionTrigger {
  type: "chart_pattern" | "news_event" | "risk_alert" | "trade_opportunity" | "harper_query";
  confidence: number;
  agent?: "oracle" | "feucht" | "consul" | "herald" | "harper";
  symbol?: string;
  timeframe?: string;
  headline?: string;
  description?: string;
  setup?: string;
}
