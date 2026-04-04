/**
 * ContextBank, MiroShark, Memory, Skills, and EditorSidebar Services
 */

import ApiClient from "../apiClient";
import type {
  ContextBankSnapshot,
  ContextBankMeta,
  DeskReport,
  ConsolidatedBrief,
} from '../../types/context-bank';

export class ContextBankService {
  constructor(private client: ApiClient) {}

  async getSnapshot(version?: number): Promise<ContextBankSnapshot> {
    const suffix = version ? `?version=${version}` : '';
    return this.client.get<ContextBankSnapshot>(`/api/context-bank${suffix}`);
  }

  async getMeta(): Promise<ContextBankMeta> {
    return this.client.get<ContextBankMeta>('/api/context-bank/meta');
  }

  async getDeskReports(): Promise<{ reports: DeskReport[]; count: number }> {
    return this.client.get('/api/context-bank/desk-reports');
  }

  async getDeskReportHistory(desk: string, limit?: number): Promise<{ desk: string; reports: DeskReport[]; count: number }> {
    const suffix = limit ? `?limit=${limit}` : '';
    return this.client.get(`/api/context-bank/desk-reports/${desk}${suffix}`);
  }

  async getBrief(): Promise<{ brief: ConsolidatedBrief | null }> {
    return this.client.get('/api/context-bank/brief');
  }
}

// MiroShark Service
export class MiroSharkService {
  constructor(private client: ApiClient) {}

  async simulate(narrativeState: {
    lanes: Array<any>;
    catalysts: Array<any>;
    ropes: Array<any>;
  }, contextBank?: {
    vixLevel?: number;
    gexNet?: number;
    macroIndicators?: Record<string, number>;
  }): Promise<{ simulationId: string }> {
    return this.client.post('/api/miroshark/simulate', { narrativeState, contextBank });
  }

  async getReport(simId: string): Promise<any> {
    return this.client.get(`/api/miroshark/report/${simId}`);
  }

  async getStatus(simId: string): Promise<any> {
    return this.client.get(`/api/miroshark/status/${simId}`);
  }

  async inject(simId: string, variable: string, targetNarrativeIds: string[], description: string): Promise<any> {
    return this.client.post(`/api/miroshark/inject/${simId}`, { variable, targetNarrativeIds, description });
  }
}

// [claude-code 2026-04-01] S13-T3: Shared memory types + service
export interface SharedMemoryEntry {
  id: string;
  key: string;
  value: Record<string, unknown>;
  peerId: string | null;
  agentName: string | null;
  category: string;
  ttlHours: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface AnalysisThought {
  id: string;
  agent: string;
  category: string;
  title: string | null;
  fullAnalysis: string;
  briefSummary: string;
  instruments: string[];
  confidence: number;
  createdAt: string;
}

export interface SidebarAction {
  type: 'fetch-chart' | 'fetch-data' | 'summarize' | 'analyze' | 'insert-image';
  prompt: string;
  documentId: string;
  result?: {
    content?: string;
    imageBase64?: string;
    data?: Record<string, unknown>;
  };
}

export class MemoryService {
  constructor(private client: ApiClient) {}

  async listShared(params?: { category?: string; search?: string }): Promise<{ entries: SharedMemoryEntry[] }> {
    const query = new URLSearchParams();
    if (params?.category) query.append('category', params.category);
    if (params?.search) query.append('search', params.search);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return this.client.get(`/api/memory/shared${suffix}`);
  }

  async getShared(key: string): Promise<{ entry: SharedMemoryEntry | null }> {
    return this.client.get(`/api/memory/shared/${encodeURIComponent(key)}`);
  }

  async setShared(key: string, data: { value: Record<string, unknown>; category?: string; ttlHours?: number; agentName?: string }): Promise<{ entry: SharedMemoryEntry }> {
    return this.client.put(`/api/memory/shared/${encodeURIComponent(key)}`, data);
  }

  async deleteShared(key: string): Promise<{ ok: boolean }> {
    return this.client.delete(`/api/memory/shared/${encodeURIComponent(key)}`);
  }

  async searchAnalysis(query: string, opts?: { agent?: string; limit?: number }): Promise<{ results: AnalysisThought[] }> {
    const params = new URLSearchParams({ q: query });
    if (opts?.agent) params.append('agent', opts.agent);
    if (opts?.limit) params.append('limit', String(opts.limit));
    return this.client.get(`/api/memory/analysis/search?${params.toString()}`);
  }

  async getAgentHistory(agent: string, limit?: number): Promise<{ thoughts: AnalysisThought[] }> {
    const suffix = limit ? `?limit=${limit}` : '';
    return this.client.get(`/api/memory/analysis/agent/${encodeURIComponent(agent)}${suffix}`);
  }
}

// [claude-code 2026-03-31] S13-T2: Skills service — trade plan generation
export class SkillsService {
  constructor(private client: ApiClient) {}

  async generateTradePlan(data: { instrument: string; direction: string; context?: string }): Promise<{ plan: any | null; reason?: string }> {
    return this.client.post('/api/skills/trade-plan', data);
  }

  async enrichProposal(proposalId: string): Promise<{ proposal: any | null; reason?: string }> {
    return this.client.post('/api/skills/trade-plan/enrich', { proposalId });
  }

  async getTradePlanStatus(): Promise<{ available: boolean; ready: boolean }> {
    return this.client.get('/api/skills/trade-plan/status');
  }
}

export class EditorSidebarService {
  constructor(private client: ApiClient) {}

  async executeSidebarAction(action: SidebarAction): Promise<{ action: SidebarAction }> {
    return this.client.post('/api/editor/sidebar/action', action);
  }

  async listAvailableActions(): Promise<{ actions: string[] }> {
    return this.client.get('/api/editor/sidebar/actions');
  }
}
