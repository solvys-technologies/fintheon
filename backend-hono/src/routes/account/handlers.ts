/**
 * Account Handlers
 * Request handlers for account endpoints
 */

import type { Context } from 'hono';
import * as accountService from '../../services/account-service.js';
import type { CreateAccountRequest, UpdateSettingsRequest, SelectTierRequest } from '../../types/account.js';

/**
 * GET /api/account
 * Get current user's account
 */
export async function handleGetAccount(c: Context) {
  const userId = c.get('userId') as string | undefined;
  const email = (c.get('email') as string | undefined) ?? '';

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  // Auto-create account on first access (prevents 404 spew from polling)
  const account = await accountService.getOrCreateAccount(userId, email);
  return c.json(account);
}

/**
 * POST /api/account
 * Create a new account
 */
export async function handleCreateAccount(c: Context) {
  const userId = c.get('userId') as string | undefined;
  const email = c.get('email') as string | undefined;

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const body = await c.req.json<CreateAccountRequest>().catch(() => ({ initialBalance: undefined }));
    const account = await accountService.createAccount(userId, email || '', body.initialBalance);
    return c.json(account, 201);
  } catch (error) {
    console.error('[Account] Create error:', error);
    return c.json({ error: 'Failed to create account' }, 500);
  }
}

/**
 * PATCH /api/account/settings
 * Update account settings
 */
export async function handleUpdateSettings(c: Context) {
  const userId = c.get('userId') as string | undefined;

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const body = await c.req.json<UpdateSettingsRequest>();
    const account = await accountService.updateSettings(userId, body);

    if (!account) {
      return c.json({ error: 'Account not found' }, 404);
    }

    return c.json(account);
  } catch (error) {
    console.error('[Account] Update settings error:', error);
    return c.json({ error: 'Failed to update settings' }, 500);
  }
}

/**
 * GET /api/account/tier
 * Get user's current tier
 */
export async function handleGetTier(c: Context) {
  const userId = c.get('userId') as string | undefined;

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const tierInfo = await accountService.getTier(userId);
  return c.json(tierInfo);
}

/**
 * PATCH /api/account/tier
 * Update user's tier (idempotent)
 */
export async function handleUpdateTier(c: Context) {
  const userId = c.get('userId') as string | undefined;

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const body = await c.req.json<SelectTierRequest>().catch(() => ({} as SelectTierRequest));

    if (!body.tier) {
      return c.json({ error: 'Tier is required' }, 400);
    }

    const account = await accountService.selectTier(userId, body.tier);

    if (!account) {
      return c.json({ error: 'Account not found' }, 404);
    }

    return c.json({ success: true, tier: account.tier });
  } catch (error) {
    console.error('[Account] Update tier error:', error);
    return c.json({ error: 'Failed to update tier' }, 500);
  }
}

/**
 * POST /api/account/select-tier
 * Select a tier for the account
 */
export async function handleSelectTier(c: Context) {
  const userId = c.get('userId') as string | undefined;

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const body = await c.req.json<SelectTierRequest>();

    if (!body.tier) {
      return c.json({ error: 'Tier is required' }, 400);
    }

    const account = await accountService.selectTier(userId, body.tier);

    if (!account) {
      return c.json({ error: 'Account not found' }, 404);
    }

    return c.json({ success: true, tier: account.tier });
  } catch (error) {
    console.error('[Account] Select tier error:', error);
    return c.json({ error: 'Failed to select tier' }, 500);
  }
}

/**
 * GET /api/account/features
 * Get feature access for user's tier
 */
export async function handleGetFeatures(c: Context) {
  const userId = c.get('userId') as string | undefined;

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const features = await accountService.getFeatures(userId);
  return c.json(features);
}
