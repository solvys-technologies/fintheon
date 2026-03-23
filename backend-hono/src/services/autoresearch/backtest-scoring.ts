// [claude-code 2026-03-23] Backtest scoring engine — replays historical observations through the IV scorer
// Loads scoring weights from the canonical config/scoring-weights.json and evaluates fitness.

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BacktestConfig, ScoringWeights, FitnessReport } from './types.js';
import { getObservations } from './observation-store.js';
import { generateFitnessReport } from './fitness.js';
import { loadIVScoringConfig } from '../iv-scoring-v2.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Resolve the scoring weights config path.
 * Tries __dirname-relative first (works in dist/), then walks up to src/config/.
 */
function resolveWeightsPath(): string {
  // Standard: ../../config relative to current file (works in both src/ and dist/)
  const primary = resolve(__dirname, '../../config/scoring-weights.json');
  if (existsSync(primary)) return primary;

  // Fallback: walk from repo root
  const fallback = resolve(__dirname, '../../../src/config/scoring-weights.json');
  if (existsSync(fallback)) return fallback;

  return primary; // Let it fail with a clear path
}

/**
 * Load scoring weights from a JSON file.
 * Falls back to the IV scoring config loader (shared defaults) if file not found.
 */
export function loadScoringWeights(path?: string): ScoringWeights {
  const configPath = path ?? resolveWeightsPath();
  try {
    const raw = readFileSync(configPath, 'utf-8');
    return JSON.parse(raw) as ScoringWeights;
  } catch {
    // Fall back to the shared IV scoring config loader (hardcoded defaults)
    console.warn(`[Backtest] scoring-weights.json not found at ${configPath}, using IV scoring defaults`);
    return loadIVScoringConfig() as ScoringWeights;
  }
}

/**
 * Run a backtest: fetch observations, evaluate fitness, return report.
 */
export async function runBacktest(config?: Partial<BacktestConfig>): Promise<{
  report: FitnessReport;
  weights: ScoringWeights;
  config: BacktestConfig;
}> {
  const resolved: BacktestConfig = {
    scoringWeightsPath: config?.scoringWeightsPath ?? resolveWeightsPath(),
    instrument: config?.instrument ?? '/ES',
    outcomeWindowMinutes: config?.outcomeWindowMinutes ?? 30,
    minIVScore: config?.minIVScore ?? 1,
    maxObservationAgeHours: config?.maxObservationAgeHours ?? 168,
  };

  // Load weights
  const weights = loadScoringWeights(resolved.scoringWeightsPath);

  // Fetch observations with outcomes
  const observations = await getObservations({
    instrument: resolved.instrument,
    hoursBack: resolved.maxObservationAgeHours,
    minIVScore: resolved.minIVScore,
    withOutcomesOnly: true,
  });

  // Generate fitness report
  const report = generateFitnessReport(observations);

  return { report, weights, config: resolved };
}

/**
 * Print a human-readable backtest summary to stdout.
 */
export function printBacktestSummary(report: FitnessReport, config: BacktestConfig): void {
  console.log('\n=== Autoresearch Backtest Report ===');
  console.log(`Instrument: ${config.instrument}`);
  console.log(`Outcome window: ${config.outcomeWindowMinutes} minutes`);
  console.log(`Observation age limit: ${config.maxObservationAgeHours} hours`);
  console.log(`Min IV score: ${config.minIVScore}`);
  console.log('');
  console.log(`Total observations: ${report.totalObservations}`);
  console.log(`Evaluated (with outcomes): ${report.evaluatedObservations}`);

  if (report.evaluatedObservations === 0) {
    console.log('\nInsufficient data — no observations with outcomes found.');
    console.log('Run the scoring observer for a while to collect observation/outcome pairs.');
    return;
  }

  console.log('');
  console.log(`Direction accuracy: ${report.directionAccuracy}%`);
  console.log(`Mean magnitude error: ${report.meanMagnitudeError} pts`);
  console.log(`Mean magnitude error %: ${report.meanMagnitudeErrorPct}%`);
  console.log(`Mean score accuracy: ${(report.meanScoreAccuracy * 100).toFixed(1)}%`);
  console.log(`Mean bias: ${report.meanBias > 0 ? '+' : ''}${report.meanBias} pts (${report.meanBias > 0 ? 'overpredicting' : 'underpredicting'})`);

  if (Object.keys(report.byEventType).length > 0) {
    console.log('\n--- By Event Type ---');
    for (const [et, stats] of Object.entries(report.byEventType)) {
      console.log(`  ${et}: n=${stats.count}, dir=${stats.directionAccuracy}%, err=${stats.meanMagnitudeError}pts, bias=${stats.meanBias > 0 ? '+' : ''}${stats.meanBias}`);
    }
  }

  if (Object.keys(report.bySession).length > 0) {
    console.log('\n--- By Session ---');
    for (const [sess, stats] of Object.entries(report.bySession)) {
      console.log(`  ${sess}: n=${stats.count}, dir=${stats.directionAccuracy}%, err=${stats.meanMagnitudeError}pts`);
    }
  }

  console.log(`\nGenerated: ${report.generatedAt}`);
  console.log('===================================\n');
}
