/**
 * ProjectX Handlers
 * Request handlers for ProjectX endpoints
 */

import type { Context } from 'hono';
import * as projectxService from '../../services/projectx-service.js';
import type { SyncCredentialsRequest } from '../../types/projectx.js';
import { getActivity, recordActivityEvents } from '../../services/projectx-activity-service.js';
import { computeDailyPnl } from '../../services/projectx-pnl-service.js';
import { writeDailyPnlToNotion, checkDailyPnlExists } from '../../services/notion-service.js';
import { runHealthCheck } from '../../services/pnl-watchdog.js';

const isDev = process.env.NODE_ENV !== 'production';

/**
 * GET /api/projectx/accounts
 * Get linked ProjectX accounts
 */
export async function handleGetAccounts(c: Context) {
  const userId = c.get('userId') as string | undefined;

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    // Check if credentials configured
    if (!projectxService.hasCredentials(userId)) {
      // Return mock data in development
      if (isDev) {
        return c.json(projectxService.getMockAccounts());
      }
      return c.json({ error: 'ProjectX not connected', code: 'NOT_CONNECTED' }, 400);
    }

    const accounts = await projectxService.getAccounts(userId);
    return c.json(accounts);
  } catch (error) {
    console.error('[ProjectX] Get accounts error:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch accounts';
    return c.json({ error: message }, 500);
  }
}

/**
 * POST /api/projectx/sync
 * Sync/store ProjectX credentials
 */
export async function handleSyncCredentials(c: Context) {
  const userId = c.get('userId') as string | undefined;

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const body = await c.req.json<SyncCredentialsRequest>().catch(() => null);

    if (!body?.username || !body?.apiKey) {
      return c.json({ error: 'Username and API key are required' }, 400);
    }

    const result = await projectxService.syncCredentials(userId, {
      username: body.username,
      apiKey: body.apiKey,
    });

    return c.json(result);
  } catch (error) {
    console.error('[ProjectX] Sync error:', error);
    const message = error instanceof Error ? error.message : 'Failed to sync credentials';

    // Handle specific auth errors
    if (message.includes('auth failed')) {
      return c.json({ error: 'Invalid credentials', code: 'AUTH_FAILED' }, 401);
    }

    return c.json({ error: message }, 500);
  }
}

/**
 * GET /api/projectx/positions/:accountId
 * Get positions for a specific account
 */
