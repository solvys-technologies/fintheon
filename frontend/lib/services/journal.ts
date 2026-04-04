/**
 * Journal, Agent Performance, and Blindspots Services
 */

import ApiClient from "../apiClient";

// Journal Service (Track 7A)
export interface JournalEntryItem {
  id: number;
  userId: string;
  type: 'human' | 'agent';
  date: string;
  erTrend?: number[];
  infractions?: string[];
  disciplineScore?: number;
  notes?: string;
  emotionalControlRating?: number;
  agentName?: string;
  proposalCount?: number;
  acceptedCount?: number;
  winRate?: number;
  avgRR?: number;
  totalPnl?: number;
  proposals?: Array<{
    id: string;
    agent: string;
    ticker: string;
    direction: 'long' | 'short';
    entry?: number;
    target?: number;
    stopLoss?: number;
    status: 'proposed' | 'accepted' | 'rejected' | 'expired';
    outcome?: 'win' | 'loss' | 'breakeven' | null;
    pnl?: number;
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface JournalSummaryResponse {
  totalEntries: number;
  avgDisciplineScore: number;
  totalInfractions: number;
  avgWinRate: number;
  avgRR: number;
  totalAgentPnl: number;
  streakDays: number;
  /** 8f: Proposals not taken that would have been profitable */
  missedTrades?: number;
}

export class JournalService {
  constructor(private client: ApiClient) {}

  async listEntries(params?: { type?: 'human' | 'agent'; limit?: number; offset?: number; from?: string; to?: string }): Promise<{ entries: JournalEntryItem[]; total: number }> {
    try {
      const query = new URLSearchParams();
      if (params?.type) query.append('type', params.type);
      if (params?.limit) query.append('limit', params.limit.toString());
      if (params?.offset) query.append('offset', params.offset.toString());
      if (params?.from) query.append('from', params.from);
      if (params?.to) query.append('to', params.to);
      const suffix = query.toString() ? `?${query.toString()}` : '';
      return await this.client.get<{ entries: JournalEntryItem[]; total: number }>(`/api/journal/entries${suffix}`);
    } catch {
      return { entries: [], total: 0 };
    }
  }

  async saveEntry(data: Partial<JournalEntryItem> & { type: 'human' | 'agent'; date: string }): Promise<{ entryId: number }> {
    return this.client.post('/api/journal/entries', data);
  }

  async getSummary(days?: number): Promise<JournalSummaryResponse> {
    try {
      const suffix = days ? `?days=${days}` : '';
      return await this.client.get<JournalSummaryResponse>(`/api/journal/summary${suffix}`);
    } catch {
      return { totalEntries: 0, avgDisciplineScore: 0, totalInfractions: 0, avgWinRate: 0, avgRR: 0, totalAgentPnl: 0, streakDays: 0 };
    }
  }
}

// Agent Performance Service (Track 7)
export interface AgentPerformanceStatsItem {
  agentName: string;
  totalProposals: number;
  accepted: number;
  rejected: number;
  expired: number;
  executed: number;
  wins: number;
  losses: number;
  breakeven: number;
  winRate: number;
  avgRR: number;
  totalPnl: number;
  bestTrade: number;
  worstTrade: number;
}

export interface AgentPerformanceResponse {
  futures: AgentPerformanceStatsItem[];
  predictions: {
    total: number;
    resolved: number;
    wins: number;
    losses: number;
    winRate: number;
  };
  combined: {
    totalDecisions: number;
    totalWins: number;
    overallWinRate: number;
    totalPnl: number;
  };
  timestamp: string;
}

export class AgentPerformanceService {
  constructor(private client: ApiClient) {}

  async getPerformance(days: number = 30): Promise<AgentPerformanceResponse> {
    try {
      return await this.client.get<AgentPerformanceResponse>(`/api/agents/performance?days=${days}`);
    } catch {
      return {
        futures: [],
        predictions: { total: 0, resolved: 0, wins: 0, losses: 0, winRate: 0 },
        combined: { totalDecisions: 0, totalWins: 0, overallWinRate: 0, totalPnl: 0 },
        timestamp: new Date().toISOString(),
      };
    }
  }
}

// Blindspots Service
export interface BlindspotItem {
  id: number;
  text: string;
  severity: 'high' | 'medium' | 'low';
  /** 7-day rolling record: 'W' = win (avoided), 'L' = loss (triggered) */
  record?: Array<'W' | 'L'>;
}

export class BlindspotsService {
  constructor(private client: ApiClient) {}

  async getBlindspots(): Promise<{ blindspots: BlindspotItem[]; source: string }> {
    try {
      return await this.client.get<{ blindspots: BlindspotItem[]; source: string }>('/api/blindspots');
    } catch {
      return { blindspots: [], source: 'error' };
    }
  }
}
