// [claude-code 2026-04-03] REFLECT engine — nightly self-improvement loop for news analysis quality
// Computes 5 core metrics from observation data, generates a report, and recommends parameter adjustments.
// Scope: NEWS ANALYSIS QUALITY only — not trading performance.

import { getObservations } from "./observation-store.js";
import { generateFitnessReport, evaluateObservation } from "./fitness.js";
import type { ScoringObservation, FitnessReport } from "./types.js";
import { getSupabaseClient } from "../../config/supabase.js";
import { createLogger } from "../../lib/logger.js";
import { addMemory } from "../agent-memory/memory-store.js";
import type { AgentId } from "../agent-memory/types.js";

const log = createLogger("REFLECT");

// ── REFLECT Report Types ────────────────────────────────────────────────────

export interface ReflectMetrics {
  /** Direction accuracy: did IV score predict the right market direction? */
  directionAccuracy: number;
  /** Score calibration: mean accuracy of IV scores vs actual moves (0-1) */
  scoreCalibration: number;
  /** Bias direction: positive = overpredicting impact, negative = underpredicting */
  scoringBias: number;
  /** Macro level accuracy: % of items where macro level matched outcome severity */
  macroLevelAccuracy: number;
  /** Tag coverage: % of scored items that received at least one subject tag */
  tagCoverage: number;
}

export interface ReflectFinding {
  metric: keyof ReflectMetrics;
  severity: "info" | "warning" | "critical";
  message: string;
  currentValue: number;
  threshold: number;
  recommendation: string;
}

export interface ReflectReport {
  /** When the report was generated */
  generatedAt: string;
  /** Number of observations analyzed */
  observationCount: number;
  /** Number of observations with outcomes (for accuracy metrics) */
  withOutcomes: number;
  /** Core metrics */
  metrics: ReflectMetrics;
  /** Findings and recommendations */
  findings: ReflectFinding[];
  /** Underlying fitness report */
  fitnessReport: FitnessReport;
  /** Recommended parameter adjustments */
  adjustments: ReflectAdjustment[];
  /** Human-readable summary for Harper standup */
  summary: string;
}

export interface ReflectAdjustment {
  parameter: string;
  currentValue: number;
  recommendedValue: number;
  reason: string;
  autoApplied: boolean;
}

export interface ExternalReflectInsight {
  scope: string;
  summary: string;
  findings?: Array<{
    severity: "info" | "warning" | "critical";
    message: string;
    recommendation?: string;
    metric?: string;
  }>;
  metadata?: Record<string, unknown>;
}

// ── Metric Thresholds ───────────────────────────────────────────────────────

const THRESHOLDS = {
  directionAccuracy: { warning: 55, critical: 45 }, // Below 55% = warning, below 45% = critical
  scoreCalibration: { warning: 0.5, critical: 0.35 }, // Below 0.5 = warning
  scoringBias: { warning: 3, critical: 5 }, // Abs bias > 3pts = warning
  macroLevelAccuracy: { warning: 50, critical: 35 }, // Below 50% = warning
  tagCoverage: { warning: 60, critical: 40 }, // Below 60% = warning
};

// ── Core Engine ─────────────────────────────────────────────────────────────

/**
 * Run the REFLECT analysis on the last N days of observations.
 * Returns a report with metrics, findings, and recommended adjustments.
 */
export async function runReflect(daysBack: number = 7): Promise<ReflectReport> {
  const hoursBack = daysBack * 24;
  log.info(`Running REFLECT analysis on last ${daysBack} days of observations`);

  // Fetch all observations (with and without outcomes)
  const allObs = await getObservations({
    hoursBack,
    minIVScore: 0,
    limit: 1000,
  });

  const withOutcomes = await getObservations({
    hoursBack,
    minIVScore: 0,
    limit: 1000,
    withOutcomesOnly: true,
  });

  // Generate fitness report from observations with outcomes
  const fitnessReport = generateFitnessReport(withOutcomes);

  // Compute REFLECT-specific metrics
  const metrics = computeMetrics(allObs, withOutcomes, fitnessReport);

  // Generate findings based on thresholds
  const findings = generateFindings(metrics);

  // Generate parameter adjustments
  const adjustments = generateAdjustments(metrics, findings);

  // Build human-readable summary
  const summary = buildSummary(
    metrics,
    findings,
    allObs.length,
    withOutcomes.length,
  );

  const report: ReflectReport = {
    generatedAt: new Date().toISOString(),
    observationCount: allObs.length,
    withOutcomes: withOutcomes.length,
    metrics,
    findings,
    fitnessReport,
    adjustments,
    summary,
  };

  // Persist report to Supabase
  await persistReport(report);

  // Distribute key findings to ALL agents' memory (not just Harper)
  await distributeReflectFindings(report);

  log.info(
    `REFLECT complete: ${findings.length} findings, ${adjustments.length} adjustments`,
  );
  return report;
}