export async function handleGetPositions(c: Context) {
  const userId = c.get('userId') as string | undefined;
  const accountIdParam = c.req.param('accountId');

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const accountId = parseInt(accountIdParam, 10);
  if (isNaN(accountId)) {
    return c.json({ error: 'Invalid account ID' }, 400);
  }

  try {
    if (!projectxService.hasCredentials(userId)) {
      if (isDev) {
        return c.json(projectxService.getMockPositions(accountId));
      }
      return c.json({ error: 'ProjectX not connected', code: 'NOT_CONNECTED' }, 400);
    }

    const positions = await projectxService.getPositions(userId, accountId);
    return c.json(positions);
  } catch (error) {
    console.error('[ProjectX] Get positions error:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch positions';
    return c.json({ error: message }, 500);
  }
}

/**
 * GET /api/projectx/status
 * Check connection status
 */
export async function handleCheckConnection(c: Context) {
  const userId = c.get('userId') as string | undefined;

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const connected = projectxService.hasCredentials(userId);

  return c.json({
    connected,
    message: connected ? 'ProjectX connected' : 'Not connected',
  });
}

/**
 * POST /api/projectx/disconnect
 * Clear stored credentials
 */
export async function handleDisconnect(c: Context) {
  const userId = c.get('userId') as string | undefined;

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  projectxService.clearCredentials(userId);

  return c.json({ success: true, message: 'Disconnected from ProjectX' });
}

/**
 * GET /api/projectx/activity/:accountId
 * Aggregated trading activity for ER weighting and UI displays
 */
export async function handleGetActivity(c: Context) {
  const userId = c.get('userId') as string | undefined;
  const accountIdParam = c.req.param('accountId');

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const accountId = Number.parseInt(accountIdParam, 10);
  if (!Number.isFinite(accountId)) {
    return c.json({ error: 'Invalid account ID' }, 400);
  }

  const windowMinutesRaw = c.req.query('windowMinutes');
  const limitRaw = c.req.query('limit');
  const windowMinutes = windowMinutesRaw ? Number.parseInt(windowMinutesRaw, 10) : undefined;
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;

  try {
    const activity = await getActivity(userId, accountId, {
      windowMinutes: Number.isFinite(windowMinutes) ? windowMinutes : undefined,
      limit: Number.isFinite(limit) ? limit : undefined,
      overtradingThreshold: 5,
    });
    return c.json({
      accountId,
      events: activity.events,
      summary: activity.summary,
    });
  } catch (error) {
    console.error('[ProjectX] Get activity error:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch activity';
    return c.json({ error: message }, 500);
  }
}

/**
 * POST /api/projectx/activity/ingest
 * Accepts events from external SignalR bridges.
 */
export async function handleIngestActivityEvents(c: Context) {
  const userId = c.get('userId') as string | undefined;

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const body = await c.req
    .json<{
      events?: Array<{
        accountId: number;
        eventType: string;
        eventSource?: string;
        eventTimestamp?: string;
        isTrade?: boolean;
        symbol?: string;
        side?: string;
        quantity?: number;
        price?: number;
        realizedPnl?: number;
        eventWeight?: number;
        payload?: Record<string, unknown>;
      }>;
    }>()
    .catch(() => null);

  if (!body?.events || !Array.isArray(body.events) || body.events.length === 0) {
    return c.json({ error: 'events array is required' }, 400);
  }

  try {
    const inserted = await recordActivityEvents(
      userId,
      body.events
        .map((event) => ({
          ...event,
          accountId:
            typeof event.accountId === 'number'
              ? event.accountId
              : Number.parseInt(String(event.accountId), 10),
        }))
        .filter((event) => Number.isFinite(event.accountId) && typeof event.eventType === 'string')
        .map((event) => ({
          accountId: event.accountId as number,
          eventType: event.eventType,
          eventSource: event.eventSource ?? 'signalr',
          eventTimestamp: event.eventTimestamp,
          isTrade: Boolean(event.isTrade),
          symbol: event.symbol,
          side: event.side,
          quantity: event.quantity,
          price: event.price,
          realizedPnl: event.realizedPnl,
          eventWeight: event.eventWeight,
          payload: event.payload,
        }))
    );

    return c.json({ success: true, inserted });
  } catch (error) {
    console.error('[ProjectX] Activity ingest error:', error);
    const message = error instanceof Error ? error.message : 'Failed to ingest activity events';
    return c.json({ error: message }, 500);
  }
}

/**
 * POST /api/projectx/daily-pnl
 * Compute daily P&L and optionally write to Notion.
 * Body: { accountId?: number, date?: string, writeToNotion?: boolean }
 */
export async function handleDailyPnl(c: Context) {
  const userId = c.get('userId') as string | undefined;

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const body = await c.req
    .json<{ accountId?: number; date?: string; writeToNotion?: boolean }>()
    .catch(() => ({} as { accountId?: number; date?: string; writeToNotion?: boolean }));

  const accountId = typeof body.accountId === 'number' ? body.accountId : 1;
  const date = body.date; // optional — defaults to today ET inside computeDailyPnl

  try {
    const pnl = await computeDailyPnl(userId, accountId, date);

    let notionResult: { id: string; url: string } | null = null;

    if (body.writeToNotion) {
      const exists = await checkDailyPnlExists(pnl.date);
      if (exists) {
        return c.json({ pnl, notion: { skipped: true, reason: 'Entry already exists' } });
      }

      notionResult = await writeDailyPnlToNotion({
        date: pnl.date,
        netPnl: pnl.netPnl,
        grossPnl: pnl.grossPnl,
        winRate: pnl.winRate,
        tradesTaken: pnl.tradesTaken,
        bias: pnl.bias,
        summary: `Manual: ${pnl.winningTrades}W/${pnl.losingTrades}L`,
      });
    }

    return c.json({ pnl, notion: notionResult ? { written: true, url: notionResult.url } : undefined });
  } catch (error) {
    console.error('[ProjectX] Daily P&L error:', error);
    const message = error instanceof Error ? error.message : 'Failed to compute daily P&L';
    return c.json({ error: message }, 500);
  }
}

/**
 * GET /api/projectx/health-check
 * On-demand pipeline health check
 */
export async function handleHealthCheck(c: Context) {
  try {
    const result = await runHealthCheck();
    return c.json(result);
  } catch (error) {
    console.error('[ProjectX] Health check error:', error);
    return c.json({ error: 'Health check failed' }, 500);
  }
}
