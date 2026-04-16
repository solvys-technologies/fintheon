// [claude-code 2026-03-11] Systemic risk detector — orchestrates causal chains, historical rhyming,
// and credit signal accumulation to produce IV score overlays and RiskFlow alerts.

import type {
  SystemicRiskAssessment,
  SystemicRiskAlert,
  MacroIndicators,
  HeadlineSignal,
} from "../../types/volatility-taxonomy.js";
import {
  triggerChain,
  evaluateActiveChains,
  getChainScoreOverlay,
  getActiveChains,
} from "./causal-chain-engine.js";
import { evaluateRhymes } from "./historical-rhyming.js";
import {
  buildMacroIndicators,
  getCachedFredIndicators,
} from "./fred-service.js";
import {
  generateChainAlerts,
  generateRhymeAlerts,
  generateCreditAlerts,
  generateContagionAlert,
  injectSystemicAlert,
} from "./alert-generator.js";
import { getVolatilityProfile } from "../iv-scoring/index.js";

// ── Headline Signal Tracking ───────────────────────────────────────────────────

// Rolling window of detected headline signals (last 48 hours)
let _headlineSignals: HeadlineSignal[] = [];
const HEADLINE_WINDOW_MS = 48 * 60 * 60 * 1000; // 48 hours

/**
 * Record a headline signal detected by the IV scoring classifier.
 * Call this whenever classifyEventType returns a V3 systemic event type.
 */
export function recordHeadlineSignal(
  type: string,
  headline: string,
  strength: "weak" | "moderate" | "strong" = "moderate",
): void {
  _headlineSignals.push({
    type,
    detectedAt: new Date().toISOString(),
    headline,
    strength,
  });

  // Prune old signals
  const cutoff = Date.now() - HEADLINE_WINDOW_MS;
  _headlineSignals = _headlineSignals.filter(
    (s) => new Date(s.detectedAt).getTime() > cutoff,
  );
}

/**
 * Get current headline signals for matching.
 */
export function getHeadlineSignals(): HeadlineSignal[] {
  return _headlineSignals;
}

// ── Main Assessment ────────────────────────────────────────────────────────────

// Overlay weight: 0.25 = up to +2.5 pts on a 0-10 IV score
const OVERLAY_WEIGHT = 0.25;

/**
 * Run the full systemic risk assessment.
 * Called by the systemic poller every 120s.
 */
