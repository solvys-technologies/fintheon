/**
 * API Service Wrappers for Hono Backend
 * 
 * These services provide a compatible interface to replace the Encore client.
 * Update the endpoint paths to match your Hono backend routes.
 */

import ApiClient from "./apiClient";
import { decodeHtmlEntities } from './html-entities';
import { McpService } from './mcp-service';

// Type definitions (update these to match your Hono backend response types)
export interface Account {
  id: string;
  userId: string;
  balance: number;
  dailyPnl: number;
  dailyTarget?: number;
  dailyLossLimit?: number;
  tier?: 'free' | 'fintheon' | 'fintheon_plus' | 'fintheon_pro';
  tradingEnabled?: boolean;
  autoTrade?: boolean;
  riskManagement?: boolean;
  algoEnabled?: boolean;
  topstepxUsername?: string;
  topstepxApiKey?: string;
  selectedSymbol?: string;
  contractsPerTrade?: number;
  projectxUsername?: string;
}

import type { RiskFlowItem } from '../types/api';

export interface RiskFlowListResponse {
  items: RiskFlowItem[];
  total?: number;
  hasMore?: boolean;
}

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

export interface Position {
  id: string | number;
  accountId?: number;
  contractId?: string;
  symbol?: string;
  quantity?: number;
  size?: number;
  entryPrice?: number;
  exitPrice?: number;
  currentPrice?: number;
  pnl?: number;
  pnlPercentage?: number;
  side: string;
  openedAt: Date | string;
  closedAt?: Date | string | null;
  status?: string;
}

export interface PositionsResponse {
  positions: Position[];
}

export interface ProjectXAccount {
  accountId: string;
  accountName: string;
  balance?: number;
  provider?: string;
  isPaper?: boolean;
}

export interface ProjectXActivitySummary {
  accountId: number;
  windowMinutes: number;
  eventCount: number;
  tradeCount: number;
  weightedTradeCount: number;
  overtradingPenalty: number;
  realizedPnl: number;
  lastEventAt: string | null;
}

export interface ProjectXActivityResponse {
  accountId: number;
  events: Array<{
    id: number;
    eventType: string;
    eventSource: string;
    eventTimestamp: string;
    isTrade: boolean;
    symbol?: string | null;
    side?: string | null;
    quantity?: number | null;
    price?: number | null;
    realizedPnl?: number | null;
    eventWeight?: number | null;
    payload?: Record<string, unknown>;
  }>;
  summary: ProjectXActivitySummary;
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

export interface ProjectXAccountsResponse {
  accounts: ProjectXAccount[];
}

export interface UplinkResponse {
  success: boolean;
  message: string;
}

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
  mode?: 'chat' | 'infraction';
}

// Account Service
export class AccountService {
  constructor(private client: ApiClient) { }

  private mapAccountResponse(response: any, tier: Account['tier']): Account {
    const dailyPnlRaw = response.dailyPnl ?? response.daily_pnl;
    return {
      id: response.id?.toString() || '',
      userId: response.userId?.toString?.() || response.user_id?.toString?.() || '',
      balance: Number(response.balance ?? 0),
      dailyPnl: typeof dailyPnlRaw === 'number' ? dailyPnlRaw : Number(dailyPnlRaw ?? 0),
      tier,
      tradingEnabled: Boolean(response.tradingEnabled ?? response.trading_enabled ?? false),
      autoTrade: Boolean(response.autoTrade ?? response.auto_trade ?? response.algoEnabled ?? response.algo_enabled ?? false),
      riskManagement: Boolean(response.riskManagement ?? response.risk_management ?? false),
      algoEnabled: Boolean(response.algoEnabled ?? response.algo_enabled ?? false),
      topstepxUsername: response.topstepxUsername ?? response.topstepx_username,
      topstepxApiKey: response.topstepxApiKey ?? response.topstepx_api_key,
      selectedSymbol: response.selectedSymbol ?? response.selected_symbol,
      contractsPerTrade: response.contractsPerTrade ?? response.contracts_per_trade,
      projectxUsername: response.projectxUsername ?? response.projectx_username,
    };
  }

  async get(): Promise<Account> {
    const response = await this.client.get<any>('/api/account');
    // Get tier separately since it's not in the account response
    let tier: Account['tier'] = 'free';
    try {
      const tierResponse = await this.client.get<{ tier: Account['tier'] | null; requiresSelection: boolean }>('/api/account/tier');
      tier = tierResponse.tier || 'free';
    } catch (error) {
      // If tier endpoint fails, default to free
      // Tier fetch failed — default to free
    }

    return this.mapAccountResponse(response, tier);
  }

