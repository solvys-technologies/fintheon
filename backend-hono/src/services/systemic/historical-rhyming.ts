// [claude-code 2026-03-11] Historical rhyming engine — matches current conditions to past crises
// Deterministic, config-driven pattern matching. No AI — just weighted precondition rules.

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  HistoricalCrisesConfig,
  HistoricalCrisis,
  MacroIndicators,
  RhymeMatch,
  HeadlineSignal,
} from "../../types/volatility-taxonomy.js";

// ── Config Loader ──────────────────────────────────────────────────────────────

let _crisesConfig: HistoricalCrisesConfig | null = null;

export function loadHistoricalCrises(): HistoricalCrisesConfig {
  if (_crisesConfig) return _crisesConfig;

  try {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const configPath = resolve(
      __dirname,
      "../../config/historical-crises.json",
    );
    const raw = readFileSync(configPath, "utf-8");
    _crisesConfig = JSON.parse(raw);
    console.log(
      `[Rhyming] Loaded ${_crisesConfig!.crises.length} historical crises`,
    );
  } catch (err) {
    console.warn("[Rhyming] Failed to load historical crises config:", err);
    _crisesConfig = { _version: "0.0.0", crises: [] };
  }

  return _crisesConfig!;
}

export function resetHistoricalCrises(): void {
  _crisesConfig = null;
}

// ── Headline Signal Counting ───────────────────────────────────────────────────

/**
 * Count headline signals of a given type within a time window.
 */
function countHeadlineSignals(
  signals: HeadlineSignal[],
  type: string,
  windowHours: number = 48,
): number {
  const cutoff = Date.now() - windowHours * 60 * 60 * 1000;
  return signals.filter(
    (s) => s.type === type && new Date(s.detectedAt).getTime() > cutoff,
  ).length;
}

// ── Precondition Evaluation ────────────────────────────────────────────────────

interface PreconditionResult {
  indicator: string;
  currentValue: number | string | null;
  historicalCondition: string;
  matched: boolean;
  weight: number;
  description: string;
}

/**
 * Evaluate a single precondition against current conditions.
 */
function evaluatePrecondition(
  precondition: HistoricalCrisis["preconditions"][0],
  indicators: MacroIndicators,
): PreconditionResult {
  const { indicator, condition, threshold, weight, description, source } =
    precondition;
  let currentValue: number | string | null = null;
  let matched = false;

  // FRED-sourced indicators (quantitative)
  if (source === "fred") {
    switch (indicator) {
      case "hy_oas_spread":
        currentValue = indicators.hyOasSpread ?? null;
        if (currentValue !== null) {
          if (condition === "above")
            matched = currentValue > (threshold as number);
          else if (condition === "widening")
            matched = currentValue > (threshold as number);
        }
        break;

      case "yield_curve_2s10s":
        currentValue = indicators.yieldCurve2s10s ?? null;
        if (currentValue !== null) {
          if (condition === "inverted") matched = currentValue < 0;
          else if (condition === "below")
            matched = currentValue < (threshold as number);
          else if (condition === "above")
            matched = currentValue > (threshold as number);
        }
        break;

      case "yield_curve_3m10y":
        currentValue = indicators.yieldCurve3m10y ?? null;
        if (currentValue !== null) {
          if (condition === "inverted") matched = currentValue < 0;
          else if (condition === "below")
            matched = currentValue < (threshold as number);
        }
        break;

      case "ted_spread":
        currentValue = indicators.tedSpread ?? null;
        if (currentValue !== null) {
          if (condition === "above")
            matched = currentValue > (threshold as number);
        }
        break;

      case "fed_funds_rate":
        currentValue = indicators.fedFundsRate ?? null;
        if (currentValue !== null) {
          if (condition === "above")
            matched = currentValue > (threshold as number);
          else if (condition === "below")
            matched = currentValue < (threshold as number);
        }
        break;
    }
  }

  // VIX-sourced indicators (live)
  if (source === "vix") {
    switch (indicator) {
      case "vix_level":
        currentValue = indicators.vixLevel ?? null;
        if (currentValue !== null) {
          if (condition === "below")
            matched = currentValue < (threshold as number);
          else if (condition === "above")
            matched = currentValue > (threshold as number);
          else if (condition === "between") {
            const [lo, hi] = threshold as [number, number];
            matched = currentValue >= lo && currentValue <= hi;
          } else if (condition === "complacent")
            matched = currentValue < (threshold as number);
        }
        break;
    }
  }

  // Headline-sourced indicators (qualitative)
  if (source === "headline") {
    const signals = indicators.headlineSignals;
    const count = (() => {
      switch (indicator) {
        case "bank_stress":
          return countHeadlineSignals(signals, "bankStress");
        case "credit_headlines":
          return countHeadlineSignals(signals, "creditSpreadWidening");
        case "leverage_warnings":
          return countHeadlineSignals(signals, "leverageWarning");
        case "housing_weakness":
          return countHeadlineSignals(signals, "housingWeakness");
        case "geopolitical_headlines":
          return (
            countHeadlineSignals(signals, "geopolitical") +
            countHeadlineSignals(signals, "conflict")
          );
        case "liquidity_stress":
          return countHeadlineSignals(signals, "liquidityStress");
        case "contagion_headlines":
          return countHeadlineSignals(signals, "contagion");
        case "inflation_headlines":
          return (
            countHeadlineSignals(signals, "cpiPrint") +
            countHeadlineSignals(signals, "pcePrint")
          );
        case "narrow_leadership":
          return countHeadlineSignals(signals, "narrowLeadership");
        case "ipo_frenzy":
          return countHeadlineSignals(signals, "ipoFrenzy");
        case "valuation_extreme":
          return countHeadlineSignals(signals, "valuationExtreme");
        case "crypto_contagion":
          return countHeadlineSignals(signals, "cryptoContagion");
        case "bond_selloff":
          return countHeadlineSignals(signals, "bondSelloff");
        case "treasury_auction_weak":
          return countHeadlineSignals(signals, "treasuryAuctionWeak");
        default:
          return countHeadlineSignals(signals, indicator);
      }
    })();

    currentValue = count;
    if (condition === "above") matched = count >= (threshold as number);
  }

  return {
    indicator,
    currentValue,
    historicalCondition: `${condition} ${Array.isArray(threshold) ? threshold.join("-") : threshold}`,
    matched,
    weight,
    description,
  };
}