function computeMetrics(
  allObs: ScoringObservation[],
  withOutcomes: ScoringObservation[],
  fitnessReport: FitnessReport,
): ReflectMetrics {
  // Direction accuracy and score calibration come from fitness report
  const directionAccuracy =
    fitnessReport.evaluatedObservations > 0
      ? fitnessReport.directionAccuracy
      : 50; // Default to coin flip if no data

  const scoreCalibration =
    fitnessReport.evaluatedObservations > 0
      ? fitnessReport.meanScoreAccuracy
      : 0.5;

  const scoringBias =
    fitnessReport.evaluatedObservations > 0 ? fitnessReport.meanBias : 0;

  // Macro level accuracy: check if high macro level items had larger actual moves
  const macroLevelAccuracy = computeMacroLevelAccuracy(withOutcomes);

  // Tag coverage: % of all observations that have at least one subj: tag
  const tagCoverage =
    allObs.length > 0
      ? (allObs.filter((o) => o.tags?.some((t) => t.startsWith("subj:")))
          .length /
          allObs.length) *
        100
      : 0;

  return {
    directionAccuracy: Number(directionAccuracy.toFixed(1)),
    scoreCalibration: Number(scoreCalibration.toFixed(3)),
    scoringBias: Number(scoringBias.toFixed(2)),
    macroLevelAccuracy: Number(macroLevelAccuracy.toFixed(1)),
    tagCoverage: Number(tagCoverage.toFixed(1)),
  };
}

/**
 * Check if macro level assignments correlate with actual market impact.
 * Level 4 items should have larger moves than Level 1 items.
 */
function computeMacroLevelAccuracy(withOutcomes: ScoringObservation[]): number {
  if (withOutcomes.length < 5) return 50; // Not enough data

  // Group by IV score bucket (proxy for macro level since we don't have macroLevel on observations)
  const high = withOutcomes.filter((o) => o.ivScore >= 7);
  const low = withOutcomes.filter((o) => o.ivScore <= 3);

  if (high.length === 0 || low.length === 0) return 50;

  const highAvgMove =
    high.reduce((s, o) => s + Math.abs(o.actualMove ?? 0), 0) / high.length;
  const lowAvgMove =
    low.reduce((s, o) => s + Math.abs(o.actualMove ?? 0), 0) / low.length;

  // If high-IV items moved more than low-IV items, macro levels are calibrated
  if (highAvgMove > lowAvgMove * 1.5) return 80; // Good calibration
  if (highAvgMove > lowAvgMove) return 60; // OK
  return 30; // Inverted — high-IV items moved less than low-IV items
}

