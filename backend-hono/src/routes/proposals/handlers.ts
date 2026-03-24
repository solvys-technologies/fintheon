// [claude-code 2026-03-23] Browser Use Phase 2 — sync charting + SSE broadcast
import type { Context } from 'hono';
import { execFileSync } from 'child_process';
import { resolve } from 'path';
import { broadcastProposal } from '../../services/riskflow/sse-broadcaster.js';

/**
 * Returns true if current time is within 8:30 AM - 12:00 PM EST.
 */
function isBlackoutPeriod(): boolean {
  const now = new Date();
  const estParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(now);

  const hour = parseInt(estParts.find((p) => p.type === 'hour')?.value || '0', 10);
  const minute = parseInt(estParts.find((p) => p.type === 'minute')?.value || '0', 10);
  const totalMinutes = hour * 60 + minute;

  return totalMinutes >= 510 && totalMinutes < 720;
}

/**
 * POST /api/proposals/chart
 * Checks blackout, runs browser-use charting, broadcasts to feed.
 */
export async function handleChartProposal(c: Context) {
  try {
    const body = await c.req.json();
    const { ticker, direction, entry, stopLoss, takeProfit, proposalId } = body;

    if (!ticker || !direction || entry == null) {
      return c.json({ error: 'ticker, direction, and entry are required' }, 400);
    }

    if (isBlackoutPeriod()) {
      return c.json({
        success: false,
        blackout: true,
        message: 'Blackout period active (8:30a-12p EST). Charting paused.',
      });
    }

    const input = JSON.stringify({ ticker, direction, entry, stopLoss, takeProfit });
    const scriptPath = resolve(process.cwd(), '..', 'scripts', 'chart-proposal.ts');

    try {
      const result = execFileSync('bun', ['run', scriptPath, input], {
        timeout: 60000,
        encoding: 'utf-8',
        env: { ...process.env },
      });

      const parsed = JSON.parse(result);

      if (parsed.success) {
        broadcastProposal({
          ticker,
          direction,
          entry,
          stopLoss,
          takeProfit,
          screenshotPath: parsed.screenshotPath,
          proposalId,
        });
      }

      return c.json(parsed);
    } catch (execError: any) {
      console.error('[Proposals] Chart script failed:', execError.message);
      return c.json({ success: false, error: execError.message || 'Chart script failed' }, 500);
    }
  } catch (error: any) {
    console.error('[Proposals] Chart error:', error);
    return c.json({ error: error.message || 'Failed to chart proposal' }, 500);
  }
}