  async create(data: { initialBalance?: number }): Promise<Account> {
    const response = await this.client.post<any>('/api/account', data);
    // Get tier separately since it's not in the account response
    let tier: Account['tier'] = 'free';
    try {
      const tierResponse = await this.client.get<{ tier: Account['tier'] | null; requiresSelection: boolean }>('/api/account/tier');
      tier = tierResponse.tier || 'free';
    } catch (error) {
      // If tier endpoint fails, default to free
      // Tier fetch failed — default to free
    }

    return this.mapAccountResponse(response, tier);
  }

  async updateSettings(data: Partial<Account>): Promise<Account> {
    await this.client.patch('/api/account/settings', data);
    return this.get();
  }

  async updateTier(data: { tier: Account['tier'] }): Promise<Account> {
    await this.client.patch('/api/account/tier', data);
    return this.get();
  }

  async selectTier(data: { tier: Account['tier'] }): Promise<void> {
    await this.client.post('/api/account/select-tier', data);
  }

  async getTier(): Promise<{ tier: Account['tier'] | null; requiresSelection: boolean }> {
    return this.client.get('/api/account/tier');
  }

  async getFeatures(): Promise<{ tier: Account['tier']; features: Array<{ name: string; requiredTier: string; hasAccess: boolean }> }> {
    return this.client.get('/api/account/features');
  }

  async updateProjectXCredentials(data: { username?: string; apiKey?: string }): Promise<void> {
    // Use projectx sync endpoint
    if (data.username && data.apiKey) {
      await this.client.post('/api/projectx/sync', data);
    }
  }
}

// RiskFlow Service
export class RiskFlowService {
  constructor(private client: ApiClient) { }

  async list(params?: { limit?: number; offset?: number; symbol?: string; minMacroLevel?: number; instrument?: string }): Promise<RiskFlowListResponse> {
    const query = new URLSearchParams();
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.offset) query.append('offset', params.offset.toString());
    if (params?.symbol) query.append('symbols', params.symbol); // Backend expects 'symbols' not 'symbol'
    if (params?.instrument) query.append('instrument', params.instrument);
    // Allow frontend to override minMacroLevel for debugging (default is 3)
    if (params?.minMacroLevel !== undefined) {
      query.append('minMacroLevel', params.minMacroLevel.toString());
    }

    const queryString = query.toString();
    const endpoint = `/api/riskflow/feed${queryString ? `?${queryString}` : ''}`;
    try {
      const response = await this.client.get<{ items?: any[]; total?: number; hasMore?: boolean; fetchedAt?: string; error?: string }>(endpoint);

      if (!response || typeof response !== 'object' || Object.keys(response).length === 0) {
        return { items: [], total: 0 };
      }

      const items = Array.isArray(response.items) ? response.items : [];

      // Transform backend FeedItem to frontend RiskFlowItem format
      return {
        items: items.map((item: any) => {
          // Backend uses 'headline', frontend expects 'title'
          // Backend uses 'body', frontend expects 'content'
          // Backend uses 'ivScore', frontend expects 'ivScore' (same)
          // Backend uses 'macroLevel', frontend expects 'macroLevel' (same)
          const ivScore = item.ivScore ?? 0;
          const macroLevel = item.macroLevel ?? 1;
          
          return {
            id: item.id?.toString() || '',
            title: decodeHtmlEntities(item.headline || item.title || ''), // Map headline to title
            content: decodeHtmlEntities(item.body || item.content || ''), // Map body to content
            summary: decodeHtmlEntities(item.body || item.content || ''), // Also set summary for compatibility
            source: item.source || '',
            url: item.url,
            publishedAt: item.publishedAt || item.published_at || new Date().toISOString(),
            impact: ivScore > 7 ? 'high' : ivScore > 4 ? 'medium' : 'low',
            symbols: item.symbols || [],
            sentiment: item.sentiment || 'neutral',
            ivScore: ivScore,
            ivImpact: ivScore, // Also set ivImpact for backward compatibility
            macroLevel: macroLevel,
            isBreaking: item.isBreaking || false,
            category: item.source || '',
            tags: item.tags || [],
            urgency: item.urgency || 'normal',
            priceBrainScore: item.priceBrainScore ?? undefined,
            authorHandle: item.authorHandle ?? undefined,
          };
        }),
        total: response.total ?? items.length,
        hasMore: response.hasMore ?? false,
      };
    } catch (error: any) {
      // RiskFlow fetch failed — rethrow
      // Return empty response on error
      return {
        items: [],
        total: 0,
        hasMore: false,
      };
    }
  }

  async seed(): Promise<void> {
    try {
      await this.client.post('/api/riskflow/seed', {});
    } catch (error) {
      // Seed failed — swallow
      throw error;
    }
  }

  async refresh(): Promise<{ success: boolean; refreshedAt: string }> {
    return this.client.post<{ success: boolean; refreshedAt: string }>('/api/riskflow/refresh', {});
  }

  async fetchVIX(): Promise<{ value: number }> {
    return this.client.get<{ value: number }>('/api/market/vix');
  }

  async generateNote(itemId: string): Promise<{ note: string }> {
    return this.client.post<{ note: string }>(`/api/riskflow/${itemId}/generate-note`, {});
  }
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

