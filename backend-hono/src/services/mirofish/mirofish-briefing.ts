// [claude-code 2026-03-23] MiroFish briefing generator — deterministic text from debate results
import type { MiroFishReport, MiroFishBriefing, SimulationContext } from './mirofish-types.js';

const CATEGORY_LABELS: Record<string, string> = {
  'geopolitical': 'Geopolitical',
  'political': 'Political',
  'monetary-policy': 'Monetary Policy',
  'earnings-corporate': 'Earnings/Corporate',
  'market-structure': 'Market Structure',
  'black-swan': 'Black Swan',
};

function ivLevel(score: number): string {
  if (score >= 8) return 'extreme';
  if (score >= 6) return 'elevated';
  if (score >= 4) return 'moderate';
  return 'low';
}

/**
 * Generate a structured text briefing from MiroFish debate results.
 * No AI call — purely deterministic from the numbers.
 */
export function generateBriefing(
  report: MiroFishReport,
  context: SimulationContext,
): MiroFishBriefing {
  const composite = report.nextSessionProjection;
  const regime = report.regimeShiftProbability;
  const conf = report.confidence;

  // Summary
  const topCategory = [...report.categoryScores].sort((a, b) => b.ivScore - a.ivScore)[0];
  const topLabel = topCategory ? CATEGORY_LABELS[topCategory.category] ?? topCategory.category : 'unknown';

  let summary = `Composite IV at ${composite.toFixed(1)}/10 (${ivLevel(composite)}). `;
  summary += `Regime shift probability ${(regime * 100).toFixed(0)}%. `;
  summary += `Model confidence ${(conf * 100).toFixed(0)}%. `;
  summary += `Dominant risk vector: ${topLabel} at ${topCategory?.ivScore.toFixed(1) ?? 'N/A'}.`;

  if (context.vixLevel != null) {
    summary += ` Live VIX: ${context.vixLevel.toFixed(1)}.`;
  }

  // Key findings
  const keyFindings: string[] = [];

  const sortedCats = [...report.categoryScores].sort((a, b) => b.ivScore - a.ivScore);
  for (const cs of sortedCats.slice(0, 3)) {
    const label = CATEGORY_LABELS[cs.category] ?? cs.category;
    const dir = cs.delta > 0 ? 'rising' : cs.delta < 0 ? 'falling' : 'stable';
    keyFindings.push(`${label}: IV ${cs.ivScore.toFixed(1)} (${dir}, conf ${(cs.confidence * 100).toFixed(0)}%)`);
  }

  const topScenario = report.scenarios[0];
  if (topScenario) {
    keyFindings.push(`Top scenario: "${topScenario.label}" — ${(topScenario.probability * 100).toFixed(0)}% probability, projected IV ${topScenario.projectedIVScore.toFixed(1)}`);
  }

  if (report.generatedEvents.length > 0) {
    const nextEvent = report.generatedEvents[0];
    keyFindings.push(`Next predicted event: "${nextEvent.title}" (${nextEvent.date.slice(5)}, impact ${nextEvent.impactScore.toFixed(0)})`);
  }

  const fredKeys = Object.keys(context.fredIndicators);
  if (fredKeys.length > 0) {
    const fredSummary = fredKeys.map(k => {
      const val = context.fredIndicators[k];
      return `${k}: ${val?.toFixed(2) ?? 'N/A'}`;
    }).join(', ');
    keyFindings.push(`FRED macro: ${fredSummary}`);
  }

  // Risk alerts
  const riskAlerts: string[] = [];
  for (const cs of report.categoryScores) {
    if (cs.ivScore >= 7) {
      const label = CATEGORY_LABELS[cs.category] ?? cs.category;
      riskAlerts.push(`${label} IV at ${cs.ivScore.toFixed(1)} — elevated risk`);
    }
  }
  if (regime >= 0.3) {
    riskAlerts.push(`Regime shift probability ${(regime * 100).toFixed(0)}% — potential structural change`);
  }
  if (context.riskflowHeadlines.length > 0) {
    const highImpact = context.riskflowHeadlines.filter(h => h.iv_score >= 6);
    if (highImpact.length > 0) {
      riskAlerts.push(`${highImpact.length} high-impact headline(s) in last 48h`);
    }
  }
  if (context.fedReserveSignal) {
    const fed = context.fedReserveSignal;
    keyFindings.push(`Fed Reserve Board: ${fed.rateDecision} (${(fed.consensusStrength * 100).toFixed(0)}% consensus), fwd guidance: ${fed.forwardGuidanceSignal}`);
    if (fed.dissentCount >= 3) {
      riskAlerts.push(`High Fed dissent (${fed.dissentCount} dissenters) — monetary policy uncertainty elevated`);
    }
    if (fed.monetaryPolicySignal >= 7) {
      riskAlerts.push(`Fed Reserve signal hawkish at ${fed.monetaryPolicySignal}/10 — tightening risk`);
    }
  }

  // Agent consensus
  const votes = report.agentVotes;
  const highVol = votes.filter(v => v.position === 'high-vol').length;
  const neutral = votes.filter(v => v.position === 'neutral').length;
  const lowVol = votes.filter(v => v.position === 'low-vol').length;
  const agentConsensus = `${votes.length} agents voted: ${highVol} high-vol, ${neutral} neutral, ${lowVol} low-vol`;

  return {
    summary,
    keyFindings,
    riskAlerts,
    agentConsensus,
    generatedAt: new Date().toISOString(),
  };
}
