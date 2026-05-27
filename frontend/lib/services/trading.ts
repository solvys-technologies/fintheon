/**
 * Trading, ProjectX, Rithmic, Hyperliquid, and Autopilot Services
 */

import ApiClient from "../apiClient";

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

export interface ProjectXStatusResponse {
  configured: boolean;
  missing: string[];
  source: string | null;
  status: string;
  activeAccountId: string | null;
  accountName: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  tradeCountToday: number;
  dailyPnl: number;
  lastTradeAt: string | null;
}

export interface ProjectXSyncResponse {
  success: boolean;
  status: string;
  missing?: string[];
  accountId?: string;
  accountCount?: number;
  fetchedCount?: number;
  upsertedCount?: number;
  httpStatus?: number;
  error?: string;
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

export interface ProjectXAccountsResponse {
  accounts: ProjectXAccount[];
}

export interface UplinkResponse {
  success: boolean;
  message: string;
}

// Rithmic Service (Autopilot primary broker scaffold)
export interface RithmicStatusResponse {
  connected: boolean;
  message: string;
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

// Trading Service
export class TradingService {
  constructor(private client: ApiClient) {}

  async listPositions(): Promise<PositionsResponse> {
    const response = await this.client.get<{ positions: any[] }>(
      "/api/trading/positions",
    );
    // Transform backend response to match frontend expectations
    return {
      positions: response.positions.map((pos) => ({
        id: pos.id?.toString() || "",
        symbol: pos.symbol || "",
        quantity: pos.size || 0,
        size: pos.size || 0,
        entryPrice: pos.entryPrice || 0,
        currentPrice: pos.entryPrice || 0, // Backend doesn't return current price
        pnl: pos.pnl || 0,
        pnlPercentage: pos.pnlPercentage || 0,
        side: pos.side || "",
        openedAt: pos.openedAt || new Date().toISOString(),
        status: "open",
      })),
    };
  }

  async seedPositions(): Promise<void> {
    // Stub - backend doesn't have this endpoint
  }

  async toggleAlgo(data: any): Promise<any> {
    const response = await this.client.post<any>(
      "/api/trading/toggle-algo",
      data,
    );
    return response;
  }

  async fireTestTrade(data: any): Promise<any> {
    const response = await this.client.post<any>(
      "/api/trading/test-trade",
      data,
    );
    return response;
  }
}

// ProjectX Service
export class ProjectXService {
  constructor(private client: ApiClient) {}

  async getStatus(): Promise<ProjectXStatusResponse> {
    return this.client.get<ProjectXStatusResponse>("/api/projectx/status");
  }

  async listAccounts(): Promise<ProjectXAccountsResponse> {
    const status = await this.getStatus();
    if (!status.activeAccountId) return { accounts: [] };
    return {
      accounts: [
        {
          accountId: status.activeAccountId,
          accountName: status.accountName ?? "ProjectX",
          balance: undefined,
          provider: "ProjectX",
          isPaper: undefined,
        },
      ],
    };
  }

  async connect(data: {
    username: string;
    apiKey: string;
    activeAccountId?: string;
  }): Promise<UplinkResponse> {
    const response = await this.client.post<{
      success: boolean;
      sync?: ProjectXSyncResponse;
    }>("/api/projectx/connect", data);
    return {
      success: response.success,
      message: response.sync?.status ?? "connected",
    };
  }

  async uplinkProjectX(): Promise<UplinkResponse> {
    const response = await this.syncProjectXAccounts("manual");
    return { success: response.success, message: response.status };
  }

  async syncProjectXAccounts(
    mode: "manual" | "active" | "fallback" | "calendar" = "manual",
  ): Promise<ProjectXSyncResponse> {
    return this.client.post<ProjectXSyncResponse>("/api/projectx/sync", {
      mode,
    });
  }

  async listTrades(params: {
    from: string;
    to: string;
    origin?: "all" | "user" | "autopilot";
  }): Promise<{ trades: any[]; source: string }> {
    const query = new URLSearchParams({
      from: params.from,
      to: params.to,
      origin: params.origin ?? "all",
    });
    return this.client.get(`/api/projectx/trades?${query.toString()}`);
  }

  async getActivity(
    _accountId: string | number,
    _params?: { windowMinutes?: number; limit?: number },
  ): Promise<ProjectXActivityResponse> {
    // STUB: No backend route
    return { orders: [], fills: [] } as unknown as ProjectXActivityResponse;
  }
}

export class RithmicService {
  constructor(private client: ApiClient) {}

  async getStatus(): Promise<RithmicStatusResponse> {
    const response = await this.client.get<RithmicStatusResponse>(
      "/api/rithmic/status",
    );
    return response;
  }
}

export class HyperliquidService {
  constructor(private client: ApiClient) {}

  async getStatus(): Promise<HyperliquidStatusResponse> {
    return this.client.get<HyperliquidStatusResponse>(
      "/api/hyperliquid/status",
    );
  }

  async getPositions(): Promise<{ positions: any[] }> {
    return this.client.get<{ positions: any[] }>("/api/hyperliquid/positions");
  }

  async getAccountInfo(): Promise<HyperliquidAccountResponse> {
    return this.client.get<HyperliquidAccountResponse>(
      "/api/hyperliquid/account",
    );
  }
}

export class AutopilotService {
  constructor(private client: ApiClient) {}

  async getStatus(): Promise<AutopilotStatusResponse> {
    return this.client.get<AutopilotStatusResponse>("/api/autopilot/status");
  }

  async getSignals(limit?: number): Promise<{ signals: any[]; total: number }> {
    const suffix = limit ? `?limit=${limit}` : "";
    return this.client.get(`/api/autopilot/signals${suffix}`);
  }

  async getPendingProposals(): Promise<{ proposals: any[]; total: number }> {
    return this.client.get("/api/autopilot/proposals");
  }

  async acknowledgeProposal(
    proposalId: string,
    decision: "approved" | "rejected",
  ): Promise<any> {
    return this.client.post("/api/autopilot/acknowledge", {
      proposalId,
      decision,
    });
  }

  async executeProposal(proposalId: string): Promise<any> {
    return this.client.post("/api/autopilot/execute", { proposalId });
  }

  async getHistory(
    limit?: number,
    status?: string,
  ): Promise<{ proposals: any[]; total: number }> {
    const query = new URLSearchParams();
    if (limit) query.append("limit", limit.toString());
    if (status) query.append("status", status);
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return this.client.get(`/api/autopilot/history${suffix}`);
  }
}