// Trading Service
export class TradingService {
  constructor(private client: ApiClient) { }

  async listPositions(): Promise<PositionsResponse> {
    const response = await this.client.get<{ positions: any[] }>('/api/trading/positions');
    // Transform backend response to match frontend expectations
    return {
      positions: response.positions.map(pos => ({
        id: pos.id?.toString() || '',
        symbol: pos.symbol || '',
        quantity: pos.size || 0,
        size: pos.size || 0,
        entryPrice: pos.entryPrice || 0,
        currentPrice: pos.entryPrice || 0, // Backend doesn't return current price
        pnl: pos.pnl || 0,
        pnlPercentage: pos.pnlPercentage || 0,
        side: pos.side || '',
        openedAt: pos.openedAt || new Date().toISOString(),
        status: 'open',
      })),
    };
  }

  async seedPositions(): Promise<void> {
    // Stub - backend doesn't have this endpoint
  }

  async toggleAlgo(data: any): Promise<any> {
    const response = await this.client.post<any>('/api/trading/toggle-algo', data);
    return response;
  }

  async fireTestTrade(data: any): Promise<any> {
    const response = await this.client.post<any>('/api/trading/test-trade', data);
    return response;
  }
}

// ProjectX Service
export class ProjectXService {
  constructor(private client: ApiClient) { }

  // STUB: Backend routes for /api/projectx/* were never implemented — gracefully degrade
  async listAccounts(): Promise<ProjectXAccountsResponse> {
    return { accounts: [] };
  }

  async uplinkProjectX(): Promise<UplinkResponse> {
    return {
      success: false,
      message: 'Uplink endpoint not available',
    };
  }

  async syncProjectXAccounts(): Promise<void> {
    // STUB: No backend route
    return;
  }

  async getActivity(_accountId: string | number, _params?: { windowMinutes?: number; limit?: number }): Promise<ProjectXActivityResponse> {
    // STUB: No backend route
    return { orders: [], fills: [] } as unknown as ProjectXActivityResponse;
  }
}

// Rithmic Service (Autopilot primary broker scaffold)
export interface RithmicStatusResponse {
  connected: boolean;
  message: string;
}

export class RithmicService {
  constructor(private client: ApiClient) {}

  async getStatus(): Promise<RithmicStatusResponse> {
    const response = await this.client.get<RithmicStatusResponse>('/api/rithmic/status');
    return response;
  }
}

// Hyperliquid Service
export interface HyperliquidStatusResponse {
  connected: boolean;
  message: string;
}

export interface HyperliquidAccountResponse {
  accountValue: number;
  totalMarginUsed: number;
  availableBalance: number;
}

export class HyperliquidService {
  constructor(private client: ApiClient) {}

  async getStatus(): Promise<HyperliquidStatusResponse> {
    return this.client.get<HyperliquidStatusResponse>('/api/hyperliquid/status');
  }

  async getPositions(): Promise<{ positions: any[] }> {
    return this.client.get<{ positions: any[] }>('/api/hyperliquid/positions');
  }

  async getAccountInfo(): Promise<HyperliquidAccountResponse> {
    return this.client.get<HyperliquidAccountResponse>('/api/hyperliquid/account');
  }
}

// Autopilot Service
export interface AutopilotStatusResponse {
  enabled: boolean;
  isRTH: boolean;
  activeSession: string | null;
  signalsToday: number;
  tradesToday: number;
  maxTradesPerDay: number;
  dailyPnL: number;
  dailyDrawdownLimit: number;
  confidenceThreshold: number;
}

export class AutopilotService {
  constructor(private client: ApiClient) {}

  async getStatus(): Promise<AutopilotStatusResponse> {
    return this.client.get<AutopilotStatusResponse>('/api/autopilot/status');
  }

  async getSignals(limit?: number): Promise<{ signals: any[]; total: number }> {
    const suffix = limit ? `?limit=${limit}` : '';
    return this.client.get(`/api/autopilot/signals${suffix}`);
  }

