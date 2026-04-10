/**
 * Voice, ER, Notifications, and Events Services
 */

import ApiClient from "../apiClient";

export interface VoiceTranscriptionResponse {
  text: string;
  model?: string;
  provider?: string;
}

export interface VoiceSpeakResponse {
  conversationId: string;
  agent: string;
  responseText: string;
  audioBase64?: string;
  audioMimeType?: string;
  mode?: "chat" | "infraction";
}

export interface VoiceSentimentResponse {
  sentiment: number;
  confidence: number;
  keywords: string[];
  tiltIndicators: string[];
  summary: string;
  provider: "claude-haiku" | "fallback";
}

// Notifications Service
export class NotificationsService {
  constructor(private client: ApiClient) {}

  async list(): Promise<any[]> {
    const response = await this.client.get<{ notifications: any[] }>(
      "/api/notifications",
    );
    return response.notifications || [];
  }

  async markRead(notificationId: string): Promise<void> {
    // Stub - backend doesn't have this endpoint
  }
}

// ER Service (Emotional Resonance)
export class ERService {
  constructor(private client: ApiClient) {}

  async getSessions(): Promise<any[]> {
    const response = await this.client.get<{ sessions: any[] }>(
      "/api/er/sessions",
    );
    return response.sessions || [];
  }

  async getERSessions(): Promise<any[]> {
    // Alias for getSessions
    return this.getSessions();
  }

  async saveSession(data: any): Promise<any> {
    return this.client.post("/api/er/sessions", data);
  }

  async saveSnapshot(data: any): Promise<any> {
    return this.client.post("/api/er/snapshots", data);
  }

  async checkOvertrading(params?: {
    windowMinutes?: number;
    threshold?: number;
  }): Promise<any> {
    return this.client.post("/api/er/check-overtrading", params ?? {});
  }

  /** Fire-and-forget: persist an ER scoring event to Supabase */
  async postEREvent(event: {
    eventType: string;
    triggerText: string | null;
    penalty: number;
    scoreBefore: number;
    scoreAfter: number;
    curseCount: number;
    decayWindowMinutes: number | null;
    transcriptSnippet: string | null;
  }): Promise<{ ok: boolean }> {
    return this.client.post("/api/psych/er-event", event);
  }

  /** Fetch recent ER events for dashboard */
  async getERHistory(limit = 50): Promise<{ events: any[] }> {
    return this.client.get(`/api/psych/er-history?limit=${limit}`);
  }
}

export class VoiceService {
  constructor(private client: ApiClient) {}

  async transcribe(data: {
    audioBase64?: string;
    mimeType?: string;
    language?: string;
    prompt?: string;
    text?: string;
  }): Promise<VoiceTranscriptionResponse> {
    return this.client.post("/api/voice/transcribe", data);
  }

  async speak(data: {
    text: string;
    conversationId?: string;
    mode?: "chat" | "infraction";
    includeAudio?: boolean;
    agent?: string;
  }): Promise<VoiceSpeakResponse> {
    return this.client.post("/api/voice/speak", data);
  }

  async analyzeSentiment(data: {
    transcript?: string;
    audioBase64?: string;
    mimeType?: string;
    context?: string;
  }): Promise<VoiceSentimentResponse> {
    return this.client.post("/api/voice/analyze-sentiment", data);
  }
}

// Events Service
export class EventsService {
  constructor(private client: ApiClient) {}

  async list(): Promise<any[]> {
    // Stub - backend doesn't have this endpoint
    return [];
  }

  async seed(): Promise<void> {
    // Stub - no-op
  }
}
