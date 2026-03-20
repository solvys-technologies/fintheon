// [claude-code 2026-03-20] T5b: Proposal charting handlers — spawn Playwright to draw on TopStepX
import type { Context } from 'hono';
import { spawn } from 'child_process';
import { resolve } from 'path';

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
 * Checks blackout, then spawns the Playwright chart script.
 */
export async function handleChartProposal(c: Context) {
  try {
    const body = await c.req.json();
    const { ticker, direction, entry, stopLoss, takeProfit } = body;

    if (!ticker || !direction || entry == null) {
      return c.json({ error: 'ticker, direction, and entry are required' }, 400);
    }

    // Check blackout period
    if (isBlackoutPeriod()) {
      return c.json({
        success: false,
        blackout: true,
        message: 'Blackout period active (8:30a-12p EST). Charting paused.',
      });
    }

    const input = JSON.stringify({ ticker, direction, entry, stopLoss, takeProfit });
    const scriptPath = resolve(process.cwd(), '..', 'scripts', 'chart-proposal.ts');

    // Spawn the Playwright script as a detached process
    const child = spawn('bun', ['run', scriptPath, input], {
      detached: true,
      stdio: 'ignore',
      env: { ...process.env },
    });
    child.unref();

    console.log(`[Proposals] Spawned chart script for ${ticker} ${direction} @ ${entry} (PID: ${child.pid})`);

    return c.json({
      success: true,
      message: `Charting ${ticker} ${direction} @ ${entry}`,
      pid: child.pid,
    });
  } catch (error: any) {
    console.error('[Proposals] Chart error:', error);
    return c.json({ error: error.message || 'Failed to chart proposal' }, 500);
  }
}