  async getPendingProposals(): Promise<{ proposals: any[]; total: number }> {
    return this.client.get('/api/autopilot/proposals');
  }

  async acknowledgeProposal(proposalId: string, decision: 'approved' | 'rejected'): Promise<any> {
    return this.client.post('/api/autopilot/acknowledge', { proposalId, decision });
  }

  async executeProposal(proposalId: string): Promise<any> {
    return this.client.post('/api/autopilot/execute', { proposalId });
  }

  async getHistory(limit?: number, status?: string): Promise<{ proposals: any[]; total: number }> {
    const query = new URLSearchParams();
    if (limit) query.append('limit', limit.toString());
    if (status) query.append('status', status);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return this.client.get(`/api/autopilot/history${suffix}`);
  }
}

// Notifications Service
export class NotificationsService {
  constructor(private client: ApiClient) { }

  async list(): Promise<any[]> {
    const response = await this.client.get<{ notifications: any[] }>('/api/notifications');
    return response.notifications || [];
  }

  async markRead(notificationId: string): Promise<void> {
    // Stub - backend doesn't have this endpoint
  }
}

// ER Service (Emotional Resonance)
export class ERService {
  constructor(private client: ApiClient) { }

  async getSessions(): Promise<any[]> {
    const response = await this.client.get<{ sessions: any[] }>('/api/er/sessions');
    return response.sessions || [];
  }

  async getERSessions(): Promise<any[]> {
    // Alias for getSessions
    return this.getSessions();
  }

  async saveSession(data: any): Promise<any> {
    return this.client.post('/api/er/sessions', data);
  }

  async saveSnapshot(data: any): Promise<any> {
    return this.client.post('/api/er/snapshots', data);
  }

  async checkOvertrading(params?: { windowMinutes?: number; threshold?: number }): Promise<any> {
    return this.client.post('/api/er/check-overtrading', params ?? {});
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
    return this.client.post('/api/psych/er-event', event);
  }

  /** Fetch recent ER events for dashboard */
  async getERHistory(limit = 50): Promise<{ events: any[] }> {
    return this.client.get(`/api/psych/er-history?limit=${limit}`);
  }
}

export interface VoiceSentimentResponse {
  sentiment: number;
  confidence: number;
  keywords: string[];
  tiltIndicators: string[];
  summary: string;
  provider: 'claude-haiku' | 'fallback';
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
    return this.client.post('/api/voice/transcribe', data);
  }

  async speak(data: {
    text: string;
    conversationId?: string;
    mode?: 'chat' | 'infraction';
    includeAudio?: boolean;
    agent?: string;
  }): Promise<VoiceSpeakResponse> {
    return this.client.post('/api/voice/speak', data);
  }

  async analyzeSentiment(data: {
    transcript?: string;
    audioBase64?: string;
    mimeType?: string;
    context?: string;
  }): Promise<VoiceSentimentResponse> {
    return this.client.post('/api/voice/analyze-sentiment', data);
  }
}

export interface PeerUserRecord {
  id: string;
  displayName: string;
  role: 'admin' | 'peer';
  avatarUrl?: string | null;
  settings?: Record<string, unknown>;
}

export interface PeerRecordResponse {
  id: string;
  userId: string;
  deviceName: string;
  platform: string;
  capabilities: string[];
  deskId?: string | null;
  deskName?: string | null;
  assignedAgents: string[];
  status: 'online' | 'away' | 'offline';
  heartbeatAt: string;
  hermesAvailable: boolean;
  createdAt: string;
  user?: PeerUserRecord;
}

export interface DeskRecordResponse {
  id: string;
  name: string;
  description?: string | null;
  sectorFocus: string[];
  createdById: string;
  createdAt: string;
}

export interface VoiceParticipantsResponse {
  roomId: string;
  participants: Array<{ peerId: string; joinedAt: string }>;
  configured: boolean;
}

export class PeersService {
  constructor(private client: ApiClient) {}

  async register(data: {
    deviceName: string;
    platform?: string;
    capabilities?: string[];
    deskId?: string | null;
    assignedAgents?: string[];
    hermesAvailable?: boolean;
  }): Promise<{ peer: PeerRecordResponse }> {
    return this.client.post('/api/peers/register', data);
  }

  async heartbeat(data: {
    peerId: string;
    payload?: { status?: 'online' | 'away' | 'offline'; metadata?: Record<string, unknown> };
  }): Promise<{ peer: PeerRecordResponse }> {
    return this.client.post('/api/peers/heartbeat', data);
  }

  async list(): Promise<{ peers: PeerRecordResponse[]; total: number }> {
    return this.client.get('/api/peers/list');
  }

