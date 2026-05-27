import ApiClient from "../apiClient";

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
  summary: {
    accountId: number;
    windowMinutes: number;
    eventCount: number;
    tradeCount: number;
    weightedTradeCount: number;
    overtradingPenalty: number;
    realizedPnl: number;
    lastEventAt: string | null;
  };
}

export interface ProjectXAccountsResponse {
  accounts: ProjectXAccount[];
}

export interface UplinkResponse {
  success: boolean;
  message: string;
}

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
          provider: "ProjectX",
        },
      ],
    };
  }

  async connect(data: {
    userName: string;
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

  async getActivity(): Promise<ProjectXActivityResponse> {
    return { events: [], summary: {} } as unknown as ProjectXActivityResponse;
  }
}