export async function assessSystemicRisk(
  recentEvents: { eventType: string; timestamp: Date; baseScore: number }[],
  vixLevel: number,
  vixAvg30d?: number,
): Promise<SystemicRiskAssessment> {
  const now = new Date();
  const rationale: string[] = [];
  const allAlerts: SystemicRiskAlert[] = [];

  // ── 1. Trigger causal chains from recent events ──────────────────────────
  for (const event of recentEvents) {
    const minutesSince = (now.getTime() - event.timestamp.getTime()) / 60000;
    // Only trigger from events in the last 30 minutes (avoid re-triggering old events)
    if (minutesSince < 30) {
      triggerChain(event.eventType, event.timestamp);
    }
  }

  // ── 2. Evaluate active chains ────────────────────────────────────────────
  const { advancedChains, exhaustedChains } = evaluateActiveChains(now);

  if (advancedChains.length > 0) {
    const chainAlerts = generateChainAlerts(advancedChains);
    allAlerts.push(...chainAlerts);
    rationale.push(`${advancedChains.length} causal chain(s) advanced`);
  }

  // Get chain score overlay
  const chainOverlay = getChainScoreOverlay();
  if (chainOverlay.score > 0) {
    rationale.push(...chainOverlay.rationale);
  }

  // ── 3. Build macro indicators ────────────────────────────────────────────
  const indicators = buildMacroIndicators(
    vixLevel,
    vixAvg30d,
    _headlineSignals,
  );

  // ── 4. Evaluate historical rhymes ────────────────────────────────────────
  const rhymeMatches = evaluateRhymes(indicators, 0.3);
  const significantRhymes = rhymeMatches.filter((m) => m.matchScore >= 0.4);

  if (significantRhymes.length > 0) {
    const topRhyme = significantRhymes[0];
    rationale.push(
      `Top rhyme: ${Math.round(topRhyme.matchScore * 100)}% match to ${topRhyme.crisisYear} ${topRhyme.crisisName} ` +
        `(${topRhyme.matchedCount}/${topRhyme.totalPreconditions} preconditions)`,
    );

    const rhymeAlerts = generateRhymeAlerts(significantRhymes);
    allAlerts.push(...rhymeAlerts);
  }

  // ── 5. Count credit signals ──────────────────────────────────────────────
  const creditSignalCount = _headlineSignals.filter(
    (s) =>
      s.type === "creditSpreadWidening" ||
      s.type === "bankStress" ||
      s.type === "liquidityStress" ||
      s.type === "leverageWarning",
  ).length;

  if (creditSignalCount >= 3) {
    const creditHeadlines = _headlineSignals
      .filter(
        (s) =>
          s.type === "creditSpreadWidening" ||
          s.type === "bankStress" ||
          s.type === "liquidityStress",
      )
      .map((s) => s.headline);

    const creditAlerts = generateCreditAlerts(
      creditSignalCount,
      3,
      creditHeadlines,
    );
    allAlerts.push(...creditAlerts);
    rationale.push(`${creditSignalCount} credit signals in 48h`);
  }

  // ── 6. Check contagion (multi-channel risk) ──────────────────────────────
  const activeChannels = new Set<string>();
  for (const event of recentEvents) {
    const profile = getVolatilityProfile(event.eventType);
    for (const channel of profile.transmissionChannels) {
      activeChannels.add(channel);
    }
  }

  if (activeChannels.size >= 3) {
    const contagionAlerts = generateContagionAlert(activeChannels);
    allAlerts.push(...contagionAlerts);
    rationale.push(
      `Contagion: ${activeChannels.size} transmission channels active`,
    );
  }

  // ── 7. Calculate composite systemic score ────────────────────────────────
  let systemicScore = 0;

  // Chain contribution (0-10)
  systemicScore += chainOverlay.score * 0.4;

  // Rhyme contribution (top match score * 10 * weight)
  if (significantRhymes.length > 0) {
    systemicScore += significantRhymes[0].matchScore * 10 * 0.3;
  }

  // Credit signal contribution
  systemicScore += Math.min(10, creditSignalCount * 1.5) * 0.2;

  // Contagion contribution
  if (activeChannels.size >= 3) {
    systemicScore += Math.min(10, activeChannels.size * 2) * 0.1;
  }

  systemicScore = Math.min(10, Math.max(0, systemicScore));

  // IV score overlay = systemic score * overlay weight (max +2.5)
  const ivScoreOverlay = systemicScore * OVERLAY_WEIGHT;

  if (ivScoreOverlay > 0.1) {
    rationale.push(
      `Systemic score: ${systemicScore.toFixed(1)}/10 → IV overlay: +${ivScoreOverlay.toFixed(1)}`,
    );
  }

  // ── 8. Inject alerts to DB ───────────────────────────────────────────────
  for (const alert of allAlerts) {
    await injectSystemicAlert(alert).catch((err) => {
      console.error("[SystemicRisk] Failed to inject alert:", err);
    });
  }

  return {
    systemicScore: Number(systemicScore.toFixed(1)),
    activeChains: getActiveChains().filter((c) => !c.exhausted),
    rhymeMatches: significantRhymes,
    creditSignalCount,
    ivScoreOverlay: Number(ivScoreOverlay.toFixed(2)),
    rationale,
    generatedAlerts: allAlerts,
    timestamp: now.toISOString(),
  };
}

// ── Cached Assessment ──────────────────────────────────────────────────────────

let _cachedAssessment: SystemicRiskAssessment | null = null;

export function getCachedAssessment(): SystemicRiskAssessment | null {
  return _cachedAssessment;
}

export function setCachedAssessment(assessment: SystemicRiskAssessment): void {
  _cachedAssessment = assessment;
}
