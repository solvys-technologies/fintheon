/**
 * Account Types
 * Type definitions for user accounts
 */

export type UserTier = 'free' | 'pulse' | 'pulse_plus' | 'pulse_pro';

export interface Account {
  id: string;
  userId: string;
  email: string;
  tier: UserTier;
  balance: number;
  dailyPnl: number;
  tradingEnabled: boolean;
  algoEnabled: boolean;
  riskManagement: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AccountSettings {
  tradingEnabled?: boolean;
  algoEnabled?: boolean;
  riskManagement?: boolean;
  selectedSymbol?: string;
  contractsPerTrade?: number;
}

export interface CreateAccountRequest {
  initialBalance?: number;
}

export interface UpdateSettingsRequest {
  tradingEnabled?: boolean;
  algoEnabled?: boolean;
  riskManagement?: boolean;
  selectedSymbol?: string;
  contractsPerTrade?: number;
}

export interface TierResponse {
  tier: UserTier | null;
  requiresSelection: boolean;
}

export interface SelectTierRequest {
  tier: UserTier;
}
