// Harper Vision — Shared Types
// Intermediary layer contracts between Electron, backend, and frontend

export interface HarperVisionFrame {
  id?: string;
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
  transcripts: Pick<
    HarperVisionTranscript,
    "id" | "timestamp" | "transcript" | "speaker_label"
  >[];
}

export interface HarperVisionTrigger {
  type:
    | "chart_pattern"
    | "news_event"
    | "risk_alert"
    | "trade_opportunity"
    | "harper_query";
  confidence: number;
  agent?: "oracle" | "feucht" | "consul" | "herald" | "harper";
  symbol?: string;
  timeframe?: string;
  headline?: string;
  description?: string;
  setup?: string;
}

export interface HarperVisionStatusResponse {
  screen: {
    isCapturing: boolean;
    sessionId: string | null;
    frameCounter: number;
    intervalMs: number;
  };
  audio: {
    isRecording: boolean;
    sessionId: string | null;
    mode: string;
  };
}

export interface VisionInsightCard {
  variant: "vision-insight";
  agent: "oracle" | "feucht" | "consul" | "herald" | "harper";
  title: string;
  description: string;
  timestamp: string;
  confidence: number;
  context?: {
    symbol?: string;
    timeframe?: string;
    screenshotId?: string;
  };
}
