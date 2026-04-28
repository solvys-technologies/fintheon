// [claude-code 2026-03-28] S4-T2: Rewrote briefing with trader-friendly language (Market Heat, Regime Risk, Signal Strength)
// [claude-code 2026-03-23] AgentDesk briefing generator — deterministic text from debate results
// [claude-code 2026-04-17] Slop-detection: when a run has no real signal, emit the explicit fallback string instead of templated heat/regime slop
import type {
  AgentDeskReport,
  AgentDeskBriefing,
  SimulationContext,
} from "./agent-desk-types.js";

export const SLOP_FALLBACK =
  "No new agentic updates. Trigger an update in Aquarium.";

function isSlopRun(
  report: AgentDeskReport,
  context: SimulationContext,
): boolean {
  const allDefault = report.categoryScores.every(
    (cs) => Math.abs(cs.ivScore - 5.0) < 0.15 && Math.abs(cs.delta) < 0.15,
  );
  const noHeadlines = (context.riskflowHeadlines?.length ?? 0) === 0;
  const lowConfidence = report.confidence <= 0.3;
  return allDefault && noHeadlines && lowConfidence;
}

const CATEGORY_LABELS: Record<string, string> = {
  geopolitical: "Geopolitical",
  political: "Political",
  "monetary-policy": "Monetary Policy",
  "earnings-corporate": "Earnings/Corporate",
  "market-structure": "Market Structure",
  "black-swan": "Black Swan",
};

const CATEGORY_TRADING_IMPLICATIONS: Record<string, string> = {
  geopolitical: "Watch /ES for gap risk, avoid overnight holds",
  political: "Watch /ES for gap risk, avoid overnight holds",
  "monetary-policy": "Bonds lead — check /ZN before equity entries",
  "earnings-corporate": "Single-stock vol elevated — spreads over directional",
  "market-structure": "Liquidity thinning — reduce size on breakouts",
  "black-swan": "Tail risk elevated — consider put spreads or stay flat",
};

function heatInterpretation(score: number): string {
  if (score >= 9)
    return "Extreme heat — capital preservation mode, hedge or sit flat";
  if (score >= 7)
    return "High heat — reduce size, widen stops, favor reactive over predictive";
  if (score >= 5)
    return "Elevated heat — expect wider ranges and faster reversals";
  if (score >= 3) return "Moderate heat — normal conditions, play the setups";
  return "Low heat — range-bound, fade extremes";
}

/**
 * Generate a structured text briefing from AgentDesk debate results.
 * No AI call — purely deterministic from the numbers.
 * Uses trader-friendly language: Market Heat, Regime Risk, Signal Strength.
 */
