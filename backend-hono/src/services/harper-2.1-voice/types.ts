// [claude-code 2026-04-20] S21-T1: Omi integration — shared types.
// Mirrors the webhook payload shapes documented at docs.omi.me.

export type Harper21VoiceTrigger =
  | "psych_assist"
  | "voice_assistant"
  | "performance_chat";

export type Harper21VoiceSessionStatus = "active" | "ended" | "error";

export type Harper21VoicePrimaryAgent = "coach" | "oracle" | "harper";

export interface Harper21VoiceTranscriptSegment {
  text: string;
  speaker?: string;
  speakerId?: string;
  is_user?: boolean;
  start?: number;
  end?: number;
}

export interface Harper21VoiceTranscriptWebhookBody {
  segments: Harper21VoiceTranscriptSegment[];
}

export interface Harper21VoiceMemoryActionItem {
  description: string;
  completed?: boolean;
}

export interface Harper21VoiceMemoryWebhookBody {
  id?: string;
  created_at?: string;
  started_at?: string;
  finished_at?: string;
  transcript_segments?: Harper21VoiceTranscriptSegment[];
  structured?: {
    title?: string;
    overview?: string;
    emoji?: string;
    category?: string;
    action_items?: Harper21VoiceMemoryActionItem[];
  };
}

export interface Harper21VoiceAudioBytesHeaders {
  sample_rate: number;
  uid: string;
}

export interface Harper21VoiceSession {
  id: string;
  userId: string;
  trigger: Harper21VoiceTrigger;
  primaryAgent: Harper21VoicePrimaryAgent;
  status: Harper21VoiceSessionStatus;
  startedAt: string;
  endedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface Harper21VoiceRouteIntent {
  agent: Harper21VoicePrimaryAgent;
  reason: string;
  preamble?: string;
}

export interface Harper21VoiceNotificationPayload {
  uid: string;
  title?: string;
  message: string;
  speak?: boolean;
}
