// [claude-code 2026-03-15] P&L Watchdog — auto-writes daily P&L to Notion at 18:00 ET, health check at 07:05 ET

import { isETTimeMatch, isWeekday, formatETDate } from '../utils/timezone.js';
import { computeDailyPnl } from './projectx-pnl-service.js';
import { checkDailyPnlExists, writeDailyPnlToNotion } from './notion-service.js';
import { hasCredentials } from './projectx-service.js';
import { isPollingActive } from './riskflow/feed-poller.js';

const WATCHDOG_INTERVAL_MS = 60_000; // 60s tick
const DEFAULT_USER_ID = 'default';
const DEFAULT_ACCOUNT_ID = 1;

let watchdogInterval: ReturnType<typeof setInterval> | null = null;
let lastPnlWriteDate = '';
let lastHealthCheckDate = '';

// ── P&L Auto-Write (18:00 ET Mon–Fri) ────────────────────────────────────────

async function checkAndWritePnl(): Promise<void> {
  const today = formatETDate();

  // Only run once per day
  if (lastPnlWriteDate === today) return;

  // 18:00 ET with 2-minute tolerance
  if (!isETTimeMatch(18, 0, 2)) return;
  if (!isWeekday()) return;

  console.log('[Watchdog] 18:00 ET trigger — checking Daily P&L for', today);

  try {
    // Check if Notion already has an entry for today
    const exists = await checkDailyPnlExists(today);
    if (exists) {
      console.log('[Watchdog] Daily P&L already exists for', today, '— skipping');
      lastPnlWriteDate = today;
      return;
    }

    // Compute P&L from activity events
    const pnl = await computeDailyPnl(DEFAULT_USER_ID, DEFAULT_ACCOUNT_ID, today);

    if (pnl.tradesTaken === 0) {
      console.log('[Watchdog] No trades found for', today, '— skipping P&L write');
      lastPnlWriteDate = today;
      return;
    }

    // Write to Notion
    const result = await writeDailyPnlToNotion({
      date: pnl.date,
      netPnl: pnl.netPnl,
      grossPnl: pnl.grossPnl,
      winRate: pnl.winRate,
      tradesTaken: pnl.tradesTaken,
      bias: pnl.bias,
      summary: `Auto: ${pnl.winningTrades}W/${pnl.losingTrades}L, largest win $${pnl.largestWin}, largest loss $${pnl.largestLoss}`,
    });

    if (result) {
      console.log('[Watchdog] Daily P&L written successfully:', result.url);
    } else {
      console.warn('[Watchdog] Failed to write Daily P&L for', today);
    }

    lastPnlWriteDate = today;
  } catch (err) {
    console.error('[Watchdog] P&L write error:', err);
  }
}

// ── Pipeline Health Check (07:05 ET Mon–Fri) ─────────────────────────────────

export interface HealthCheckResult {
  timestamp: string;
  checks: Record<string, { ok: boolean; detail: string }>;
  allHealthy: boolean;
}

async function runHealthCheck(): Promise<HealthCheckResult> {
  const today = formatETDate();

  // Only run once per day
  if (lastHealthCheckDate === today) {
    return { timestamp: new Date().toISOString(), checks: {}, allHealthy: true };
  }

  console.log('[Watchdog] 07:05 ET health check');

  const checks: Record<string, { ok: boolean; detail: string }> = {};

  // 1. Notion poller — just check env var exists (interval is internal)
  const notionKey = Boolean(process.env.NOTION_API_KEY);
  checks['notion-poller'] = {
    ok: notionKey,
    detail: notionKey ? 'API key configured' : 'NOTION_API_KEY missing',
  };

  // 2. Feed poller
  const feedActive = isPollingActive();
  checks['feed-poller'] = {
    ok: feedActive,
    detail: feedActive ? 'Polling active' : 'Feed poller not running',
  };

  // 3. Hermes/OpenRouter gateway
  const hermesUrl = process.env.OPENCLAW_GATEWAY_URL || process.env.HERMES_URL;
  checks['hermes'] = {
    ok: Boolean(hermesUrl),
    detail: hermesUrl ? `Gateway: ${hermesUrl}` : 'No gateway URL configured',
  };

  // 4. ProjectX auth
  const pxAuth = hasCredentials(DEFAULT_USER_ID);
  checks['projectx-auth'] = {
    ok: pxAuth,
    detail: pxAuth ? 'Credentials stored' : 'No ProjectX credentials for default user',
  };

  const allHealthy = Object.values(checks).every((c) => c.ok);

  if (!allHealthy) {
    const failing = Object.entries(checks)
      .filter(([, c]) => !c.ok)
      .map(([name, c]) => `${name}: ${c.detail}`)
      .join('; ');
    console.warn('[Watchdog] Health check DEGRADED:', failing);
  } else {
    console.log('[Watchdog] Health check PASSED — all systems nominal');
  }

  lastHealthCheckDate = today;

  return {
    timestamp: new Date().toISOString(),
    checks,
    allHealthy,
  };
}

// ── Watchdog Lifecycle ────────────────────────────────────────────────────────

async function tick(): Promise<void> {
  try {
    // 18:00 ET check — daily P&L write
    await checkAndWritePnl();

    // 07:05 ET check — pipeline health
    if (isWeekday() && isETTimeMatch(7, 5, 2)) {
      await runHealthCheck();
    }
  } catch (err) {
    console.error('[Watchdog] tick error:', err);
  }
}

export function startPnlWatchdog(): void {
  if (watchdogInterval) {
    console.warn('[Watchdog] Already running — skipping duplicate start');
    return;
  }

  console.log('[Watchdog] Started (60s interval) — P&L write @ 18:00 ET, health check @ 07:05 ET');
  watchdogInterval = setInterval(tick, WATCHDOG_INTERVAL_MS);

  // Run first tick immediately (non-blocking)
  tick().catch(() => {});
}

export function stopPnlWatchdog(): void {
  if (watchdogInterval) {
    clearInterval(watchdogInterval);
    watchdogInterval = null;
    console.log('[Watchdog] Stopped');
  }
}

/** Expose health check for on-demand route calls */
export { runHealthCheck };
