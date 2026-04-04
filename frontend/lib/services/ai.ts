/**
 * AI, Psych, and Analyst Services
 */

import ApiClient from "../apiClient";

export interface ChatResponse {
  message: string;
  conversationId: string;
  tiltWarning?: {
    detected: boolean;
    message?: string;
  };
}

export interface MDBReport {
  report: {
    content: string;
  };
}

export interface PsychScores {
  executions: number;
  emotionalControl: number;
  planAdherence: number;
  riskSizing: number;
  adaptability: number;
}

export interface PsychProfile {
  blindSpots: string[];
  goal: string | null;
  orientationComplete: boolean;
  psychScores: PsychScores;
  lastAssessmentAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface AnalystReport {
  id: string;
  agentType: string;
  reportData: {
    title?: string;
    summary?: string;
    metrics?: Array<{ label: string; value: string }>;
  };
  confidenceScore?: number | null;
  createdAt: string;
}

// AI Service
export class AIService {
  constructor(private client: ApiClient) { }

  /**
   * Send a chat message (non-streaming legacy wrapper, prefer Vercel AI SDK directly)
   */
  async chat(data: { message: string; conversationId?: string; messages?: any[] }): Promise<any> {
    try {
      // If messages array is provided (Vercel SDK format), pass it through
      const payload = data.messages ? { messages: data.messages, conversationId: data.conversationId } : { messages: [{ role: 'user', content: data.message }], conversationId: data.conversationId };

      const response = await this.client.post('/api/ai/chat', payload);
      return response;
    } catch (error: any) {
      throw error;
    }
  }

  async listConversations(): Promise<any[]> {
    try {
      const response = await this.client.get<{ conversations: any[] }>('/api/ai/conversations');
      return response.conversations || [];
    } catch (error) {
      return [];
    }
  }

  async getConversation(id: string): Promise<any> {
    return this.client.get<any>(`/api/ai/conversations/${id}`);
  }

  /**
   * Quick Fintheon: Analyze a chart screenshot
   */
  async quickFintheon(image: string, algoState: any): Promise<any> {
    return this.client.post('/api/ai/quick-fintheon', { image, algoState });
  }

  async checkTape(): Promise<any> {
    const response = await this.client.post<any>('/api/ai/check-tape', {});
    return response;
  }

  async generateDailyRecap(): Promise<any> {
    const response = await this.client.post<any>('/api/ai/generate-daily-recap', {});
    return response;
  }

  async generateMDBReport(): Promise<MDBReport> {
    return {
      report: {
        content: 'MDB report generation is not yet implemented in the Hono backend.',
      },
    };
  }
}

// Psych Assist Service
export class PsychService {
  constructor(private client: ApiClient) { }

  async getProfile(): Promise<PsychProfile> {
    const response = await this.client.get<{ profile: PsychProfile }>('/api/psych/profile');
    return response.profile;
  }

  async updateProfile(data: { blindSpots?: string[]; goal?: string | null; orientationComplete?: boolean; source?: 'orientation' | 'settings' }): Promise<PsychProfile> {
    const response = await this.client.put<{ profile: PsychProfile }>('/api/psych/profile', data);
    return response.profile;
  }

  async updateScores(scores: Partial<PsychScores>): Promise<PsychProfile> {
    const response = await this.client.post<{ profile: PsychProfile }>('/api/psych/scores', scores);
    return response.profile;
  }
}

// Analyst Service
export class AnalystService {
  constructor(private client: ApiClient) { }

  async getReports(params?: { refresh?: boolean; instrument?: string }): Promise<AnalystReport[]> {
    const query = new URLSearchParams();
    if (params?.refresh) query.append('refresh', 'true');
    if (params?.instrument) query.append('instrument', params.instrument);
    const endpoint = `/api/agents/reports${query.size ? `?${query.toString()}` : ''}`;
    const response = await this.client.get<{ reports: AnalystReport[] }>(endpoint);
    return response.reports || [];
  }

  async runReports(data?: { instrument?: string }): Promise<AnalystReport[]> {
    const response = await this.client.post<{ reports: AnalystReport[] }>('/api/agents/reports/run', data ?? {});
    return response.reports || [];
  }
}