  async get(id: string): Promise<{ peer: PeerRecordResponse }> {
    return this.client.get(`/api/peers/${id}`);
  }

  async deregister(id: string): Promise<{ ok: boolean }> {
    return this.client.delete(`/api/peers/${id}`);
  }

  async createDesk(data: {
    name: string;
    description?: string;
    sectorFocus?: string[];
  }): Promise<{ desk: DeskRecordResponse }> {
    return this.client.post('/api/peers/desks', data);
  }

  async listDesks(): Promise<{ desks: DeskRecordResponse[]; total: number }> {
    return this.client.get('/api/peers/desks');
  }

  async assignDesk(
    deskId: string,
    peerId: string,
  ): Promise<{ assigned: boolean; deskId: string; peers: PeerRecordResponse[] }> {
    return this.client.post(`/api/peers/desks/${deskId}/assign`, { peerId });
  }

  async joinVoice(data: {
    peerId?: string;
    roomId?: string;
    roomName?: string;
  }): Promise<{ room: { id: string; name: string; createdAt: string; configured: boolean }; token: string; configured: boolean; url: string | null }> {
    return this.client.post('/api/peers/voice/join', data);
  }

  async leaveVoice(data: {
    peerId?: string;
    roomId: string;
  }): Promise<{ left: boolean }> {
    return this.client.post('/api/peers/voice/leave', data);
  }

  async listVoiceParticipants(roomId: string): Promise<VoiceParticipantsResponse> {
    return this.client.get(`/api/peers/voice/participants?roomId=${encodeURIComponent(roomId)}`);
  }
}

// Events Service
export class EventsService {
  constructor(private client: ApiClient) { }

  async list(): Promise<any[]> {
    // Stub - backend doesn't have this endpoint
    return [];
  }

  async seed(): Promise<void> {
    // Stub - no-op
  }
}

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

// Econ Calendar Service
export interface EconEventItem {
  id: string;
  name: string;
  date?: string;
  time?: string;
  country: string;
  importance: 1 | 2 | 3;
  forecast?: string;
  previous?: string;
  actual?: string;
  category?: string;
  definition?: string;
  aiTicker?: string;
  notionUrl: string;
}

export interface EconPrintItem {
  id: string;
  eventName: string;
  date: string;
  actual: number | null;
  forecast: number | null;
  previous: number | null;
  surprise: number | null;
  direction: 'beat' | 'miss' | 'inline' | null;
  goodBeta: boolean;
  notionUrl: string;
}

export class EconCalendarService {
  constructor(private client: ApiClient) {}

  async getEvents(params?: { from?: string; to?: string }): Promise<EconEventItem[]> {
    try {
      const query = new URLSearchParams();
      if (params?.from) query.append('from', params.from);
      if (params?.to) query.append('to', params.to);
      const suffix = query.toString() ? `?${query.toString()}` : '';
      const res = await this.client.get<{ events: EconEventItem[] }>(`/api/data/econ-calendar${suffix}`);
      return res.events ?? [];
    } catch {
      return [];
    }
  }

  async getPrints(eventName?: string): Promise<EconPrintItem[]> {
    try {
      const suffix = eventName ? `?event=${encodeURIComponent(eventName)}` : '';
      const res = await this.client.get<{ prints: EconPrintItem[] }>(`/api/data/econ-prints${suffix}`);
      return res.prints ?? [];
    } catch {
      return [];
    }
  }
}

// Notion Service
export interface NotionTradeIdeaItem {
  id: string;
  title: string;
  ticker: string;
  direction: 'long' | 'short' | 'neutral';
  entry?: number;
  stopLoss?: number;
  takeProfit?: number;
  potentialRisk?: number;
  potentialProfit?: number;
  riskRewardRatio?: number;
  confidence?: string;
  timeframe?: string;
  sourceAgent?: string;
  hermesDescription?: string;
  notionUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotionPerformanceResponse {
  kpis: Array<{ label: string; value: string; meta: string }>;
  count: number;
  fetchedAt: string;
}

export interface NotionPollStatus {
  running: boolean;
  lastPollAt: string | null;
  pollCount: number;
  tradeIdeaCount: number;
}

export class NotionService {
  constructor(private client: ApiClient) {}

  async getTradeIdeas(): Promise<NotionTradeIdeaItem[]> {
    try {
      const res = await this.client.get<{ tradeIdeas: NotionTradeIdeaItem[] }>('/api/data/trade-ideas');
      return res.tradeIdeas ?? [];
    } catch {
      return [];
    }
  }

  async getPerformance(): Promise<NotionPerformanceResponse> {
    try {
      return await this.client.get<NotionPerformanceResponse>('/api/data/performance');
    } catch {
      return { kpis: [], count: 0, fetchedAt: new Date().toISOString() };
    }
  }

