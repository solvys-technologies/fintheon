/**
 * Account Service
 * Business logic for account operations
 */

import * as accountQueries from '../db/queries/account.js';
import type { Account, UserTier, AccountSettings, TierResponse } from '../types/account.js';

export async function getAccount(userId: string): Promise<Account | null> {
  return accountQueries.getAccountByUserId(userId);
}

export async function getOrCreateAccount(userId: string, email: string): Promise<Account> {
  const existing = await accountQueries.getAccountByUserId(userId);
  if (existing) return existing;

  return accountQueries.createAccount(userId, email);
}

export async function createAccount(userId: string, email: string, initialBalance?: number): Promise<Account> {
  const existing = await accountQueries.getAccountByUserId(userId);
  if (existing) return existing;

  return accountQueries.createAccount(userId, email, initialBalance);
}

export async function updateSettings(userId: string, settings: AccountSettings): Promise<Account | null> {
  return accountQueries.updateAccountSettings(userId, settings);
}

export async function getTier(userId: string): Promise<TierResponse> {
  const account = await accountQueries.getAccountByUserId(userId);

  if (!account) {
    return { tier: null, requiresSelection: true };
  }

  return {
    tier: account.tier,
    requiresSelection: account.tier === 'free',
  };
}

export async function selectTier(userId: string, tier: UserTier): Promise<Account | null> {
  return accountQueries.updateAccountTier(userId, tier);
}

export async function getFeatures(userId: string): Promise<{
  tier: UserTier;
  features: Array<{ name: string; requiredTier: string; hasAccess: boolean }>;
}> {
  const account = await accountQueries.getAccountByUserId(userId);
  const tier = account?.tier || 'free';

  const tierLevel: Record<UserTier, number> = {
    free: 0,
    pulse: 1,
    pulse_plus: 2,
    pulse_pro: 3,
  };

  const features = [
    { name: 'riskflow', requiredTier: 'free' },
    { name: 'ai_chat', requiredTier: 'pulse' },
    { name: 'autopilot', requiredTier: 'pulse_plus' },
    { name: 'agents', requiredTier: 'pulse_pro' },
  ];

  return {
    tier,
    features: features.map((f) => ({
      ...f,
      hasAccess: tierLevel[tier] >= tierLevel[f.requiredTier as UserTier],
    })),
  };
}