// ── Rhyme Matching ─────────────────────────────────────────────────────────────

/**
 * Evaluate how closely current conditions match each historical crisis.
 * Returns matches sorted by score (highest first), filtered above minScore.
 */
export function evaluateRhymes(
  indicators: MacroIndicators,
  minScore: number = 0.3,
): RhymeMatch[] {
  const config = loadHistoricalCrises();
  const matches: RhymeMatch[] = [];

  for (const crisis of config.crises) {
    const results = crisis.preconditions.map((p) =>
      evaluatePrecondition(p, indicators),
    );

    // Calculate weighted match score
    const totalWeight = results.reduce((sum, r) => sum + r.weight, 0);
    const matchedWeight = results
      .filter((r) => r.matched)
      .reduce((sum, r) => sum + r.weight, 0);

    const matchScore = totalWeight > 0 ? matchedWeight / totalWeight : 0;
    const matchedCount = results.filter((r) => r.matched).length;

    if (matchScore < minScore) continue;

    // Build timeline description
    const phases = crisis.phases;
    const unfoldingTimeline = phases
      .map(
        (p) =>
          `${p.name} (days ${p.dayRange[0]}-${p.dayRange[1]}): ${p.description}`,
      )
      .join("\n");

    matches.push({
      crisisId: crisis.id,
      crisisName: crisis.name,
      crisisYear: crisis.year,
      matchScore,
      matchedPreconditions: results,
      totalPreconditions: results.length,
      matchedCount,
      unfoldingTimeline,
      maxDrawdown: crisis.maxDrawdown,
      peakVix: crisis.peakVix,
      tradingGuidance: crisis.tradingLessons,
    });
  }

  // Sort by match score descending
  matches.sort((a, b) => b.matchScore - a.matchScore);

  return matches;
}

/**
 * Generate a human-readable rhyme alert headline.
 */
export function formatRhymeAlert(match: RhymeMatch): {
  headline: string;
  summary: string;
} {
  const pctMatch = Math.round(match.matchScore * 100);
  const matchedIndicators = match.matchedPreconditions
    .filter((p) => p.matched)
    .map((p) => p.description)
    .join(", ");

  const headline = `HISTORICAL RHYME: ${pctMatch}% match to ${match.crisisYear} ${match.crisisName} preconditions`;

  const summary =
    `Current conditions match ${match.matchedCount}/${match.totalPreconditions} preconditions of the ${match.crisisName}. ` +
    `Matched signals: ${matchedIndicators}. ` +
    `In ${match.crisisYear}, this pattern preceded a ${Math.abs(match.maxDrawdown)}% drawdown over ~${Math.round(
      (loadHistoricalCrises().crises.find((c) => c.id === match.crisisId)
        ?.unfoldingDays ?? 0) / 30,
    )} months with VIX peaking at ${match.peakVix}. ` +
    `Key lesson: ${match.tradingGuidance[0] ?? "Watch for escalation signals."}`;

  return { headline, summary };
}
