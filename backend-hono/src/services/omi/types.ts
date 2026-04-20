// [claude-code 2026-04-20] S21-T1: Omi integration — shared types.
// Mirrors the webhook payload shapes documented at docs.omi.me.

export type OmiTrigger =
  | "psych_assist"
  | "voice_assistant"
  | "performance_chat";

export type OmiSessionStatus = "active" | "ended" | "error";

export type OmiPrimaryAgent = "coach" | "oracle" | "harper";

export interface OmiTranscriptSegment {
  text: string;
  speaker?: string;
  speakerId?: string;
  is_user?: boolean;
  start?: number;
  end?: number;
}

export interface OmiTranscriptWebhookBody {
  segments: OmiTranscriptSegment[];
}

export interface OmiMemoryActionItem {
  description: string;
  completed?: boolean;
}

export interface OmiMemoryWebhookBody {
  id?: string;
  created_at?: string;
  started_at?: string;
  finished_at?: string;
  transcript_segments?: OmiTranscriptSegment[];
  structured?: {
    title?: string;
    overview?: string;
    emoji?: string;
    category?: string;
    action_items?: OmiMemoryActionItem[];
  };
}

export interface OmiAudioBytesHeaders {
  sample_rate: number;
  uid: string;
}

export interface OmiSession {
  id: string;
  userId: string;
  trigger: OmiTrigger;
  primaryAgent: OmiPrimaryAgent;
  status: OmiSessionStatus;
  startedAt: string;
  endedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface OmiRouteIntent {
  agent: OmiPrimaryAgent;
  reason: string;
  preamble?: string;
}

export interface OmiNotificationPayload {
  uid: string;
  title?: string;
  message: string;
  speak?: boolean;
}
