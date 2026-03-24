// [claude-code 2026-03-23] Browser Use Phase 2 — chart-proposal via browser-use CLI
import { execFileSync } from 'child_process';
import { isBlackoutPeriod } from './chart-blackout.js';

interface ChartProposalInput {
  ticker: string;
  direction: 'long' | 'short';
  entry: number;
  stopLoss: number;
  takeProfit: number;
}

const CDP_URL = 'http://localhost:9222';

function runBrowserUse(args: string[]): string {
  return execFileSync('browser-use', ['--cdp-url', CDP_URL, '--json', ...args], {
    timeout: 30000,
    encoding: 'utf-8',
    env: { ...process.env },
  });
}

function drawLevels(input: ChartProposalInput): { success: boolean; screenshotPath?: string; error?: string } {
  // Get current page state
  let stateRaw: string;
  try {
    stateRaw = runBrowserUse(['state']);
  } catch {
    return { success: false, error: 'Failed to get browser state — is Fintheon running?' };
  }

  let state: { url?: string };
  try {
    state = JSON.parse(stateRaw);
  } catch {
    state = { url: '' };
  }

  // Check if we're on TopStep X — if not, navigate
  const currentUrl = state.url || '';
  if (!currentUrl.includes('topstepx.com')) {
    try {
      runBrowserUse(['open', 'https://app.topstepx.com']);
      // Brief pause for page load
      execFileSync('sleep', ['3']);
    } catch (err: any) {
      return { success: false, error: `Failed to navigate to TopStep X: ${err.message}` };
    }
  }

  // Build the TradingView createShape eval script for all three levels
  // TopStep X uses TradingView charting — access via iframe or direct widget
  const drawScript = `
    (function() {
      var chart;
      var iframe = document.querySelector('iframe[id*="tradingview"], iframe[src*="tradingview"]');
      if (iframe && iframe.contentWindow) {
        var w = iframe.contentWindow;
        chart = (w.tvWidget && w.tvWidget.activeChart ? w.tvWidget.activeChart() : null)
          || (w.TradingView && w.TradingView.widget && w.TradingView.widget.activeChart ? w.TradingView.widget.activeChart() : null);
      }
      if (!chart) {
        chart = (window.tvWidget && window.tvWidget.activeChart ? window.tvWidget.activeChart() : null)
          || (window.TradingView && window.TradingView.widget && window.TradingView.widget.activeChart ? window.TradingView.widget.activeChart() : null);
      }
      if (!chart) return JSON.stringify({ ok: false, error: 'TradingView chart not found' });

      var now = Math.floor(Date.now() / 1000);

      chart.createShape(
        { time: now, price: ${input.entry} },
        { shape: 'horizontal_line', lock: true, disableSelection: false,
          overrides: { linecolor: '#22c55e', linewidth: 2, linestyle: 0, showLabel: true, text: 'ENTRY ${input.entry}' } }
      );

      chart.createShape(
        { time: now, price: ${input.stopLoss} },
        { shape: 'horizontal_line', lock: true, disableSelection: false,
          overrides: { linecolor: '#ef4444', linewidth: 2, linestyle: 2, showLabel: true, text: 'STOP ${input.stopLoss}' } }
      );

      chart.createShape(
        { time: now, price: ${input.takeProfit} },
        { shape: 'horizontal_line', lock: true, disableSelection: false,
          overrides: { linecolor: '#3b82f6', linewidth: 2, linestyle: 0, showLabel: true, text: 'TARGET ${input.takeProfit}' } }
      );

      return JSON.stringify({ ok: true });
    })()
  `.replace(/\n/g, ' ');

  try {
    const evalResult = runBrowserUse(['eval', drawScript]);
    const parsed = JSON.parse(evalResult);
    if (parsed.ok === false) {
      return { success: false, error: parsed.error || 'Failed to draw levels' };
    }
  } catch (err: any) {
    return { success: false, error: `Eval failed: ${err.message}` };
  }

  // Take screenshot
  const timestamp = Date.now();
  const screenshotPath = `/tmp/proposal-chart-${input.ticker}-${timestamp}.png`;
  try {
    runBrowserUse(['screenshot', screenshotPath]);
  } catch {
    // Screenshot is non-critical — continue without it
  }

  console.error(`[chart-proposal] Charted ${input.ticker} ${input.direction} — Entry: ${input.entry}, SL: ${input.stopLoss}, TP: ${input.takeProfit}`);
  return { success: true, screenshotPath };
}

// CLI entry: bun run scripts/chart-proposal.ts '{"ticker":"MNQ","direction":"long","entry":19250,"stopLoss":19220,"takeProfit":19300}'
async function main() {
  const rawInput = process.argv[2];
  if (!rawInput) {
    console.error('Usage: bun run scripts/chart-proposal.ts \'{"ticker":"MNQ","direction":"long","entry":19250,"stopLoss":19220,"takeProfit":19300}\'');
    process.exit(1);
  }

  const input = JSON.parse(rawInput) as ChartProposalInput;

  if (isBlackoutPeriod()) {
    console.log(JSON.stringify({ success: false, error: 'Blackout period (8:30a-12p EST)' }));
    process.exit(1);
  }

  try {
    const result = drawLevels(input);
    console.log(JSON.stringify(result));
    process.exit(result.success ? 0 : 1);
  } catch (err: any) {
    console.log(JSON.stringify({ success: false, error: err.message }));
    process.exit(1);
  }
}

main();
