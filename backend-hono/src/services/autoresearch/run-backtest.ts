#!/usr/bin/env bun
// [claude-code 2026-03-23] CLI entry point for autoresearch backtest
// Usage: bun run backend-hono/src/services/autoresearch/run-backtest.ts

import { runBacktest, printBacktestSummary } from './backtest-scoring.js';

async function main(): Promise<void> {
  console.log('[Autoresearch] Starting backtest...');

  try {
    const { report, config } = await runBacktest({
      instrument: process.env.PRIMARY_INSTRUMENT ?? '/ES',
      outcomeWindowMinutes: 30,
      minIVScore: 1,
      maxObservationAgeHours: 168,
    });

    printBacktestSummary(report, config);

    if (report.evaluatedObservations === 0) {
      console.log('[Autoresearch] Exiting — insufficient data for backtest.');
      process.exit(1);
    }
  } catch (error) {
    console.error('[Autoresearch] Backtest failed:', error);
    process.exit(1);
  }
}

main();