export function generateBriefing(
  report: AgentDeskReport,
  context: SimulationContext,
): AgentDeskBriefing {
  // Slop guard: no real signal → explicit fallback, not templated heat/regime slop
  if (isSlopRun(report, context)) {
    return {
      summary: SLOP_FALLBACK,
      keyFindings: [],
      harperAnalysis: SLOP_FALLBACK,
    } as AgentDeskBriefing;
  }

  const composite = report.nextSessionProjection;
  const regime = report.regimeShiftProbability;
  const conf = report.confidence;

  // ── Summary ──
  const topCategory = [...report.categoryScores].sort(
    (a, b) => b.ivScore - a.ivScore,
  )[0];
  const topLabel = topCategory
    ? (CATEGORY_LABELS[topCategory.category] ?? topCategory.category)
    : "unknown";

  let summary = `Market heat ${heatInterpretation(composite).split("—")[0].trim().toLowerCase()} at ${composite.toFixed(1)} — ${heatInterpretation(composite).split("—")[1]?.trim() ?? "monitor conditions"}.\n`;
  summary += `Regime risk at ${(regime * 100).toFixed(0)}% — ${regime >= 0.4 ? "structural shift possible, tighten stops on trend trades" : regime >= 0.2 ? "elevated but contained, stay nimble" : "low probability, trends intact"}.\n`;
  summary += `Signal strength ${(conf * 100).toFixed(0)}% — ${conf >= 0.7 ? "high-conviction read, size accordingly" : conf >= 0.4 ? "moderate conviction, standard sizing" : "low conviction, reduce exposure"}.\n`;
  summary += `Primary driver: ${topLabel} (${topCategory?.ivScore.toFixed(1) ?? "N/A"}).`;

  if (context.vixLevel != null) {
    summary += ` Live VIX: ${context.vixLevel.toFixed(1)}.`;
  }

  // ── Key Findings ──
  const keyFindings: string[] = [];

  const sortedCats = [...report.categoryScores].sort(
    (a, b) => b.ivScore - a.ivScore,
  );
  for (const cs of sortedCats.slice(0, 3)) {
    const label = CATEGORY_LABELS[cs.category] ?? cs.category;
    const dir = cs.delta > 0 ? "rising" : cs.delta < 0 ? "falling" : "stable";
    const implication = CATEGORY_TRADING_IMPLICATIONS[cs.category] ?? "";
    keyFindings.push(
      `${label} heat ${cs.ivScore.toFixed(1)} and ${dir} — ${implication || "monitor for developments"}. ${(cs.confidence * 100).toFixed(0)}% signal strength.`,
    );
  }

  const topScenario = report.scenarios[0];
  if (topScenario) {
    keyFindings.push(
      `Top scenario: "${topScenario.label}" — ${(topScenario.probability * 100).toFixed(0)}% probability, projected heat ${topScenario.projectedIVScore.toFixed(1)}.`,
    );
  }

  if (report.generatedEvents.length > 0) {
    const nextEvent = report.generatedEvents[0];
    keyFindings.push(
      `Next predicted event: "${nextEvent.title}" (${nextEvent.date.slice(5)}, impact ${nextEvent.impactScore.toFixed(0)}).`,
    );
  }

  // Econ print pattern analysis
  if (context.econPrintHistory?.length) {
    const beats = context.econPrintHistory.filter(
      (p) => p.direction === "beat",
    ).length;
    const misses = context.econPrintHistory.filter(
      (p) => p.direction === "miss",
    ).length;
    const total = context.econPrintHistory.length;

    if (beats > misses * 2) {
      keyFindings.push(
        `Econ prints running hot — ${beats}/${total} beats in the last 7d. Watch for hawkish Fed repricing.`,
      );
    } else if (misses > beats * 2) {
      keyFindings.push(
        `Econ prints running cold — ${misses}/${total} misses in the last 7d. Rate cut expectations should firm up.`,
      );
    } else {
      keyFindings.push(
        `Econ prints mixed — ${beats} beats, ${misses} misses out of ${total}. No clear macro directional bias.`,
      );
    }

    const hotPrints = context.econPrintHistory.filter(
      (p) => p.ivScore != null && p.ivScore >= 6,
    );
    if (hotPrints.length > 0) {
      keyFindings.push(
        `${hotPrints.length} high-impact print(s) this week — ${hotPrints.map((p) => p.eventName).join(", ")}.`,
      );
    }
  }

  const fredKeys = Object.keys(context.fredIndicators);
  if (fredKeys.length > 0) {
    const fredSummary = fredKeys
      .map((k) => {
        const val = context.fredIndicators[k];
        return `${k}: ${val?.toFixed(2) ?? "N/A"}`;
      })
      .join(", ");
    keyFindings.push(`FRED macro: ${fredSummary}`);
  }

  // ── Risk Alerts ──
  const riskAlerts: string[] = [];

  for (const cs of report.categoryScores) {
    if (cs.ivScore >= 7) {
      const label = CATEGORY_LABELS[cs.category] ?? cs.category;
      const implication =
        CATEGORY_TRADING_IMPLICATIONS[cs.category] ?? "reduce exposure";
      riskAlerts.push(
        `${label} heat ${cs.ivScore.toFixed(1)} — elevated. ${implication}.`,
      );
    }
  }

  if (regime >= 0.3) {
    riskAlerts.push(
      `Regime risk ${(regime * 100).toFixed(0)}% — market may be transitioning. Trend models unreliable until confirmed.`,
    );
  }

  // Scored items integration
  if (context.riskflowHeadlines.length > 0) {
    const highImpact = context.riskflowHeadlines.filter((h) => h.iv_score >= 6);
    if (highImpact.length > 0) {
      const byType = new Map<string, number>();
      for (const h of highImpact) {
        const type = h.risk_type ?? "Custom";
        byType.set(type, (byType.get(type) ?? 0) + 1);
      }
      const breakdown = [...byType.entries()]
        .map(([t, n]) => `${n} ${t}`)
        .join(", ");
      riskAlerts.push(
        `${highImpact.length} high-heat headlines in 72h window: ${breakdown}.`,
      );
    }

    const econHeadlines = context.riskflowHeadlines.filter(
      (h) => h.econ_data != null,
    );
    if (econHeadlines.length > 0) {
      const latest = econHeadlines[0];
      const bm = latest.econ_data?.beatMiss;
      if (bm === "beat" || bm === "miss") {
        riskAlerts.push(
          `Latest print ${bm === "beat" ? "came in hot" : "disappointed"}: "${latest.headline}" — ${latest.econ_data?.surprisePercent?.toFixed(1) ?? "?"}% surprise.`,
        );
      }
    }
  }

  // ── Agent Consensus ──
  const votes = report.agentVotes;
  const highVol = votes.filter((v) => v.position === "high-vol").length;
  const neutral = votes.filter((v) => v.position === "neutral").length;
  const lowVol = votes.filter((v) => v.position === "low-vol").length;
  const total = votes.length;

  let consensusInterpretation: string;
  if (total > 0 && highVol / total > 0.6) {
    consensusInterpretation =
      "Consensus leans volatile — favor mean-reversion setups over trend continuation.";
  } else if (total > 0 && lowVol / total > 0.6) {
    consensusInterpretation =
      "Consensus leans calm — trend continuation and breakout setups preferred.";
  } else {
    consensusInterpretation =
      "No strong consensus — reduce position sizing until direction clarifies.";
  }

  const agentConsensus = `Agent panel: ${highVol}/${total} see elevated vol, ${neutral} neutral, ${lowVol} contrarian. ${consensusInterpretation}`;

  return {
    summary,
    keyFindings,
    riskAlerts,
    agentConsensus,
    generatedAt: new Date().toISOString(),
  };
}