  /** @deprecated Notion poller removed — Supabase is now the source of truth */
  async getPollStatus(): Promise<NotionPollStatus> {
    return { running: true, lastPollAt: new Date().toISOString(), pollCount: 0, tradeIdeaCount: 0 };
  }

  async getMdbBrief(): Promise<{ items: Array<{ title: string; detail: string }>; briefType?: string }> {
    try {
      const res = await this.client.get<{ items: Array<{ title: string; detail: string }>; briefType?: string }>('/api/data/brief');
      return { items: res.items ?? [], briefType: res.briefType };
    } catch {
      return { items: [] };
    }
  }

  async getSchedule(): Promise<Array<{ title: string; detail: string; forecast?: string; actual?: string; previous?: string; date?: string }>> {
    try {
      const res = await this.client.get<{ items: Array<{ title: string; detail: string; forecast?: string; actual?: string; previous?: string; date?: string }> }>('/api/data/schedule');
      return res.items ?? [];
    } catch {
      return [];
    }
  }

  async generateMdbReport(): Promise<{ content: string; briefType: string; generatedAt: string; notionUrl?: string | null }> {
    try {
      return await this.client.post<{ content: string; briefType: string; generatedAt: string; notionUrl?: string | null }>('/api/data/brief/generate', {});
    } catch {
      return { content: '', briefType: 'MDB', generatedAt: new Date().toISOString() };
    }
  }

  /** Update trade idea status (Approved/Rejected/Closed) */
  async updateTradeIdeaStatus(pageId: string, status: string): Promise<boolean> {
    try {
      await this.client.patch<{ success: boolean }>(`/api/data/trade-ideas/${pageId}/status`, { status });
      return true;
    } catch {
      return false;
    }
  }
}

// Market Data Service
import type {
  StockQuote,
  VixData,
  GammaExposure,
  OptionsWall,
  OptionsFlow,
  MarketContext,
  IVScoreResponse,
} from '../types/market-data';

export class MarketDataService {
  constructor(private client: ApiClient) {}

  async getQuote(symbol: string): Promise<StockQuote> {
    return this.client.get<StockQuote>(`/api/market-data/quote/${encodeURIComponent(symbol)}`);
  }

  async getVix(): Promise<VixData> {
    return this.client.get<VixData>('/api/market-data/vix');
  }

  async getGex(symbol: string): Promise<GammaExposure> {
    return this.client.get<GammaExposure>(`/api/market-data/gex/${encodeURIComponent(symbol)}`);
  }

  async getWalls(symbol: string): Promise<OptionsWall> {
    return this.client.get<OptionsWall>(`/api/market-data/walls/${encodeURIComponent(symbol)}`);
  }

  async getFlow(symbol: string, limit?: number): Promise<OptionsFlow> {
    const suffix = limit ? `?limit=${limit}` : '';
    return this.client.get<OptionsFlow>(`/api/market-data/flow/${encodeURIComponent(symbol)}${suffix}`);
  }

  async getContext(symbol: string): Promise<MarketContext> {
    return this.client.get<MarketContext>(`/api/market-data/context/${encodeURIComponent(symbol)}`);
  }

  async getIVScore(instrument?: string, price?: number): Promise<IVScoreResponse> {
    const params = new URLSearchParams();
    if (instrument) params.append('instrument', instrument);
    if (price) params.append('price', price.toString());
    const suffix = params.toString() ? `?${params.toString()}` : '';
    return this.client.get<IVScoreResponse>(`/api/market-data/iv-score${suffix}`);
  }
}

// Narrative Scoring Service
export interface ScoredCandidate {
  sourceId: string;
  sourceType: 'riskflow' | 'mdb-brief';
  notabilityScore: number;
  sentiment: 'bullish' | 'bearish';
  severity: 'high' | 'medium' | 'low';
  tickers: string[];
  themes: string[];
  suggestedTitle: string;
  suggestedDescription: string;
  originalHeadline?: string;
}

export interface NarrativeThreadRow {
  slug: string;
  title: string;
  description: string | null;
  color: string;
  status: string;
  sort_order: number;
  keywords: string[] | null;
}

export interface NarrativeCardLink {
  card_id: string;
  thread_slug: string;
  confidence: number;
}

export class NarrativeService {
  constructor(private client: ApiClient) {}

  async getThreads(): Promise<{ threads: NarrativeThreadRow[] }> {
    return this.client.get('/api/narrative/threads');
  }

