// [claude-code 2026-03-28] S4-T2: Rewrote briefing with trader-friendly language (Market Heat, Regime Risk, Signal Strength)
// [claude-code 2026-03-23] AgentDesk briefing generator — deterministic text from debate results
// [claude-code 2026-04-17] Slop-detection: when a run has no real signal, emit the explicit fallback string instead of templated heat/regime slop
// [claude-code 2026-05-13] T4: Per-instrument heatInterpretation() with correlation multipliers (NQ+ES 0.8, GC indep, CL geopol, YM 0.5)
import type {
  AgentDeskReport,
  AgentDeskBriefing,
  SimulationContext,
} from "./agent-desk-types.js";

export const SLOP_FALLBACK =
  "No new agentic updates. Trigger an update in ArbitrumChamber.";

/**
 * Per-instrument heat score with correlation characteristics.
 * Used to produce instrument-specific thesis lines in the briefing.
 */
export interface InstrumentHeatScore {
  symbol: string;
  score: number;
  correlationGroup: "eq-futures" | "macro" | "commodity" | "sentiment";
}

/** Default instrument correlation multipliers. */
const INSTRUMENT_CORRELATIONS: Record<string, number> = {
  NQ: 0.8,
  ES: 0.8,
  GC: 1.0,
  CL: 1.0,
  YM: 0.5,
};

/** Correlation groups for combined interpretation. */
const CORRELATION_GROUPS: Record<string, string[]> = {
  "eq-futures": ["NQ", "ES"],
  macro: ["GC"],
  commodity: ["CL"],
  sentiment: ["YM"],
};

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

const INSTRUMENT_THESIS_MAP: Record<string, (score: number) => string> = {
  NQ: (s) =>
    s >= 7
      ? "Tech-heavy directional risk — size down on /NQ"
      : s >= 4
        ? "/NQ inline with macro vol"
        : "/NQ range-bound, fade the wings",
  ES: (s) =>
    s >= 7
      ? "Broad equity stress — /ES gap risk elevated"
      : s >= 4
        ? "/ES tracking macro pulse"
        : "/ES low conviction, wait for setup",
  GC: (s) =>
    s >= 7
      ? "Gold spiking on flight-to-safety — /GC carry premium"
      : s >= 4
        ? "/GC elevated on inflation/geopol noise"
        : "/GC quiet, no inflation impulse",
  CL: (s) =>
    s >= 7
      ? "Crude spiking on geopolitical overlay — /CL supply risk"
      : s >= 4
        ? "/CL reacting to geopolitical headlines"
        : "/CL subdued, no immediate catalyst",
  YM: (s) =>
    s >= 7
      ? "Dow volatility on macro regime — /YM wide bars expected"
      : s >= 4
        ? "/YM broad sentiment pulse"
        : "/YM quiet, no catalyst",
};

/**
 * Interpret a single composite heat score (backward-compatible).
 */
function heatInterpretation(score: number): string;

/**
 * Interpret per-instrument heat scores with correlation awareness.
 * Produces instrument-level thesis lines and a composite heat reading.
 */
function heatInterpretation(
  score: number,
  instruments?: InstrumentHeatScore[],
): string;

function heatInterpretation(
  score: number,
  instruments?: InstrumentHeatScore[],
): string {
  if (!instruments || instruments.length === 0) {
    // Legacy path: single score
    if (score >= 9)
      return "Extreme heat — capital preservation mode, hedge or sit flat";
    if (score >= 7)
      return "High heat — reduce size, widen stops, favor reactive over predictive";
    if (score >= 5)
      return "Elevated heat — expect wider ranges and faster reversals";
    if (score >= 3) return "Moderate heat — normal conditions, play the setups";
    return "Low heat — range-bound, fade extremes";
  }

  // Per-instrument path: build composite from correlation-weighted scores
  const groupScores = new Map<string, { total: number; count: number }>();

  for (const inst of instruments) {
    const group = inst.correlationGroup;
    const current = groupScores.get(group) ?? { total: 0, count: 0 };
    current.total += inst.score;
    current.count++;
    groupScores.set(group, current);
  }

  // Weight each group
  const weights: Record<string, number> = {
    "eq-futures": 0.35,
    macro: 0.25,
    commodity: 0.2,
    sentiment: 0.2,
  };

  let weightedSum = 0;
  let weightTotal = 0;

  for (const [group, { total, count }] of groupScores) {
    const avg = total / count;
    const w = weights[group] ?? 0.15;
    weightedSum += avg * w;
    weightTotal += w;
  }

  const composite = weightTotal > 0 ? weightedSum / weightTotal : score;

  // Build composite label
  let label: string;
  if (composite >= 9)
    label = "Extreme heat — capital preservation mode, hedge or sit flat";
  else if (composite >= 7)
    label =
      "High heat — reduce size, widen stops, favor reactive over predictive";
  else if (composite >= 5)
    label = "Elevated heat — expect wider ranges and faster reversals";
  else if (composite >= 3)
    label = "Moderate heat — normal conditions, play the setups";
  else label = "Low heat — range-bound, fade extremes";

  // Build instrument thesis lines
  const thesisLines = instruments.map((inst) => {
    const thesisFn = INSTRUMENT_THESIS_MAP[inst.symbol];
    const thesis = thesisFn
      ? thesisFn(inst.score)
      : `${inst.symbol} at ${inst.score.toFixed(1)}`;
    return `${inst.symbol}: ${thesis}`;
  });

  return `${label}\n\nPer-instrument thesis:\n${thesisLines.map((l) => `  • ${l}`).join("\n")}`;
}

