// [claude-code 2026-03-11] Auto-generate RiskFlow items from systemic risk detection
// Injects into news_feed_items table (same pattern as econ-bridge.ts)

import type {
  SystemicRiskAlert,
  ActiveChainInstance,
  RhymeMatch,
} from "../../types/volatility-taxonomy.js";
import { formatRhymeAlert } from "./historical-rhyming.js";

// ── Alert Generation Rules ─────────────────────────────────────────────────────

/**
 * Generate alerts from active causal chains that have advanced.
 */
export function generateChainAlerts(
  advancedChains: ActiveChainInstance[],
): SystemicRiskAlert[] {
  const alerts: SystemicRiskAlert[] = [];

  for (const chain of advancedChains) {
    if (chain.exhausted) continue;

    const linkDepth = chain.currentLinkIndex + 1;
    const depthLabel =
      linkDepth === 1
        ? "2nd-order"
        : linkDepth === 2
          ? "3rd-order"
          : `${linkDepth + 1}th-order`;

    // Severity escalates with chain depth
    const severity =
      linkDepth >= 3 ? "high" : linkDepth >= 2 ? "medium" : "low";

    const nextEffect = chain.nextEffectWindow?.effectType ?? "unknown";
    const probability = Math.round(chain.cumulativeProbability * 100);

    alerts.push({
      type: "causal-chain",
      severity: severity as SystemicRiskAlert["severity"],
      headline: `CAUSAL CHAIN: ${chain.chainName} — ${depthLabel} effect window opening`,
      summary:
        `The "${chain.chainName}" chain (triggered by ${chain.triggerEventType} on ${new Date(chain.triggerTimestamp).toLocaleDateString()}) ` +
        `has advanced to its ${depthLabel} stage. Next anticipated effect: "${nextEffect}" ` +
        `with ${probability}% cumulative probability. ` +
        `This is forward-looking risk — the market may not yet be pricing this in.`,
      affectedInstruments: [],
      tags: ["systemic-risk", "causal-chain", chain.chainId, nextEffect],
    });
  }

  return alerts;
}

/**
 * Generate alerts from historical rhyme matches.
 */
export function generateRhymeAlerts(
  matches: RhymeMatch[],
  highThreshold: number = 0.6,
  criticalThreshold: number = 0.8,
): SystemicRiskAlert[] {
  const alerts: SystemicRiskAlert[] = [];

  for (const match of matches) {
    if (match.matchScore < highThreshold) continue;

    const { headline, summary } = formatRhymeAlert(match);
    const severity =
      match.matchScore >= criticalThreshold ? "critical" : "high";

    alerts.push({
      type: "historical-rhyme",
      severity,
      headline,
      summary,
      historicalContext:
        `In ${match.crisisYear}, the ${match.crisisName} resulted in a ${Math.abs(match.maxDrawdown)}% drawdown ` +
        `with VIX peaking at ${match.peakVix}. ` +
        `Key guidance: ${match.tradingGuidance.slice(0, 2).join(". ")}.`,
      timeline: match.unfoldingTimeline,
      affectedInstruments: [],
      tags: ["systemic-risk", "historical-rhyme", match.crisisId],
    });
  }

  return alerts;
}

/**
 * Generate alerts from accumulated credit signals.
 */
export function generateCreditAlerts(
  creditSignalCount: number,
  minSignals: number = 3,
  recentCreditHeadlines: string[] = [],
): SystemicRiskAlert[] {
  if (creditSignalCount < minSignals) return [];

  return [
    {
      type: "credit-warning",
      severity: creditSignalCount >= 5 ? "critical" : "high",
      headline: `CREDIT WARNING: ${creditSignalCount} credit deterioration signals in last 48 hours`,
      summary:
        `${creditSignalCount} credit-related signals detected in the last 48 hours — ` +
        `this level of credit stress activity rhymes with the early stages of past credit events. ` +
        `Recent signals: ${recentCreditHeadlines.slice(0, 3).join("; ")}. ` +
        `Watch for: HY OAS spread widening, bank CDS moves, and lending tightening.`,
      affectedInstruments: ["/ES", "/NQ", "/RTY", "/ZB"],
      tags: ["systemic-risk", "credit-warning"],
    },
  ];
}

/**
 * Generate contagion alerts when events span multiple transmission channels.
 */
export function generateContagionAlert(
  activeChannels: Set<string>,
  minChannels: number = 3,
): SystemicRiskAlert[] {
  if (activeChannels.size < minChannels) return [];

  const channels = Array.from(activeChannels);

  return [
    {
      type: "contagion",
      severity: activeChannels.size >= 4 ? "critical" : "high",
      headline: `CONTAGION ALERT: Risk spreading across ${activeChannels.size} transmission channels`,
      summary:
        `Active risk signals detected across ${channels.join(", ")} channels simultaneously. ` +
        `Cross-channel contagion amplifies volatility and reduces diversification benefits. ` +
        `All correlations trend toward 1 in contagion events.`,
      affectedInstruments: ["/ES", "/NQ", "/GC", "/ZB", "/CL", "/6E"],
      tags: ["systemic-risk", "contagion", ...channels],
    },
  ];
}

// ── DB Injection ───────────────────────────────────────────────────────────────

/**
 * Inject a systemic risk alert into the news_feed_items table.
 * Same pattern as econ-bridge.ts.
 */
export async function injectSystemicAlert(
  alert: SystemicRiskAlert,
): Promise<void> {
  try {
    const { sql, isDatabaseAvailable } =
      await import("../../config/database.js");
    if (!isDatabaseAvailable() || !sql) return;

    // Deduplicate: don't inject the same alert type+headline within 6 hours
    const existing = await sql`
      SELECT id FROM news_feed_items
      WHERE headline = ${alert.headline}
        AND published_at > NOW() - INTERVAL '6 hours'
      LIMIT 1
    `;
    if (existing.length > 0) return;

    const severityToMacroLevel: Record<string, number> = {
      low: 1,
      medium: 2,
      high: 3,
      critical: 4,
    };

    const severityToIvScore: Record<string, number> = {
      low: 3,
      medium: 5,
      high: 7,
      critical: 9,
    };

    await sql`
      INSERT INTO news_feed_items (
        headline, body, source, url, published_at, is_breaking,
        urgency, sentiment, iv_score, macro_level, symbols, tags,
        systemic_source
      ) VALUES (
        ${alert.headline},
        ${alert.summary},
        'Custom',
        ${`systemic://${alert.type}`},
        ${new Date().toISOString()},
        ${alert.severity === "critical"},
        ${alert.severity === "critical" ? "immediate" : alert.severity === "high" ? "high" : "normal"},
        'bearish',
        ${severityToIvScore[alert.severity] ?? 5},
        ${severityToMacroLevel[alert.severity] ?? 2},
        ${JSON.stringify(alert.affectedInstruments)},
        ${JSON.stringify(alert.tags)},
        ${alert.type}
      )
    `;

    console.log(
      `[SystemicAlert] Injected: ${alert.headline} (${alert.severity})`,
    );
  } catch (err) {
    console.error("[SystemicAlert] Failed to inject alert:", err);
  }
}