  async getCardLinks(cardIds?: string[]): Promise<{ links: NarrativeCardLink[] }> {
    const params = cardIds?.length ? `?card_ids=${cardIds.join(',')}` : '';
    return this.client.get(`/api/narrative/card-links${params}`);
  }

  async scoreRiskflow(items: Array<{ id: string; headline: string; summary: string; source: string; severity: string; tags: string[]; publishedAt: string }>): Promise<{ scored: ScoredCandidate[]; provider: string }> {
    return this.client.post('/api/narrative/score-riskflow', { items });
  }

  async scoreBrief(briefText: string): Promise<{ scored: ScoredCandidate[]; provider: string }> {
    return this.client.post('/api/narrative/score-brief', { briefText });
  }

  async getCatalysts(since?: string): Promise<{ catalysts: DbCatalyst[] }> {
    const params = since ? `?since=${encodeURIComponent(since)}` : '';
    return this.client.get(`/api/narrative/catalysts${params}`);
  }
}

/** Shape returned by GET /api/narrative/catalysts — maps to CatalystCard */
export interface DbCatalyst {
  id: string;
  title: string;
  description: string;
  date: string;
  sentiment: 'bullish' | 'bearish';
  severity: 'high' | 'medium' | 'low';
  source: 'riskflow';
  narrativeIds: string[];
  narrativeThreads: string[];
  isGhost: boolean;
  templateType: null;
  position: null;
  tags: string[];
  category: string;
  riskflowItemId: string;
  marketImpact: Record<string, unknown> | null;
  narrative: string | null;
  status: string;
  drillDepth: number;
  createdAt: string;
  updatedAt: string;
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

// Context Bank Service
import type {
  ContextBankSnapshot,
  ContextBankMeta,
  DeskReport,
  ConsolidatedBrief,
} from '../types/context-bank';

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

// Document types (S12-T2: TipTap editor)
export interface DocumentRecord {
  id: string
  title: string
  content: Record<string, unknown>
  authorId: string
  deskId: string | null
  tags: string[]
  createdAt: string
  updatedAt: string
}

export class DocumentService {
  constructor(private client: ApiClient) {}

  async createDocument(data: { title: string; deskId?: string; tags?: string[] }): Promise<{ document: DocumentRecord }> {
    return this.client.post('/api/documents', data);
  }

  async listDocuments(params?: { search?: string; tags?: string[]; deskId?: string; limit?: number; offset?: number }): Promise<{ documents: DocumentRecord[] }> {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.tags?.length) query.set('tags', params.tags.join(','));
    if (params?.deskId) query.set('deskId', params.deskId);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    const qs = query.toString();
    return this.client.get(`/api/documents${qs ? '?' + qs : ''}`);
  }

  async getDocument(id: string): Promise<{ document: DocumentRecord }> {
    return this.client.get(`/api/documents/${id}`);
  }

  async updateDocument(id: string, data: { title?: string; content?: Record<string, unknown>; tags?: string[] }): Promise<{ document: DocumentRecord }> {
    return this.client.put(`/api/documents/${id}`, data);
  }

  async deleteDocument(id: string): Promise<{ ok: boolean }> {
    return this.client.delete(`/api/documents/${id}`);
  }
}

// Research task types
export interface ResearchTask {
  id: string
  title: string
  narrative: string | null
  assignedTo: string | null
  assignedAgent: string | null
  deskId: string | null
  status: 'pending' | 'active' | 'deep-dive' | 'complete'
  findings: Record<string, unknown> | null
  dueDate: string | null
  createdBy: string
  createdAt: string
}

export interface ResearchTaskInput {
  title: string
  narrative?: string | null
  assignedTo?: string | null
  assignedAgent?: string | null
  deskId?: string | null
  dueDate?: string | null
  createdBy: string
}

export class ResearchService {
  constructor(private client: ApiClient) {}

  async createTask(data: ResearchTaskInput): Promise<{ task: ResearchTask }> {
    return this.client.post('/api/research/tasks', data);
  }

  async listTasks(params?: { deskId?: string; status?: string; assignedTo?: string }): Promise<{ tasks: ResearchTask[] }> {
    const query = new URLSearchParams();
    if (params?.deskId) query.set('deskId', params.deskId);
    if (params?.status) query.set('status', params.status);
    if (params?.assignedTo) query.set('assignedTo', params.assignedTo);
    const qs = query.toString();
    return this.client.get(`/api/research/tasks${qs ? '?' + qs : ''}`);
  }

  async getTask(id: string): Promise<{ task: ResearchTask }> {
    return this.client.get(`/api/research/tasks/${id}`);
  }

