// Federal Reserve simulation lifecycle orchestrator
// Manages session creation, deliberation execution, caching, and Supabase persistence

import type {
  FedSessionReport,
  FedSessionSummary,
  FedReserveContextSignal,
} from './fed-reserve-types.js';
import { assembleFedContext } from './fed-reserve-context.js';
import { runDeliberation } from './fed-reserve-engine.js';
import { isSkillEnabled } from '../../config/feature-flags.js';
import { getSupabaseClient } from '../../config/supabase.js';

/** In-memory session cache */
const sessionCache = new Map<string, FedSessionReport>();

/** Latest signal for MiroFish consumption */
let _latestSignal: FedReserveContextSignal | null = null;

export function isFedReserveEnabled(): boolean {
  return isSkillEnabled('mirofish');
}

/**
 * Run a full FOMC simulation session.
 * Assembles context → runs multi-round deliberation → persists results.
 */
export async function startSession(): Promise<{ sessionId: string } | { error: string }> {
  if (!isFedReserveEnabled()) {
    return { error: 'Federal Reserve board is not enabled (requires mirofish skill)' };
  }

  const sessionId = crypto.randomUUID();
  const placeholder: FedSessionReport = {
    sessionId,
    status: 'running',
    context: { currentFedFundsRate: 0, latestCPI: null, latestPCE: null, unemploymentRate: null, gdpGrowth: null, yieldCurve2s10s: null, vixLevel: null, recentFedSpeeches: [], riskflowHeadlines: [], fetchedAt: new Date().toISOString() },
    agents: [],
    deliberationRounds: [],
    rateDecision: { decision: 'hold', voteCount: { 'hike-50': 0, 'hike-25': 0, 'hold': 0, 'cut-25': 0, 'cut-50': 0 }, totalVotes: 0, dissentCount: 0, consensusStrength: 0, medianDotPlot: 5, dotPlotRange: { low: 4, high: 6 } },
    forwardGuidance: { signal: 'data-dependent', hawkishProbability: 0, dovishProbability: 0, nextMeetingExpectation: 'hold', keyRisks: [], dissenterNarratives: [] },
    monetaryPolicySignal: 5,
    signalConfidence: 0,
    regimeShiftProbability: 0.05,
    briefingSummary: 'Session in progress...',
    generatedAt: new Date().toISOString(),
  };
  sessionCache.set(sessionId, placeholder);

  // Run async — don't block the response
  runSessionAsync(sessionId).catch(err => {
    console.error('[FedReserve] Session failed:', err);
    const cached = sessionCache.get(sessionId);
    if (cached) {
      cached.status = 'error';
      cached.error = err instanceof Error ? err.message : 'Unknown error';
    }
  });

  return { sessionId };
}

async function runSessionAsync(sessionId: string): Promise<void> {
  const context = await assembleFedContext();

  const result = await runDeliberation(context);

  const report: FedSessionReport = {
    sessionId,
    status: 'complete',
    context,
    ...result,
    generatedAt: new Date().toISOString(),
  };

  sessionCache.set(sessionId, report);

  // Update the latest signal for MiroFish consumption
  _latestSignal = {
    monetaryPolicySignal: report.monetaryPolicySignal,
    signalConfidence: report.signalConfidence,
    regimeShiftProbability: report.regimeShiftProbability,
    rateDecision: report.rateDecision.decision,
    consensusStrength: report.rateDecision.consensusStrength,
    forwardGuidanceSignal: report.forwardGuidance.signal,
    dissentCount: report.rateDecision.dissentCount,
    medianDotPlot: report.rateDecision.medianDotPlot,
    sessionId,
    generatedAt: report.generatedAt,
  };

  // Persist to Supabase (fire-and-forget)
  persistSession(report).catch(err => {
    console.warn('[FedReserve] Failed to persist session:', err);
  });
}

/** Get session status/report */
export function getSession(sessionId: string): FedSessionReport | null {
  return sessionCache.get(sessionId) ?? null;
}

/** Get the latest signal for MiroFish integration */
export function getLatestFedSignal(): FedReserveContextSignal | null {
  return _latestSignal;
}

/** Get session history from Supabase */
export async function getSessionHistory(limit = 10): Promise<FedSessionSummary[]> {
  const sb = getSupabaseClient();
  if (!sb) return [];

  const { data, error } = await sb
    .from('fed_reserve_sessions')
    .select('session_id, decision, dissent_count, consensus_strength, monetary_policy_signal, signal_confidence, briefing_summary, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.warn('[FedReserve] History fetch failed:', error.message);
    return [];
  }

  return (data ?? []).map(row => ({
    sessionId: row.session_id,
    decision: row.decision,
    dissentCount: row.dissent_count,
    consensusStrength: row.consensus_strength,
    monetaryPolicySignal: row.monetary_policy_signal,
    signalConfidence: row.signal_confidence,
    briefingSummary: row.briefing_summary,
    createdAt: row.created_at,
  }));
}

/** Check if we should auto-run a new session (>2h stale) */
export async function shouldAutoRunFed(): Promise<{ shouldRun: boolean; lastRunAt: string | null }> {
  const sb = getSupabaseClient();
  if (!sb) return { shouldRun: true, lastRunAt: null };

  const { data } = await sb
    .from('fed_reserve_sessions')
    .select('created_at')
    .order('created_at', { ascending: false })
    .limit(1);

  if (!data?.length) return { shouldRun: true, lastRunAt: null };

  const lastRunAt = data[0].created_at;
  const staleness = (Date.now() - new Date(lastRunAt).getTime()) / (60 * 60 * 1000);
  return { shouldRun: staleness > 2, lastRunAt };
}

async function persistSession(report: FedSessionReport): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) return;

  await sb.from('fed_reserve_sessions').insert({
    session_id: report.sessionId,
    decision: report.rateDecision.decision,
    vote_count: report.rateDecision.voteCount,
    dissent_count: report.rateDecision.dissentCount,
    consensus_strength: report.rateDecision.consensusStrength,
    median_dot_plot: report.rateDecision.medianDotPlot,
    dot_plot_range: report.rateDecision.dotPlotRange,
    monetary_policy_signal: report.monetaryPolicySignal,
    signal_confidence: report.signalConfidence,
    regime_shift_probability: report.regimeShiftProbability,
    forward_guidance: report.forwardGuidance,
    deliberation_rounds: report.deliberationRounds,
    context_snapshot: report.context,
    briefing_summary: report.briefingSummary,
  });
}
