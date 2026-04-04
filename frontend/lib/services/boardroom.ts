/**
 * Boardroom Service
 */

import ApiClient from "../apiClient";

// Boardroom types (mirrors backend boardroom.ts)
export type BoardroomAgent =
  | 'Harper-Opus'
  | 'Oracle'
  | 'Feucht'
  | 'Consul'
  | 'Herald'
  | 'Unknown';

export interface BoardroomMessage {
  id: string;
  agent: BoardroomAgent;
  emoji: string;
  content: string;
  timestamp: string;
  role: 'user' | 'assistant' | 'system';
  metadata?: Record<string, unknown>;
}

export interface InterventionMessage {
  id: string;
  sender: 'User' | 'Harper' | 'Unknown';
  content: string;
  timestamp: string;
}

// Structured Intervention types
export type InterventionType =
  | 'risk_alert'
  | 'overtrading_warning'
  | 'rule_violation'
  | 'market_event'
  | 'position_check';

export type InterventionSeverity = 'info' | 'warning' | 'critical';

export interface TriggerInterventionParams {
  agent: string;
  type: InterventionType;
  message: string;
  severity: InterventionSeverity;
  metadata?: Record<string, unknown>;
}

// Trade Idea types
export type TradeDirection = 'long' | 'short' | 'neutral';
export type ConvictionLevel = 'low' | 'medium' | 'high' | 'max';

export interface TradeIdeaParams {
  agent: string;
  instrument: string;
  direction: TradeDirection;
  conviction: ConvictionLevel;
  entry?: number;
  stopLoss?: number;
  target?: number;
  thesis: string;
  keyLevels?: { label: string; price: number }[];
}

// Boardroom Service
export class BoardroomService {
  constructor(private client: ApiClient) {}

  async getMessages(): Promise<BoardroomMessage[]> {
    const response = await this.client.get<{ messages: BoardroomMessage[] }>('/api/boardroom/messages');
    return response.messages || [];
  }

  async getInterventionMessages(): Promise<InterventionMessage[]> {
    const response = await this.client.get<{ messages: InterventionMessage[] }>('/api/boardroom/intervention/messages');
    return response.messages || [];
  }

  async sendIntervention(message: string): Promise<void> {
    await this.client.post('/api/boardroom/intervention/send', { message });
  }

  async sendMention(message: string, agent: string): Promise<void> {
    await this.client.post('/api/boardroom/mention/send', { message, agent });
  }

  async getStatus(): Promise<{ boardroomActive: boolean; interventionActive: boolean }> {
    return this.client.get('/api/boardroom/status');
  }

  async triggerIntervention(params: TriggerInterventionParams): Promise<{ success: boolean; id: string }> {
    return this.client.post('/api/boardroom/intervention/trigger', params);
  }

  async postTradeIdea(params: TradeIdeaParams): Promise<{ success: boolean; id: string }> {
    return this.client.post('/api/boardroom/trade-idea', params);
  }

  async getMeetingSchedule(): Promise<{ lastMeeting: string; nextMeeting: string; live: boolean }> {
    const res = await this.client.get<{ lastMeetingIso?: string; nextMeetingIso?: string; live?: boolean }>(
      '/api/boardroom/meeting-schedule',
    );
    return {
      lastMeeting: res.lastMeetingIso || '',
      nextMeeting: res.nextMeetingIso || '',
      live: res.live ?? false,
    };
  }

  async getThought(thoughtId: string): Promise<any> {
    return this.client.get(`/api/boardroom/thoughts/${thoughtId}`);
  }

  async showFullAnalysis(messageId: string): Promise<any> {
    return this.client.post(`/api/boardroom/thoughts/${messageId}/full`, {});
  }
}