function generateFindings(metrics: ReflectMetrics): ReflectFinding[] {
  const findings: ReflectFinding[] = [];

  // Direction accuracy
  if (metrics.directionAccuracy < THRESHOLDS.directionAccuracy.critical) {
    findings.push({
      metric: "directionAccuracy",
      severity: "critical",
      message: `Direction accuracy is ${metrics.directionAccuracy}% — worse than a coin flip`,
      currentValue: metrics.directionAccuracy,
      threshold: THRESHOLDS.directionAccuracy.critical,
      recommendation:
        "Tighten radar thresholds and increase minimum IV score for scoring",
    });
  } else if (metrics.directionAccuracy < THRESHOLDS.directionAccuracy.warning) {
    findings.push({
      metric: "directionAccuracy",
      severity: "warning",
      message: `Direction accuracy is ${metrics.directionAccuracy}% — below target`,
      currentValue: metrics.directionAccuracy,
      threshold: THRESHOLDS.directionAccuracy.warning,
      recommendation:
        "Review event type weights — some categories may be miscalibrated",
    });
  }

  // Score calibration
  if (metrics.scoreCalibration < THRESHOLDS.scoreCalibration.critical) {
    findings.push({
      metric: "scoreCalibration",
      severity: "critical",
      message: `Score calibration is ${(metrics.scoreCalibration * 100).toFixed(0)}% — IV scores don't match actual impact`,
      currentValue: metrics.scoreCalibration,
      threshold: THRESHOLDS.scoreCalibration.critical,
      recommendation:
        "Recalibrate IV scoring weights — event weight and VIX multiplier may be off",
    });
  } else if (metrics.scoreCalibration < THRESHOLDS.scoreCalibration.warning) {
    findings.push({
      metric: "scoreCalibration",
      severity: "warning",
      message: `Score calibration is ${(metrics.scoreCalibration * 100).toFixed(0)}% — room for improvement`,
      currentValue: metrics.scoreCalibration,
      threshold: THRESHOLDS.scoreCalibration.warning,
      recommendation:
        "Fine-tune event weight multipliers for underperforming event types",
    });
  }

  // Scoring bias
  const absBias = Math.abs(metrics.scoringBias);
  if (absBias > THRESHOLDS.scoringBias.critical) {
    const direction =
      metrics.scoringBias > 0 ? "overpredicting" : "underpredicting";
    findings.push({
      metric: "scoringBias",
      severity: "critical",
      message: `Systematic ${direction} bias of ${absBias.toFixed(1)} points`,
      currentValue: metrics.scoringBias,
      threshold: THRESHOLDS.scoringBias.critical,
      recommendation:
        metrics.scoringBias > 0
          ? "Reduce event weight multipliers across the board"
          : "Increase event weight multipliers — we are underestimating impact",
    });
  } else if (absBias > THRESHOLDS.scoringBias.warning) {
    findings.push({
      metric: "scoringBias",
      severity: "warning",
      message: `Scoring bias of ${metrics.scoringBias > 0 ? "+" : ""}${metrics.scoringBias.toFixed(1)} points`,
      currentValue: metrics.scoringBias,
      threshold: THRESHOLDS.scoringBias.warning,
      recommendation: "Monitor — bias is elevated but not critical",
    });
  }

  // Macro level accuracy
  if (metrics.macroLevelAccuracy < THRESHOLDS.macroLevelAccuracy.critical) {
    findings.push({
      metric: "macroLevelAccuracy",
      severity: "critical",
      message: `Macro level accuracy is ${metrics.macroLevelAccuracy}% — urgency levels are miscalibrated`,
      currentValue: metrics.macroLevelAccuracy,
      threshold: THRESHOLDS.macroLevelAccuracy.critical,
      recommendation:
        "Review POI boost logic and event weight thresholds for macro level assignment",
    });
  } else if (
    metrics.macroLevelAccuracy < THRESHOLDS.macroLevelAccuracy.warning
  ) {
    findings.push({
      metric: "macroLevelAccuracy",
      severity: "warning",
      message: `Macro level accuracy is ${metrics.macroLevelAccuracy}% — some urgency levels are off`,
      currentValue: metrics.macroLevelAccuracy,
      threshold: THRESHOLDS.macroLevelAccuracy.warning,
      recommendation:
        "Check which event types are being over/under-prioritized",
    });
  }

  // Tag coverage
  if (metrics.tagCoverage < THRESHOLDS.tagCoverage.critical) {
    findings.push({
      metric: "tagCoverage",
      severity: "critical",
      message: `Only ${metrics.tagCoverage}% of items have subject tags — AgentDesk routing is blind`,
      currentValue: metrics.tagCoverage,
      threshold: THRESHOLDS.tagCoverage.critical,
      recommendation:
        "Expand headline-tagger keyword patterns — too many items fall through",
    });
  } else if (metrics.tagCoverage < THRESHOLDS.tagCoverage.warning) {
    findings.push({
      metric: "tagCoverage",
      severity: "warning",
      message: `${metrics.tagCoverage}% tag coverage — some headlines aren't being routed`,
      currentValue: metrics.tagCoverage,
      threshold: THRESHOLDS.tagCoverage.warning,
      recommendation: "Review untagged headlines for missing keyword patterns",
    });
  }

  // If everything is healthy, say so
  if (findings.length === 0) {
    findings.push({
      metric: "directionAccuracy",
      severity: "info",
      message: "All metrics within healthy ranges",
      currentValue: metrics.directionAccuracy,
      threshold: THRESHOLDS.directionAccuracy.warning,
      recommendation: "No adjustments needed — maintain current parameters",
    });
  }

  return findings;
}

