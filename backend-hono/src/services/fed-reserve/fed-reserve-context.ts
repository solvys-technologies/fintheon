// Federal Reserve context assembly — fetches FRED data, VIX, RiskFlow headlines for FOMC simulation

import type { FedSessionContext } from './fed-reserve-types.js';
import { fetchFredIndicators, getCachedFredIndicators } from '../systemic/fred-service.js';
import { getVix } from '../market-data/yahoo-market.js';
import { getSupabaseClient } from '../../config/supabase.js';

/**
 * Assemble the economic context for an FOMC simulation.
 * Focuses on monetary-policy-relevant indicators.
 */
export async function assembleFedContext(): Promise<FedSessionContext> {
  const [vixResult, fredResult, headlinesResult] = await Promise.allSettled([
    getVix().then(v => v.value),
    fetchFredIndicators(),
    fetchMonetaryHeadlines(),
  ]);

  const vixLevel = vixResult.status === 'fulfilled' ? vixResult.value : null;
  const fred = fredResult.status === 'fulfilled'
    ? (fredResult.value as Record<string, number>)
    : getCachedFredIndicators();
  const headlines = headlinesResult.status === 'fulfilled' ? headlinesResult.value : [];

  return {
    currentFedFundsRate: fred.fedFundsRate ?? 5.33,
    latestCPI: fred.cpiYoY ?? null,
    latestPCE: fred.pceCoreYoY ?? null,
    unemploymentRate: fred.unemploymentRate ?? null,
    gdpGrowth: fred.gdpGrowthQoQ ?? null,
    yieldCurve2s10s: fred.yieldCurve2s10s ?? null,
    vixLevel,
    recentFedSpeeches: [],
    riskflowHeadlines: headlines,
    fetchedAt: new Date().toISOString(),
  };
}

async function fetchMonetaryHeadlines(): Promise<FedSessionContext['riskflowHeadlines']> {
  const sb = getSupabaseClient();
  if (!sb) return [];

  const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();

  const { data, error } = await sb
    .from('scored_riskflow_items')
    .select('title, sentiment, macro_level')
    .gte('created_at', cutoff)
    .gte('macro_level', 2)
    .or('title.ilike.%fed%,title.ilike.%fomc%,title.ilike.%rate%,title.ilike.%inflation%,title.ilike.%cpi%,title.ilike.%employment%,title.ilike.%treasury%,title.ilike.%powell%')
    .order('created_at', { ascending: false })
    .limit(15);

  if (error) {
    console.warn('[FedReserve Context] Headlines fetch failed:', error.message);
    return [];
  }

  return (data ?? []).map(row => ({
    title: row.title,
    sentiment: row.sentiment,
    macroLevel: row.macro_level,
  }));
}
