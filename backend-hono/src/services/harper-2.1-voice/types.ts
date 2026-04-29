// [claude-code 2026-04-20] S21-T1: Omi integration — shared types.
// Mirrors the webhook payload shapes documented at docs.omi.me.

export type harper-2_1VoiceTrigger =
  | "psych_assist"
  | "voice_assistant"
  | "performance_chat";

export type harper-2_1VoiceSessionStatus = "active" | "ended" | "error";

export type harper-2_1VoicePrimaryAgent = "coach" | "oracle" | "harper";

export interface harper-2_1VoiceTranscriptSegment {
  text: string;
  speaker?: string;
  speakerId?: string;
  is_user?: boolean;
  start?: number;
  end?: number;
}

export interface harper-2_1VoiceTranscriptWebhookBody {
  segments: harper-2_1VoiceTranscriptSegment[];
}

export interface harper-2_1VoiceMemoryActionItem {
  description: string;
  completed?: boolean;
}

export interface harper-2_1VoiceMemoryWebhookBody {
  id?: string;
  created_at?: string;
  started_at?: string;
  finished_at?: string;
  transcript_segments?: harper-2_1VoiceTranscriptSegment[];
  structured?: {
    title?: string;
    overview?: string;
    emoji?: string;
    category?: string;
    action_items?: harper-2_1VoiceMemoryActionItem[];
  };
}

export interface harper-2_1VoiceAudioBytesHeaders {
  sample_rate: number;
  uid: string;
}

export interface harper-2_1VoiceSession {
  id: string;
  userId: string;
  trigger: harper-2_1VoiceTrigger;
  primaryAgent: harper-2_1VoicePrimaryAgent;
  status: harper-2_1VoiceSessionStatus;
  startedAt: string;
  endedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface harper-2_1VoiceRouteIntent {
  agent: harper-2_1VoicePrimaryAgent;
  reason: string;
  preamble?: string;
}

export interface harper-2_1VoiceNotificationPayload {
  uid: string;
  title?: string;
  message: string;
  speak?: boolean;
}