function generateAdjustments(
  metrics: ReflectMetrics,
  findings: ReflectFinding[],
): ReflectAdjustment[] {
  const adjustments: ReflectAdjustment[] = [];
  const criticalFindings = findings.filter((f) => f.severity === "critical");

  // Only auto-adjust on critical findings to avoid thrashing
  for (const finding of criticalFindings) {
    switch (finding.metric) {
      case "directionAccuracy":
        adjustments.push({
          parameter: "minIVScoreForScoring",
          currentValue: 1,
          recommendedValue: 2,
          reason: `Direction accuracy ${metrics.directionAccuracy}% — raise minimum IV threshold to filter noise`,
          autoApplied: false, // Never auto-apply without review
        });
        break;

      case "scoringBias":
        if (metrics.scoringBias > 0) {
          adjustments.push({
            parameter: "eventWeightMultiplier",
            currentValue: 1.0,
            recommendedValue: 0.85,
            reason: `Overpredicting by ${metrics.scoringBias.toFixed(1)}pts — reduce event weight multiplier`,
            autoApplied: false,
          });
        } else {
          adjustments.push({
            parameter: "eventWeightMultiplier",
            currentValue: 1.0,
            recommendedValue: 1.15,
            reason: `Underpredicting by ${Math.abs(metrics.scoringBias).toFixed(1)}pts — increase event weight multiplier`,
            autoApplied: false,
          });
        }
        break;

      case "tagCoverage":
        adjustments.push({
          parameter: "tagPatternExpansion",
          currentValue: metrics.tagCoverage,
          recommendedValue: 70,
          reason: `Tag coverage ${metrics.tagCoverage}% — expand headline-tagger patterns`,
          autoApplied: false,
        });
        break;
    }
  }

  return adjustments;
}

function buildSummary(
  metrics: ReflectMetrics,
  findings: ReflectFinding[],
  totalObs: number,
  withOutcomes: number,
): string {
  const critical = findings.filter((f) => f.severity === "critical").length;
  const warnings = findings.filter((f) => f.severity === "warning").length;

  let summary = `REFLECT analyzed ${totalObs} observations (${withOutcomes} with outcomes). `;

  if (critical > 0) {
    summary += `${critical} critical issue${critical > 1 ? "s" : ""} found. `;
  }
  if (warnings > 0) {
    summary += `${warnings} warning${warnings > 1 ? "s" : ""}. `;
  }
  if (critical === 0 && warnings === 0) {
    summary += "All metrics healthy. ";
  }

  summary += `Direction accuracy: ${metrics.directionAccuracy}%. `;
  summary += `Score calibration: ${(metrics.scoreCalibration * 100).toFixed(0)}%. `;
  summary += `Tag coverage: ${metrics.tagCoverage}%. `;

  if (Math.abs(metrics.scoringBias) > 2) {
    summary += `Bias: ${metrics.scoringBias > 0 ? "overpredicting" : "underpredicting"} by ${Math.abs(metrics.scoringBias).toFixed(1)} pts. `;
  }

  return summary.trim();
}

// ── Distribute REFLECT Findings to All Agents ──────────────────────────────

export const ALL_AGENTS: AgentId[] = [
  "oracle",
  "feucht",
  "consul",
  "herald",
  "harper",
];

