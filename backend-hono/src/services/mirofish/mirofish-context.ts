// [claude-code 2026-03-27] S2-T4: Added addCalibrationContext for calibration upload pipeline
// [claude-code 2026-03-24] Widened RiskFlow window to 72h/40 with configurable params
// [claude-code 2026-03-23] MiroFish context assembly — fetches VIX, FRED, RiskFlow in parallel
import type { SanctumPreset, SimulationContext, RiskFlowHeadline } from './mirofish-types.js';
import { fetchFredIndicators, getCachedFredIndicators, getFredFetchedAt } from '../systemic/fred-service.js';
import { getVix } from '../market-data/yahoo-market.js';
import { getSupabaseClient } from '../../config/supabase.js';

/**
 * Assemble a SimulationContext bundle by fetching live data from all available sources.
 * Uses Promise.allSettled so one failure doesn't block others.
 * Preset controls which sources are fetched.
 */
export async function assembleSimulationContext(
  preset: SanctumPreset = 'full-brief',
): Promise<SimulationContext> {
  const fetchVix = preset !== 'econ-watch';
  const fetchFred = preset !== 'risk-scan';
  const fetchRiskFlow = preset === 'full-brief' || preset === 'risk-scan';

  const [vixResult, fredResult, riskflowResult] = await Promise.allSettled([
    fetchVix ? getVix().then(v => v.value) : Promise.resolve(null),
    fetchFred ? fetchFredIndicators() : Promise.resolve(getCachedFredIndicators()),
    fetchRiskFlow ? fetchRiskFlowHeadlines() : Promise.resolve([]),
  ]);

  const vixLevel = vixResult.status === 'fulfilled' ? vixResult.value : null;
  const fredIndicators = fredResult.status === 'fulfilled' ? (fredResult.value as Record<string, number>) : getCachedFredIndicators();
  const riskflowHeadlines = riskflowResult.status === 'fulfilled' ? riskflowResult.value : [];

  return {
    vixLevel,
    fredIndicators,
    riskflowHeadlines,
    fredFetchedAt: getFredFetchedAt()?.toISOString() ?? null,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Fetch scored RiskFlow headlines from Supabase — configurable window (default 72h, limit 40).
 */
async function fetchRiskFlowHeadlines(sinceHours = 72, limit = 40): Promise<RiskFlowHeadline[]> {
  const sb = getSupabaseClient();
  if (!sb) return [];

  const cutoff = new Date(Date.now() - sinceHours * 60 * 60 * 1000).toISOString();

  const { data, error } = await sb
    .from('scored_riskflow_items')
    .select('id, title, summary, macro_level, sentiment, iv_score, category, created_at')
    .gte('created_at', cutoff)
    .gte('macro_level', 2)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.warn('[MiroFish Context] RiskFlow fetch failed:', error.message);
    return [];
  }

  return (data ?? []) as RiskFlowHeadline[];
}

// ─── Calibration Upload Context ─────────────────────────────────

interface CalibrationContextEntry {
  source: 'calibration_upload';
  items: Array<{ headline: string; eventType: string; symbols: string[] }>;
  uploadedAt: string;
}

let calibrationContext: CalibrationContextEntry | null = null;

/**
 * Stores parsed calibration items in MiroFish's running context so they influence analysis.
 * Called by the Upload Context pipeline after bulk-ingest.
 */
export function addCalibrationContext(
  items: Array<{ headline: string; eventType: string; symbols: string[] }>
): void {
  calibrationContext = {
    source: 'calibration_upload',
    items,
    uploadedAt: new Date().toISOString(),
  };
  console.log(`[MiroFish Context] Calibration context updated: ${items.length} items`);
}

/**
 * Retrieve the current calibration context (consumed by simulation engine).
 */
export function getCalibrationContext(): CalibrationContextEntry | null {
  return calibrationContext;
}
