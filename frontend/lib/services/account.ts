/**
 * Account Service
 */

import ApiClient from "../apiClient";

// Type definitions (update these to match your Hono backend response types)
export interface Account {
  id: string;
  userId: string;
  balance: number;
  dailyPnl: number;
  dailyTarget?: number;
  dailyLossLimit?: number;
  tier?: "free" | "fintheon" | "fintheon_plus" | "fintheon_pro";
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

// Account Service
export class AccountService {
  constructor(private client: ApiClient) {}

  private mapAccountResponse(response: any, tier: Account["tier"]): Account {
    const dailyPnlRaw = response.dailyPnl ?? response.daily_pnl;
    return {
      id: response.id?.toString() || "",
      userId:
        response.userId?.toString?.() || response.user_id?.toString?.() || "",
      balance: Number(response.balance ?? 0),
      dailyPnl:
        typeof dailyPnlRaw === "number"
          ? dailyPnlRaw
          : Number(dailyPnlRaw ?? 0),
      tier,
      tradingEnabled: Boolean(
        response.tradingEnabled ?? response.trading_enabled ?? false,
      ),
      autoTrade: Boolean(
        response.autoTrade ??
        response.auto_trade ??
        response.algoEnabled ??
        response.algo_enabled ??
        false,
      ),
      riskManagement: Boolean(
        response.riskManagement ?? response.risk_management ?? false,
      ),
      algoEnabled: Boolean(
        response.algoEnabled ?? response.algo_enabled ?? false,
      ),
      topstepxUsername: response.topstepxUsername ?? response.topstepx_username,
      topstepxApiKey: response.topstepxApiKey ?? response.topstepx_api_key,
      selectedSymbol: response.selectedSymbol ?? response.selected_symbol,
      contractsPerTrade:
        response.contractsPerTrade ?? response.contracts_per_trade,
      projectxUsername: response.projectxUsername ?? response.projectx_username,
    };
  }

  async get(): Promise<Account> {
    const response = await this.client.get<any>("/api/account");
    // Get tier separately since it's not in the account response
    let tier: Account["tier"] = "free";
    try {
      const tierResponse = await this.client.get<{
        tier: Account["tier"] | null;
        requiresSelection: boolean;
      }>("/api/account/tier");
      tier = tierResponse.tier || "free";
    } catch (error) {
      // If tier endpoint fails, default to free
      // Tier fetch failed — default to free
    }

    return this.mapAccountResponse(response, tier);
  }

  async create(data: { initialBalance?: number }): Promise<Account> {
    const response = await this.client.post<any>("/api/account", data);
    // Get tier separately since it's not in the account response
    let tier: Account["tier"] = "free";
    try {
      const tierResponse = await this.client.get<{
        tier: Account["tier"] | null;
        requiresSelection: boolean;
      }>("/api/account/tier");
      tier = tierResponse.tier || "free";
    } catch (error) {
      // If tier endpoint fails, default to free
      // Tier fetch failed — default to free
    }

    return this.mapAccountResponse(response, tier);
  }

  async updateSettings(data: Partial<Account>): Promise<Account> {
    await this.client.patch("/api/account/settings", data);
    return this.get();
  }

  async updateTier(data: { tier: Account["tier"] }): Promise<Account> {
    await this.client.patch("/api/account/tier", data);
    return this.get();
  }

  async selectTier(data: { tier: Account["tier"] }): Promise<void> {
    await this.client.post("/api/account/select-tier", data);
  }

  async getTier(): Promise<{
    tier: Account["tier"] | null;
    requiresSelection: boolean;
  }> {
    return this.client.get("/api/account/tier");
  }

  async getFeatures(): Promise<{
    tier: Account["tier"];
    features: Array<{ name: string; requiredTier: string; hasAccess: boolean }>;
  }> {
    return this.client.get("/api/account/features");
  }

  async updateProjectXCredentials(data: {
    username?: string;
    apiKey?: string;
  }): Promise<void> {
    // Use projectx sync endpoint
    if (data.username && data.apiKey) {
      await this.client.post("/api/projectx/sync", data);
    }
  }
}