async function addReflectMemoryToAllAgents(input: {
  content: string;
  metadata?: Record<string, unknown>;
  ttlHours?: number;
}): Promise<void> {
  for (const agentId of ALL_AGENTS) {
    await addMemory({
      agentId,
      memoryType: "reflect_finding",
      content: input.content,
      metadata: input.metadata,
      ttlHours: input.ttlHours ?? 7 * 24,
    }).catch((err) =>
      log.warn("Failed to distribute REFLECT finding", {
        agent: agentId,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }
}

async function distributeReflectFindings(report: ReflectReport): Promise<void> {
  const actionableFindings = report.findings.filter(
    (f) => f.severity === "warning" || f.severity === "critical",
  );

  if (actionableFindings.length === 0 && report.findings.length > 0) {
    // All healthy — still distribute a summary so agents know the system is calibrated
    const content = `REFLECT ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}: ${report.summary}`;
    await addReflectMemoryToAllAgents({
      content,
      metadata: { metrics: report.metrics, scope: "riskflow" },
    });
    return;
  }

  for (const finding of actionableFindings) {
    const content =
      `REFLECT [${finding.severity.toUpperCase()}] ${finding.message} — ` +
      `Recommendation: ${finding.recommendation}`;

    await addReflectMemoryToAllAgents({
      content,
      metadata: {
        metric: finding.metric,
        severity: finding.severity,
        currentValue: finding.currentValue,
        scope: "riskflow",
      },
    });
  }

  log.info(
    `Distributed ${actionableFindings.length} REFLECT findings to ${ALL_AGENTS.length} agents`,
  );
}

export async function distributeExternalReflectInsights(
  insight: ExternalReflectInsight,
): Promise<void> {
  const scope = insight.scope?.trim() || "agentic";
  const datePrefix = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  await addReflectMemoryToAllAgents({
    content: `REFLECT ${datePrefix} [${scope}] ${insight.summary}`,
    metadata: {
      scope,
      source: "external-reflect",
      ...(insight.metadata ?? {}),
    },
  });

  for (const finding of insight.findings ?? []) {
    const line = `REFLECT [${scope}] [${finding.severity.toUpperCase()}] ${finding.message}${finding.recommendation ? ` — Recommendation: ${finding.recommendation}` : ""}`;
    await addReflectMemoryToAllAgents({
      content: line,
      metadata: {
        scope,
        severity: finding.severity,
        metric: finding.metric ?? null,
        source: "external-reflect",
        ...(insight.metadata ?? {}),
      },
    });
  }
}

// ── Persistence ─────────────────────────────────────────────────────────────

async function persistReport(report: ReflectReport): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) {
    log.warn("Supabase not configured — REFLECT report not persisted");
    return;
  }

  const { error } = await sb.from("reflect_reports").insert({
    generated_at: report.generatedAt,
    observation_count: report.observationCount,
    with_outcomes: report.withOutcomes,
    metrics: report.metrics,
    findings: report.findings,
    adjustments: report.adjustments,
    summary: report.summary,
  });

  if (error) {
    // Table may not exist yet — log but don't crash
    log.warn("REFLECT report persist failed (table may not exist):", {
      error: error.message,
    });
  }
}

/**
 * Get the most recent REFLECT report (for Harper standup context).
 */
export async function getLatestReflectReport(): Promise<ReflectReport | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;

  const { data, error } = await sb
    .from("reflect_reports")
    .select("*")
    .order("generated_at", { ascending: false })
    .limit(1);

  if (error || !data?.length) return null;

  const row = data[0] as Record<string, any>;
  return {
    generatedAt: row.generated_at,
    observationCount: row.observation_count,
    withOutcomes: row.with_outcomes,
    metrics: row.metrics,
    findings: row.findings,
    fitnessReport: {
      totalObservations: 0,
      evaluatedObservations: 0,
      directionAccuracy: 0,
      meanMagnitudeError: 0,
      meanMagnitudeErrorPct: 0,
      meanScoreAccuracy: 0,
      meanBias: 0,
      byEventType: {},
      bySession: {},
      generatedAt: row.generated_at,
    },
    adjustments: row.adjustments,
    summary: row.summary,
  };
}