export { heatInterpretation };

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

  // Build per-instrument heat scores from category-level data
  // GC (gold) maps to geopolitical/monetary-policy, CL (crude) maps to geopolitical,
  // NQ/ES/YM derive from the composite with correlation multipliers
  const catScores = report.categoryScores;
  const geoScore =
    catScores.find((c) => c.category === "geopolitical")?.ivScore ?? 5;
  const mpScore =
    catScores.find((c) => c.category === "monetary-policy")?.ivScore ?? 5;
  const msScore =
    catScores.find((c) => c.category === "market-structure")?.ivScore ?? 5;

  const perInstrument: InstrumentHeatScore[] = [
    {
      symbol: "NQ",
      score: Math.min(10, composite * INSTRUMENT_CORRELATIONS.NQ + 1.5),
      correlationGroup: "eq-futures",
    },
    {
      symbol: "ES",
      score: Math.min(10, composite * INSTRUMENT_CORRELATIONS.ES + 1.0),
      correlationGroup: "eq-futures",
    },
    {
      symbol: "GC",
      score: Math.min(10, (geoScore + mpScore) / 2),
      correlationGroup: "macro",
    },
    {
      symbol: "CL",
      score: Math.min(10, geoScore + 0.5),
      correlationGroup: "commodity",
    },
    {
      symbol: "YM",
      score: Math.min(
        10,
        composite * INSTRUMENT_CORRELATIONS.YM + msScore * 0.3,
      ),
      correlationGroup: "sentiment",
    },
  ];

  // ── Summary ──
  const topCategory = [...catScores].sort((a, b) => b.ivScore - a.ivScore)[0];
  const topLabel = topCategory
    ? (CATEGORY_LABELS[topCategory.category] ?? topCategory.category)
    : "unknown";

  const heatText = heatInterpretation(composite, perInstrument);
  const [compositeLabel] = heatText.split("\n\n");
  const afterLabel = compositeLabel ?? "monitor conditions";

  let summary = `Market heat ${afterLabel.toLowerCase()} at ${composite.toFixed(1)}.\n`;
  summary += `Regime risk at ${(regime * 100).toFixed(0)}% — ${regime >= 0.4 ? "structural shift possible, tighten stops on trend trades" : regime >= 0.2 ? "elevated but contained, stay nimble" : "low probability, trends intact"}.\n`;
  summary += `Signal strength ${(conf * 100).toFixed(0)}% — ${conf >= 0.7 ? "high-conviction read, size accordingly" : conf >= 0.4 ? "moderate conviction, standard sizing" : "low conviction, reduce exposure"}.\n`;
  summary += `Primary driver: ${topLabel} (${topCategory?.ivScore.toFixed(1) ?? "N/A"}).`;

  if (context.vixLevel != null) {
    summary += ` Live VIX: ${context.vixLevel.toFixed(1)}.`;
  }

  // ── Per-Instrument Thesis Lines ──
  const perInstrumentTheses: string[] = [];
  for (const inst of perInstrument) {
    const thesisFn = INSTRUMENT_THESIS_MAP[inst.symbol];
    const thesis = thesisFn
      ? thesisFn(inst.score)
      : `${inst.symbol} at ${inst.score.toFixed(1)}`;
    perInstrumentTheses.push(
      `${inst.symbol}: ${thesis} (heat ${inst.score.toFixed(1)})`,
    );
  }

  // ── Key Findings ──
  const keyFindings: string[] = [...perInstrumentTheses];

  const sortedCats = [...catScores].sort((a, b) => b.ivScore - a.ivScore);
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
