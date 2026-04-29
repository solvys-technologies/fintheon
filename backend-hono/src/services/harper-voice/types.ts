// [claude-code 2026-04-20] S21-T1: Omi integration — shared types.
// Mirrors the webhook payload shapes documented at docs.omi.me.

export type HarperVoiceTrigger =
  | "psych_assist"
  | "voice_assistant"
  | "performance_chat";

export type HarperVoiceSessionStatus = "active" | "ended" | "error";

export type HarperVoicePrimaryAgent = "coach" | "oracle" | "harper";

export interface HarperVoiceTranscriptSegment {
  text: string;
  speaker?: string;
  speakerId?: string;
  is_user?: boolean;
  start?: number;
  end?: number;
}

export interface HarperVoiceTranscriptWebhookBody {
  segments: HarperVoiceTranscriptSegment[];
}

export interface HarperVoiceMemoryActionItem {
  description: string;
  completed?: boolean;
}

export interface HarperVoiceMemoryWebhookBody {
  id?: string;
  created_at?: string;
  started_at?: string;
  finished_at?: string;
  transcript_segments?: HarperVoiceTranscriptSegment[];
  structured?: {
    title?: string;
    overview?: string;
    emoji?: string;
    category?: string;
    action_items?: HarperVoiceMemoryActionItem[];
  };
}

export interface HarperVoiceAudioBytesHeaders {
  sample_rate: number;
  uid: string;
}

export interface HarperVoiceSession {
  id: string;
  userId: string;
  trigger: HarperVoiceTrigger;
  primaryAgent: HarperVoicePrimaryAgent;
  status: HarperVoiceSessionStatus;
  startedAt: string;
  endedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface HarperVoiceRouteIntent {
  agent: HarperVoicePrimaryAgent;
  reason: string;
  preamble?: string;
}

export interface HarperVoiceNotificationPayload {
  uid: string;
  title?: string;
  message: string;
  speak?: boolean;
}