  async updateTask(id: string, data: { status?: string; findings?: Record<string, unknown> }): Promise<{ task: ResearchTask }> {
    return this.client.put(`/api/research/tasks/${id}`, data);
  }

  async assignTask(id: string, userId: string, agentName?: string): Promise<{ task: ResearchTask }> {
    return this.client.post(`/api/research/tasks/${id}/assign`, { userId, agentName });
  }

  async deleteTask(id: string): Promise<{ ok: boolean }> {
    return this.client.delete(`/api/research/tasks/${id}`);
  }
}

// Bulletin Service (S12-T1)
export class BulletinService {
  constructor(private client: ApiClient) {}

  async createPost(data: { content: string; authorAgent?: string; deskId?: string; contentParts?: unknown[]; parentId?: string }): Promise<{ post: any }> {
    return this.client.post('/api/bulletin', data);
  }

  async listPosts(params?: { deskId?: string; limit?: number; offset?: number }): Promise<{ posts: any[] }> {
    const query = new URLSearchParams();
    if (params?.deskId) query.set('deskId', params.deskId);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    const qs = query.toString();
    return this.client.get(`/api/bulletin${qs ? '?' + qs : ''}`);
  }

  async getPost(id: string): Promise<{ post: any }> {
    return this.client.get(`/api/bulletin/${id}`);
  }

  async getPostReplies(id: string): Promise<{ replies: any[] }> {
    return this.client.get(`/api/bulletin/${id}/replies`);
  }

  async deletePost(id: string): Promise<{ ok: boolean }> {
    return this.client.delete(`/api/bulletin/${id}`);
  }

  async castVote(bulletinId: string, voteType: string): Promise<{ vote: any }> {
    return this.client.post(`/api/bulletin/${bulletinId}/vote`, { voteType });
  }

  async getVotes(bulletinId: string): Promise<{ votes: any[] }> {
    return this.client.get(`/api/bulletin/${bulletinId}/votes`);
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

export class EditorSidebarService {
  constructor(private client: ApiClient) {}

  async executeSidebarAction(action: SidebarAction): Promise<{ action: SidebarAction }> {
    return this.client.post('/api/editor/sidebar/action', action);
  }

  async listAvailableActions(): Promise<{ actions: string[] }> {
    return this.client.get('/api/editor/sidebar/actions');
  }
}

// Main Backend Client Interface
export interface BackendClient {
  account: AccountService;
  riskflow: RiskFlowService;
  ai: AIService;
  psych: PsychService;
  analysts: AnalystService;
  trading: TradingService;
  projectx: ProjectXService;
  rithmic: RithmicService;
  hyperliquid: HyperliquidService;
  notifications: NotificationsService;
  er: ERService;
  voice: VoiceService;
  events: EventsService;
  boardroom: BoardroomService;
  narrative: NarrativeService;
  notion: NotionService;
  econCalendar: EconCalendarService;
  marketData: MarketDataService;
  mcp: McpService;
  journal: JournalService;
  blindspots: BlindspotsService;
  agentPerformance: AgentPerformanceService;
  contextBank: ContextBankService;
  autopilot: AutopilotService;
  miroshark: MiroSharkService;
  peers: PeersService;
  documents: DocumentService;
  research: ResearchService;
  bulletin: BulletinService;
  skills: SkillsService;
  memory: MemoryService;
  editorSidebar: EditorSidebarService;
}

// Create backend client from API client
export function createBackendClient(client: ApiClient): BackendClient {
  return {
    account: new AccountService(client),
    riskflow: new RiskFlowService(client),
    ai: new AIService(client),
    psych: new PsychService(client),
    analysts: new AnalystService(client),
    trading: new TradingService(client),
    projectx: new ProjectXService(client),
    rithmic: new RithmicService(client),
    hyperliquid: new HyperliquidService(client),
    notifications: new NotificationsService(client),
    er: new ERService(client),
    voice: new VoiceService(client),
    events: new EventsService(client),
    boardroom: new BoardroomService(client),
    narrative: new NarrativeService(client),
    notion: new NotionService(client),
    econCalendar: new EconCalendarService(client),
    marketData: new MarketDataService(client),
    mcp: new McpService(client),
    journal: new JournalService(client),
    blindspots: new BlindspotsService(client),
    agentPerformance: new AgentPerformanceService(client),
    contextBank: new ContextBankService(client),
    autopilot: new AutopilotService(client),
    miroshark: new MiroSharkService(client),
    peers: new PeersService(client),
    documents: new DocumentService(client),
    research: new ResearchService(client),
    bulletin: new BulletinService(client),
    skills: new SkillsService(client),
    memory: new MemoryService(client),
    editorSidebar: new EditorSidebarService(client),
  };
}
