// [claude-code 2026-03-29] S9-T2b: Instrument-aware sentiment flipper — asset class map, 4-category reaction table, getInstrumentSentiment()
// [claude-code 2026-03-24] Added continuousVIXMultiplier() piecewise curve, finer EVENT_WEIGHTS with half-point granularity
// [claude-code 2026-03-12] Task 2B: Aligned leading indicator weights (ISM/PMI >= 7), VIX thresholds to playbook, multi-instrument support
// [claude-code 2026-03-11] IV Scoring V3: Added volatility taxonomy, regime-aware decay, new event types
// [claude-code 2026-03-09] Added config-driven scoring: IVScoringConfig type, loadIVScoringConfig(), config param on calculateIVScoreV2
/**
 * IV Scoring System v2/v3
 * V2: Event weights, session multipliers, VIX correlation, time decay, stacking
 * V3: Volatility taxonomy (multi-dimensional), regime-aware decay, causal chain triggers
 */

import type { ParsedHeadline, HotPrint } from "../types/news-analysis.js";
import type {
  VolatilityProfile,
  VolatilityTaxonomy,
  VixRegime,
} from "../types/volatility-taxonomy.js";
import { classifyVixRegime } from "../types/volatility-taxonomy.js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ============================================================================
// CONFIG TYPE + LOADER
// ============================================================================

export interface IVScoringConfig {
  eventWeights: Record<string, number>;
  sessions: Array<{
    name: string;
    multiplier: number;
    start: number;
    end: number;
  }>;
  vixMultipliers: Array<{ max: number; multiplier: number; context: string }>;
  decayHalfLives: Record<string, number>;
  instantTriggers: Record<string, number>;
  scoring: {
    synergyMultiplier: number;
    synergyWindowMinutes: number;
    maxScore: number;
    spilloverFactor: number;
    noEventBaselineDivisor: number;
    highIVBaseline: number;
    lowIVBaseline: number;
    highIVEventThreshold: number;
    alertScoreThreshold: number;
    blackSwanVixThreshold: number;
    blackSwanHoldMinutesHigh: number;
    blackSwanHoldMinutesLow: number;
    extremeVixThreshold: number;
    marketClosedDecayMultiplier: number;
  };
}

let _loadedConfig: IVScoringConfig | null = null;

/**
 * Load IV scoring config from JSON file. Returns cached config on subsequent calls.
 * Falls back to hardcoded defaults if file is missing or malformed.
 */
export function loadIVScoringConfig(): IVScoringConfig {
  if (_loadedConfig) return _loadedConfig;

  try {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const configPath = resolve(__dirname, "../config/iv-scoring-config.json");
    const raw = readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw);

    _loadedConfig = {
      eventWeights: { ...EVENT_WEIGHTS, ...parsed.eventWeights },
      sessions:
        parsed.sessions ??
        SESSIONS.map((s) => ({
          name: s.name,
          multiplier: s.multiplier,
          start: s.start,
          end: s.end,
        })),
      vixMultipliers:
        parsed.vixMultipliers ??
        VIX_MULTIPLIERS.map((v) => ({
          max: v.max === Infinity ? 999999 : v.max,
          multiplier: v.multiplier,
          context: v.context,
        })),
      decayHalfLives: { ...DECAY_HALF_LIVES, ...parsed.decayHalfLives },
      instantTriggers: { ...INSTANT_TRIGGERS, ...parsed.instantTriggers },
      scoring: {
        synergyMultiplier: 1.2,
        synergyWindowMinutes: 30,
        maxScore: 10,
        spilloverFactor: 0.2,
        noEventBaselineDivisor: 3,
        highIVBaseline: 4,
        lowIVBaseline: 1,
        highIVEventThreshold: 3,
        alertScoreThreshold: 8,
        blackSwanVixThreshold: 25,
        blackSwanHoldMinutesHigh: 60,
        blackSwanHoldMinutesLow: 30,
        extremeVixThreshold: 50,
        marketClosedDecayMultiplier: 0.5,
        ...parsed.scoring,
      },
    };

    console.log("[IV-Config] Loaded iv-scoring-config.json");
  } catch (err) {
    console.warn(
      "[IV-Config] Failed to load config, using hardcoded defaults:",
      err,
    );
    _loadedConfig = null;
  }

  return _loadedConfig ?? getDefaultConfig();
}

function getDefaultConfig(): IVScoringConfig {
  return {
    eventWeights: EVENT_WEIGHTS,
    sessions: SESSIONS.map((s) => ({
      name: s.name,
      multiplier: s.multiplier,
      start: s.start,
      end: s.end,
    })),
    vixMultipliers: VIX_MULTIPLIERS.map((v) => ({
      max: v.max === Infinity ? 999999 : v.max,
      multiplier: v.multiplier,
      context: v.context,
    })),
    decayHalfLives: DECAY_HALF_LIVES,
    instantTriggers: INSTANT_TRIGGERS,
    scoring: {
      synergyMultiplier: 1.2,
      synergyWindowMinutes: 30,
      maxScore: 10,
      spilloverFactor: 0.2,
      noEventBaselineDivisor: 3,
      highIVBaseline: 4,
      lowIVBaseline: 1,
      highIVEventThreshold: 3,
      alertScoreThreshold: 8,
      blackSwanVixThreshold: 25,
      blackSwanHoldMinutesHigh: 60,
      blackSwanHoldMinutesLow: 30,
      extremeVixThreshold: 50,
      marketClosedDecayMultiplier: 0.5,
    },
  };
}

/** Reset loaded config (for testing or hot-reload) */
export function resetIVScoringConfig(): void {
  _loadedConfig = null;
}

/** Get current active config */
export function getIVScoringConfig(): IVScoringConfig {
  return _loadedConfig ?? loadIVScoringConfig();
}

// ============================================================================
// VOLATILITY TAXONOMY LOADER (V3)
// ============================================================================

let _loadedTaxonomy: VolatilityTaxonomy | null = null;

/**
 * Load volatility taxonomy from JSON config.
 * Falls back to deriving profiles from EVENT_WEIGHTS if missing.
 */
export function loadVolatilityTaxonomy(): VolatilityTaxonomy {
  if (_loadedTaxonomy) return _loadedTaxonomy;

  try {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const configPath = resolve(__dirname, "../config/volatility-taxonomy.json");
    const raw = readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw);

    _loadedTaxonomy = {
      _version: parsed._version ?? "1.0.0",
      profiles: parsed.profiles ?? {},
    };

    console.log("[IV-V3] Loaded volatility taxonomy");
  } catch (err) {
    console.warn(
      "[IV-V3] Failed to load volatility taxonomy, using defaults:",
      err,
    );
    _loadedTaxonomy = null;
  }

  return _loadedTaxonomy ?? getDefaultTaxonomy();
}

function getDefaultTaxonomy(): VolatilityTaxonomy {
  // Build minimal profiles from flat EVENT_WEIGHTS
  const profiles: Record<string, VolatilityProfile> = {};
  for (const [key, weight] of Object.entries(EVENT_WEIGHTS)) {
    profiles[key] = {
      velocity: 3 as const,
      persistence: "hours" as const,
      breadth: 3 as const,
      transmissionChannels: ["equities"],
      reflexivity: 0.1,
      baseWeight: weight,
      decayBaseMinutes: DECAY_HALF_LIVES[key] ?? DECAY_HALF_LIVES.default,
      decayRegimeMultipliers: {
        low: 0.8,
        normal: 1.0,
        elevated: 1.3,
        crisis: 1.5,
      },
    };
  }
  return { _version: "0.0.0", profiles };
}

/**
 * Get volatility profile for an event type.
 * Falls back to 'default' profile, then to a minimal profile.
 */
export function getVolatilityProfile(eventType: string): VolatilityProfile {
  const taxonomy = loadVolatilityTaxonomy();
  return (
    taxonomy.profiles[eventType] ??
    taxonomy.profiles["default"] ?? {
      velocity: 2 as const,
      persistence: "hours" as const,
      breadth: 1 as const,
      transmissionChannels: ["equities"],
      reflexivity: 0.0,
      baseWeight: 3,
      decayBaseMinutes: 30,
      decayRegimeMultipliers: {
        low: 0.8,
        normal: 1.0,
        elevated: 1.0,
        crisis: 1.0,
      },
    }
  );
}

export function resetVolatilityTaxonomy(): void {
  _loadedTaxonomy = null;
}

// ============================================================================
// EVENT WEIGHT TABLE (from Grok spec)
// ============================================================================

export const EVENT_WEIGHTS: Record<string, number> = {
  // Black Swan events — rare, extreme volatility (10)
  blackSwan: 10,
  majorCrisis: 10,
  datacenterHalt: 10,
  governmentShutdown: 10,

  // Systemic stress (9-9.5)
  liquidityStress: 9.5,
  bankStress: 9,

  // Fed/Policy + Geopolitical (8-8.5)
  geopolitical: 8.5,
  fedDecision: 8.5,
  fomc: 8,
  powellSpeak: 8,
  tariffs: 8,
  chinaTrade: 8,
  conflict: 8,

  // Credit/Inflation/Employment (7-7.5)
  creditSpreadWidening: 7.5,
  cpiPrint: 7.5,
  nfpPrint: 7.5,
  pcePrint: 7,
  jolts: 7,
  earningsHighImpact: 7,
  ismPrint: 7,

  // Yield/GDP/Political (5.5-6.5)
  yieldCurveSignal: 6.5,
  gdpPrint: 6,
  leverageWarning: 6,
  politicalCommentary: 5.5,

  // Mid-tier (5)
  earningsMidCap: 5,
  retailSales: 5,

  // Lower-tier (3-4)
  technicalBreak: 4,
  jobless: 4,
  housing: 4,
  sectorNews: 3,
  merger: 3,
  other: 2.5,
  default: 2,

  // Legacy aliases (keep for backward compat with headline parser)
  bankingCrisis: 9,
  tariffEscalation: 8,
  economicData: 5,
  earnings: 5,
  ism: 7,
  trade: 5,
  ppiPrint: 7,
};

// ============================================================================
// SESSION MULTIPLIERS (liquidity-based)
// ============================================================================

export interface SessionInfo {
  name: string;
  multiplier: number;
  start: number; // Hour in ET (0-23)
  end: number;
}

export const SESSIONS: SessionInfo[] = [
  { name: "Asian", multiplier: 0.6, start: 19, end: 2 }, // 7pm-2am ET
  { name: "London", multiplier: 0.8, start: 2, end: 8 }, // 2am-8am ET
  { name: "NY", multiplier: 1.0, start: 8, end: 16 }, // 8am-4pm ET
  { name: "AfterHours", multiplier: 0.7, start: 16, end: 19 }, // 4pm-7pm ET
];

export function getCurrentSession(date: Date = new Date()): SessionInfo {
  const etHour = getEasternHour(date);

  for (const session of SESSIONS) {
    if (session.start > session.end) {
      // Wraps around midnight (Asian session)
      if (etHour >= session.start || etHour < session.end) {
        return session;
      }
    } else {
      if (etHour >= session.start && etHour < session.end) {
        return session;
      }
    }
  }

  // Default to NY if no match (shouldn't happen)
  return SESSIONS.find((s) => s.name === "NY")!;
}

function getEasternHour(date: Date): number {
  // Get UTC hour and convert to Eastern (-5, simplified)
  const utcHour = date.getUTCHours();
  return (utcHour + 24 - 5) % 24;
}

// ============================================================================
// VIX CORRELATION LOGIC
// ============================================================================

export interface VIXState {
  level: number;
  previousLevel: number;
  timestamp: Date;
  multiplier: number;
  spikeAdjustment: number;
}

export const VIX_MULTIPLIERS: {
  max: number;
  multiplier: number;
  context: string;
}[] = [
  // Playbook thresholds: <16 complacent, 16-22 risk-neutral, 22+ panic (22 VIX Fixer territory)
  {
    max: 16,
    multiplier: 0.8,
    context: "Complacent — choppy PA around 20/100 EMA, base hit day",
  },
  {
    max: 22,
    multiplier: 1.0,
    context: "Risk-neutral zone — normal setups, base hits to 40/40 club",
  },
  {
    max: 30,
    multiplier: 1.3,
    context:
      "22 VIX Fixer territory — panic reversal, trendy PA respecting 20/50 EMA",
  },
  {
    max: Infinity,
    multiplier: 1.5,
    context: "Extreme fear — home run potential, crisis mode",
  },
];

export function getVIXMultiplier(vixLevel: number): {
  multiplier: number;
  context: string;
} {
  for (const tier of VIX_MULTIPLIERS) {
    if (vixLevel < tier.max) {
      return { multiplier: tier.multiplier, context: tier.context };
    }
  }
  return { multiplier: 1.5, context: "Extreme volatility" };
}

/**
 * Continuous VIX multiplier via piecewise linear interpolation.
 * Replaces the 4-tier step function for per-item scoring.
 * getVIXMultiplier() is kept unchanged for the blended scorer.
 */
const VIX_CURVE: { vix: number; multiplier: number }[] = [
  { vix: 10, multiplier: 0.7 },
  { vix: 13, multiplier: 0.78 },
  { vix: 15, multiplier: 0.85 },
  { vix: 18, multiplier: 1.0 },
  { vix: 20, multiplier: 1.08 },
  { vix: 22, multiplier: 1.15 },
  { vix: 25, multiplier: 1.25 },
  { vix: 30, multiplier: 1.4 },
  { vix: 40, multiplier: 1.5 },
];

export function continuousVIXMultiplier(vix: number): number {
  if (vix <= VIX_CURVE[0].vix) return VIX_CURVE[0].multiplier;
  if (vix >= VIX_CURVE[VIX_CURVE.length - 1].vix)
    return VIX_CURVE[VIX_CURVE.length - 1].multiplier;

  for (let i = 0; i < VIX_CURVE.length - 1; i++) {
    const lo = VIX_CURVE[i];
    const hi = VIX_CURVE[i + 1];
    if (vix >= lo.vix && vix <= hi.vix) {
      const t = (vix - lo.vix) / (hi.vix - lo.vix);
      return lo.multiplier + t * (hi.multiplier - lo.multiplier);
    }
  }

  return 1.0; // fallback (shouldn't reach)
}

export function calculateVIXSpikeAdjustment(
  currentVix: number,
  previousVix: number,
  minutesElapsed: number,
): number {
  if (minutesElapsed > 15 || previousVix === 0) return 0;

  const pctChange = ((currentVix - previousVix) / previousVix) * 100;

  if (pctChange > 5) return 2; // VIX spike >5% in 15 min: +2
  if (pctChange < -5) return -1; // VIX drop >5%: -1
  return 0;
}

export function getNoEventBaseline(vixLevel: number): number {
  // Score = VIX / 3, cap at 10
  return Math.min(10, vixLevel / 3);
}

// ============================================================================
// TIME DECAY (exponential)
// ============================================================================

export const DECAY_HALF_LIVES: Record<string, number> = {
  // Red Folder events - 120 min
  fedDecision: 120,
  fomc: 120,
  powellSpeak: 120,
  cpiPrint: 120,
  pcePrint: 120,
  nfpPrint: 120,

  // Geopolitical/Political - 90 min
  geopolitical: 90,
  tariffs: 90,
  chinaTrade: 90,
  conflict: 90,
  politicalCommentary: 90,

  // Earnings/Options - 60 min
  earningsHighImpact: 60,
  earningsMidCap: 60,

  // Leading indicators (forward signal) - 90 min
  ismPrint: 90,

  // Other - 30 min
  default: 30,

  // V3: Credit/Yield/Liquidity events (longer half-lives — slow burn)
  creditSpreadWidening: 1440, // 24 hours
  yieldCurveSignal: 1440, // 24 hours
  liquidityStress: 720, // 12 hours
  bankStress: 1440, // 24 hours
  leverageWarning: 4320, // 3 days
};

export function calculateDecayedScore(
  baseScore: number,
  eventType: string,
  minutesSinceEvent: number,
): number {
  const halfLife = DECAY_HALF_LIVES[eventType] ?? DECAY_HALF_LIVES.default;
  const decayFactor = Math.pow(0.5, minutesSinceEvent / halfLife);
  return baseScore * decayFactor;
}

/**
 * V3 regime-aware decay: half-life scales with VIX regime.
 * In crisis (VIX > 30), events persist 2-5x longer depending on type.
 * Credit events get 1440-min base with 4x crisis multiplier = 4-day effective half-life.
 */
export function calculateDecayedScoreV3(
  baseScore: number,
  eventType: string,
  minutesSinceEvent: number,
  currentVixLevel: number,
): number {
  const profile = getVolatilityProfile(eventType);
  const regime = classifyVixRegime(currentVixLevel);
  const regimeMultiplier = profile.decayRegimeMultipliers[regime];
  const effectiveHalfLife = profile.decayBaseMinutes * regimeMultiplier;
  const decayFactor = Math.pow(0.5, minutesSinceEvent / effectiveHalfLife);
  return baseScore * decayFactor;
}

/**
 * Get the event weight from the volatility taxonomy (V3) if available,
 * falling back to flat EVENT_WEIGHTS (V2).
 */
export function getEventWeight(eventType: string): number {
  const profile = getVolatilityProfile(eventType);
  return profile.baseWeight;
}

/**
 * Get instrument-adjusted event weight.
 * Uses taxonomy instrumentOverrides if available for the event type.
 */
export function getInstrumentAdjustedWeight(
  eventType: string,
  instrument: string,
): number {
  const profile = getVolatilityProfile(eventType);
  const override = profile.instrumentOverrides?.[instrument];
  if (override !== undefined) {
    return profile.baseWeight * override;
  }
  return profile.baseWeight;
}

// ============================================================================
// ACTIVITY LEVEL BASELINE
// ============================================================================

export interface ActivityLevel {
  isHighIV: boolean;
  baseline: number;
  context: string;
}

export function getActivityBaseline(
  eventCount: number,
  isEarningsSeason: boolean,
  isFOMCWeek: boolean,
): ActivityLevel {
  const isHighIV = eventCount >= 3 || isEarningsSeason || isFOMCWeek;

  if (isHighIV) {
    return {
      isHighIV: true,
      baseline: 4,
      context:
        "Elevated ambient vol, trendy PA respecting 20/50 EMA; use Anchored VWAP",
    };
  }

  return {
    isHighIV: false,
    baseline: 1,
    context: "Floor for choppy PA around 20/100 EMA; use ORB/Power Hour",
  };
}

// ============================================================================
// STACKING LOGIC
// ============================================================================

export interface StackedEvent {
  eventType: string;
  baseScore: number;
  timestamp: Date;
  decayedScore?: number;
}

export function calculateStackedScore(
  events: StackedEvent[],
  now: Date = new Date(),
  vixLevel?: number,
): { score: number; synergy: boolean; events: StackedEvent[] } {
  if (events.length === 0) {
    return { score: 0, synergy: false, events: [] };
  }

  // Calculate decayed scores for all events (V3 regime-aware if VIX provided)
  const processedEvents = events.map((event) => {
    const minutesSince = (now.getTime() - event.timestamp.getTime()) / 60000;
    const decayed =
      vixLevel !== undefined
        ? calculateDecayedScoreV3(
            event.baseScore,
            event.eventType,
            minutesSince,
            vixLevel,
          )
        : calculateDecayedScore(event.baseScore, event.eventType, minutesSince);
    return { ...event, decayedScore: decayed };
  });

  // Sum all decayed scores
  let totalScore = processedEvents.reduce(
    (sum, e) => sum + (e.decayedScore ?? 0),
    0,
  );

  // Check for synergy (events <30 min apart)
  let synergy = false;
  if (events.length >= 2) {
    const sortedByTime = [...events].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
    );
    for (let i = 1; i < sortedByTime.length; i++) {
      const gap =
        (sortedByTime[i].timestamp.getTime() -
          sortedByTime[i - 1].timestamp.getTime()) /
        60000;
      if (gap < 30) {
        synergy = true;
        break;
      }
    }
  }

  // Apply synergy boost
  if (synergy) {
    totalScore *= 1.2;
  }

  // Cap at 10
  totalScore = Math.min(10, totalScore);

  return { score: totalScore, synergy, events: processedEvents };
}

// ============================================================================
// INSTRUMENT BETA TABLE
// Beta = correlation to SPX volatility (1.0 = moves with SPX, <1 = less volatile)
// ============================================================================

export const INSTRUMENT_BETAS: Record<
  string,
  {
    beta: number;
    tickValue: number;
    tickSize: number;
    currentPrice: number;
    notes: string;
  }
> = {
  // Equity Index Futures
  "/ES": {
    beta: 1.0,
    tickValue: 12.5,
    tickSize: 0.25,
    currentPrice: 6000,
    notes: "E-mini S&P 500 - Base reference",
  },
  "/MES": {
    beta: 1.0,
    tickValue: 1.25,
    tickSize: 0.25,
    currentPrice: 6000,
    notes: "Micro E-mini S&P 500",
  },
  "/NQ": {
    beta: 1.2,
    tickValue: 5.0,
    tickSize: 0.25,
    currentPrice: 21000,
    notes: "E-mini Nasdaq 100 - Tech-heavy",
  },
  "/MNQ": {
    beta: 1.2,
    tickValue: 0.5,
    tickSize: 0.25,
    currentPrice: 21000,
    notes: "Micro E-mini Nasdaq 100",
  },
  "/YM": {
    beta: 0.95,
    tickValue: 5.0,
    tickSize: 1.0,
    currentPrice: 44000,
    notes: "E-mini Dow Jones - Industrials",
  },
  "/MYM": {
    beta: 0.95,
    tickValue: 0.5,
    tickSize: 1.0,
    currentPrice: 44000,
    notes: "Micro E-mini Dow Jones",
  },
  "/RTY": {
    beta: 1.1,
    tickValue: 5.0,
    tickSize: 0.1,
    currentPrice: 2200,
    notes: "E-mini Russell 2000 - Small caps",
  },
  "/M2K": {
    beta: 1.1,
    tickValue: 0.5,
    tickSize: 0.1,
    currentPrice: 2200,
    notes: "Micro E-mini Russell 2000",
  },

  // Commodities
  "/CL": {
    beta: 0.6,
    tickValue: 10.0,
    tickSize: 0.01,
    currentPrice: 75,
    notes: "Crude Oil - Energy sector proxy",
  },
  "/MCL": {
    beta: 0.6,
    tickValue: 1.0,
    tickSize: 0.01,
    currentPrice: 75,
    notes: "Micro Crude Oil",
  },
  "/GC": {
    beta: 0.2,
    tickValue: 10.0,
    tickSize: 0.1,
    currentPrice: 2650,
    notes: "Gold - Safe-haven, inverse correlation",
  },
  "/MGC": {
    beta: 0.2,
    tickValue: 1.0,
    tickSize: 0.1,
    currentPrice: 2650,
    notes: "Micro Gold",
  },
  "/SI": {
    beta: 0.4,
    tickValue: 25.0,
    tickSize: 0.005,
    currentPrice: 30,
    notes: "Silver - Industrial/vol proxy",
  },
  "/SIL": {
    beta: 0.4,
    tickValue: 2.5,
    tickSize: 0.005,
    currentPrice: 30,
    notes: "Micro Silver",
  },
  "/NG": {
    beta: 0.5,
    tickValue: 10.0,
    tickSize: 0.001,
    currentPrice: 3.5,
    notes: "Natural Gas - High volatility",
  },

  // Currencies (low SPX correlation)
  "/6E": {
    beta: 0.3,
    tickValue: 12.5,
    tickSize: 0.00005,
    currentPrice: 1.08,
    notes: "Euro FX",
  },
  "/6J": {
    beta: 0.25,
    tickValue: 12.5,
    tickSize: 0.0000005,
    currentPrice: 0.0067,
    notes: "Japanese Yen",
  },
  "/6B": {
    beta: 0.35,
    tickValue: 6.25,
    tickSize: 0.0001,
    currentPrice: 1.27,
    notes: "British Pound",
  },

  // Bonds (inverse correlation during risk-off)
  "/ZB": {
    beta: -0.3,
    tickValue: 31.25,
    tickSize: 0.03125,
    currentPrice: 118,
    notes: "30-Year Treasury Bond",
  },
  "/ZN": {
    beta: -0.25,
    tickValue: 15.625,
    tickSize: 0.015625,
    currentPrice: 110,
    notes: "10-Year Treasury Note",
  },
};

// ============================================================================
// IMPLIED POINTS CALCULATION (Rule of 16)
// Formula: Daily Expected Move = Price × (VIX / 16) / 100 × Beta
// ============================================================================

export interface ImpliedPoints {
  impliedPct: number;
  basePoints: number;
  adjustedPoints: number;
  adjustedTicks: number;
  tickValue: number;
  dollarRisk: number;
  instrument: string;
  beta: number;
}

export function calculateImpliedPoints(
  vixLevel: number,
  currentPrice: number | undefined,
  instrument: string,
): ImpliedPoints {
  // Get instrument config (or defaults)
  const instrumentConfig = INSTRUMENT_BETAS[instrument] ?? {
    beta: 1.0,
    tickValue: 1.0,
    tickSize: 0.25,
    currentPrice: 6000,
    notes: "Unknown instrument - using /ES defaults",
  };

  // Use provided price or fallback to config price
  const price = currentPrice ?? instrumentConfig.currentPrice;

  // Rule of 16: Implied daily % move = VIX / 16
  // e.g., VIX 20 = 1.25% expected daily move
  const impliedPct = vixLevel / 16;

  // Base points = Price × Implied%
  // e.g., 6000 × 1.25% = 75 points for /ES
  const basePoints = price * (impliedPct / 100);

  // Adjusted points = Base × Beta
  // e.g., /NQ with beta 1.2 = 75 × 1.2 = 90 points
  const adjustedPoints = basePoints * Math.abs(instrumentConfig.beta);

  // Convert to ticks for the instrument
  const adjustedTicks = adjustedPoints / instrumentConfig.tickSize;

  // Calculate dollar risk per contract
  const dollarRisk = adjustedTicks * instrumentConfig.tickValue;

  return {
    impliedPct: Number(impliedPct.toFixed(2)),
    basePoints: Number(basePoints.toFixed(1)),
    adjustedPoints: Number(adjustedPoints.toFixed(1)),
    adjustedTicks: Math.round(adjustedTicks),
    tickValue: instrumentConfig.tickValue,
    dollarRisk: Number(dollarRisk.toFixed(2)),
    instrument,
    beta: instrumentConfig.beta,
  };
}

/**
 * Get instrument config by symbol
 */
export function getInstrumentConfig(instrument: string) {
  return INSTRUMENT_BETAS[instrument] ?? null;
}

/**
 * List all supported instruments
 */
export function getSupportedInstruments(): string[] {
  return Object.keys(INSTRUMENT_BETAS);
}

// ============================================================================
// RED FOLDER INSTANT TRIGGERS
// ============================================================================

export const INSTANT_TRIGGERS: Record<string, number> = {
  // Set to 10 - Black Swan only
  blackSwan: 10,
  datacenterHalt: 10,
  governmentShutdown: 10,
  majorCrisis: 10,

  // Set to 8+ - Fed/Geo surprises
  fedDecision: 8,
  fomc: 8,
  powellSpeak: 8,
  geopolitical: 8,
  tariffs: 8,

  // Set to 6-7 - Macro surprises
  cpiPrint: 7,
  nfpPrint: 7,
  gdpPrint: 6,

  // V3: Systemic risk triggers
  liquidityStress: 9,
  bankStress: 9,
  creditSpreadWidening: 8,
};

export function isInstantTrigger(eventType: string): {
  isInstant: boolean;
  minScore: number;
} {
  const minScore = INSTANT_TRIGGERS[eventType];
  return {
    isInstant: minScore !== undefined,
    minScore: minScore ?? 0,
  };
}

// ============================================================================
// EDGE CASES
// ============================================================================

export interface EdgeCaseResult {
  triggered: boolean;
  score?: number;
  message?: string;
  holdMinutes?: number;
}

export function checkEdgeCases(
  eventType: string,
  vixLevel: number,
  isMarketClosed: boolean,
): EdgeCaseResult {
  // Black Swan: Auto-10, hold 60 min if VIX >25
  if (
    eventType === "blackSwan" ||
    eventType === "datacenterHalt" ||
    eventType === "majorCrisis"
  ) {
    return {
      triggered: true,
      score: 10,
      message: "Get focused 'cause this one of them ones",
      holdMinutes: vixLevel > 25 ? 60 : 30,
    };
  }

  // Extreme VIX (>50): Auto-10
  if (vixLevel > 50) {
    return {
      triggered: true,
      score: 10,
      message: "Get focused 'cause this one of them ones - Extreme VIX",
    };
  }

  // Market closed: Apply 0.5 decay multiplier daily
  if (isMarketClosed) {
    return {
      triggered: true,
      message: "Market closed - using last close VIX with 0.5 daily decay",
    };
  }

  return { triggered: false };
}

// ============================================================================
// MULTI-SESSION SPILLOVER
// ============================================================================

export function calculateSpillover(previousSessionScore: number): number {
  // Carry 20% of prior session's final score into next
  return previousSessionScore * 0.2;
}

// ============================================================================
// MAIN SCORING FUNCTION
// ============================================================================

export interface IVScoreInputV2 {
  events: StackedEvent[];
  vixLevel: number;
  previousVixLevel?: number;
  vixUpdateMinutes?: number;
  currentPrice: number;
  instrument: string;
  isMarketClosed?: boolean;
  isEarningsSeason?: boolean;
  isFOMCWeek?: boolean;
  previousSessionScore?: number;
}

export interface IVScoreResultV2 {
  score: number;
  impliedPoints: ImpliedPoints;
  session: SessionInfo;
  vixMultiplier: number;
  vixContext: string;
  activityBaseline: number;
  stackedEvents: number;
  synergy: boolean;
  rationale: string[];
  alert?: string;
}

export function calculateIVScoreV2(
  input: IVScoreInputV2,
  config?: Partial<IVScoringConfig>,
): IVScoreResultV2 {
  const {
    events,
    vixLevel,
    previousVixLevel = vixLevel,
    vixUpdateMinutes = 0,
    currentPrice,
    instrument,
    isMarketClosed = false,
    isEarningsSeason = false,
    isFOMCWeek = false,
    previousSessionScore = 0,
  } = input;

  // Resolve config: explicit param > loaded file > hardcoded defaults
  const resolvedConfig = { ...getIVScoringConfig(), ...config };
  const sc = resolvedConfig.scoring ?? getIVScoringConfig().scoring;

  const rationale: string[] = [];
  const now = new Date();

  // Check edge cases first (uses config scoring thresholds)
  for (const event of events) {
    const edgeCase = checkEdgeCases(event.eventType, vixLevel, isMarketClosed);
    if (edgeCase.triggered && edgeCase.score !== undefined) {
      const points = calculateImpliedPoints(vixLevel, currentPrice, instrument);
      return {
        score: edgeCase.score,
        impliedPoints: points,
        session: getCurrentSession(now),
        vixMultiplier: getVIXMultiplier(vixLevel).multiplier,
        vixContext: getVIXMultiplier(vixLevel).context,
        activityBaseline: sc.maxScore,
        stackedEvents: events.length,
        synergy: false,
        rationale: [edgeCase.message!],
        alert: edgeCase.message,
      };
    }
  }

  // Get session multiplier
  const session = getCurrentSession(now);
  rationale.push(`Session: ${session.name} (×${session.multiplier})`);

  // Get VIX multiplier (from config if available)
  let vixMult = 1.0;
  let vixContext = "Unknown";
  if (resolvedConfig.vixMultipliers) {
    for (const tier of resolvedConfig.vixMultipliers) {
      if (vixLevel < tier.max) {
        vixMult = tier.multiplier;
        vixContext = tier.context;
        break;
      }
    }
  } else {
    const result = getVIXMultiplier(vixLevel);
    vixMult = result.multiplier;
    vixContext = result.context;
  }
  rationale.push(`VIX ${vixLevel.toFixed(1)}: ×${vixMult} (${vixContext})`);

  // Get VIX spike adjustment
  const spikeAdj = calculateVIXSpikeAdjustment(
    vixLevel,
    previousVixLevel,
    vixUpdateMinutes,
  );
  if (spikeAdj !== 0) {
    rationale.push(
      `VIX spike adjustment: ${spikeAdj > 0 ? "+" : ""}${spikeAdj}`,
    );
  }

  // Get activity baseline (using config thresholds)
  const isHighIV =
    events.length >= sc.highIVEventThreshold || isEarningsSeason || isFOMCWeek;
  const activityBaseline = isHighIV ? sc.highIVBaseline : sc.lowIVBaseline;
  rationale.push(
    `Activity baseline: ${activityBaseline} (${isHighIV ? "High IV" : "Low IV"})`,
  );

  // Calculate stacked score from events
  let score: number;
  let synergy = false;

  if (events.length === 0) {
    // No events - use VIX baseline (config divisor)
    score = Math.min(sc.maxScore, vixLevel / sc.noEventBaselineDivisor);
    rationale.push(`No events - VIX baseline: ${score.toFixed(1)}`);
  } else {
    const stacked = calculateStackedScore(events, now, vixLevel);
    score = stacked.score;
    synergy = stacked.synergy;

    if (synergy) {
      rationale.push(
        `Synergy boost applied (events <${sc.synergyWindowMinutes} min apart): ×${sc.synergyMultiplier}`,
      );
    }
    rationale.push(`Stacked events score: ${score.toFixed(2)}`);
  }

  // Apply session multiplier
  score *= session.multiplier;
  rationale.push(`After session multiplier: ${score.toFixed(2)}`);

  // Apply VIX multiplier
  score *= vixMult;
  rationale.push(`After VIX multiplier: ${score.toFixed(2)}`);

  // Add VIX spike adjustment
  score += spikeAdj;

  // Add spillover from previous session (config factor)
  if (previousSessionScore > 0) {
    const spillover = previousSessionScore * sc.spilloverFactor;
    score += spillover;
    rationale.push(`Spillover from previous session: +${spillover.toFixed(2)}`);
  }

  // Ensure score is within bounds (config max)
  score = Math.max(0, Math.min(sc.maxScore, score));

  // Add activity baseline floor
  score = Math.max(score, activityBaseline);

  rationale.push(`Final score: ${score.toFixed(1)}`);

  // Calculate implied points
  const impliedPoints = calculateImpliedPoints(
    vixLevel,
    currentPrice,
    instrument,
  );
  rationale.push(
    `Implied move: ±${impliedPoints.adjustedPoints} points (${instrument}, β=${impliedPoints.beta})`,
  );

  // Determine if alert needed (config threshold)
  let alert: string | undefined;
  if (score >= sc.alertScoreThreshold) {
    alert = "Get focused 'cause this one of them ones";
  }

  return {
    score: Number(score.toFixed(1)),
    impliedPoints,
    session,
    vixMultiplier: vixMult,
    vixContext,
    activityBaseline,
    stackedEvents: events.length,
    synergy,
    rationale,
    alert,
  };
}

// ============================================================================
// EVENT TYPE CLASSIFIER (from headline parsing)
// ============================================================================

// Strict word-boundary test — prevents "recipe" matching "cpi", etc.
function wordMatch(text: string, word: string): boolean {
  return new RegExp(`\\b${word}\\b`, "i").test(text);
}

export function classifyEventType(parsed: ParsedHeadline): string {
  const headline = (parsed.raw ?? "").toLowerCase();
  const eventType = parsed.eventType?.toLowerCase() ?? "";

  // Black Swan detection
  if (
    headline.includes("halt") &&
    (headline.includes("datacenter") || headline.includes("trading"))
  ) {
    return "datacenterHalt";
  }
  if (headline.includes("shutdown") && headline.includes("government")) {
    return "governmentShutdown";
  }
  if (
    headline.includes("crisis") ||
    headline.includes("collapse") ||
    headline.includes("emergency")
  ) {
    return "majorCrisis";
  }

  // V3: Credit risk detection
  if (
    headline.includes("credit spread") ||
    headline.includes("credit default swap") ||
    (headline.includes("high yield") &&
      (headline.includes("spread") ||
        headline.includes("widen") ||
        headline.includes("blow"))) ||
    (headline.includes("junk bond") &&
      (headline.includes("sell") ||
        headline.includes("spread") ||
        headline.includes("stress"))) ||
    (wordMatch(headline, "cds") &&
      (headline.includes("spike") ||
        headline.includes("widen") ||
        headline.includes("surge")))
  ) {
    return "creditSpreadWidening";
  }

  // V3: Yield curve signals
  if (
    (headline.includes("yield curve") ||
      headline.includes("2s10s") ||
      wordMatch(headline, "3m10y") ||
      (headline.includes("2-year") && headline.includes("10-year"))) &&
    (headline.includes("invert") ||
      headline.includes("steepen") ||
      headline.includes("flatten") ||
      headline.includes("uninvert") ||
      headline.includes("signal"))
  ) {
    return "yieldCurveSignal";
  }

  // V3: Liquidity stress
  if (
    headline.includes("repo rate") ||
    headline.includes("ted spread") ||
    headline.includes("dollar funding") ||
    headline.includes("liquidity crunch") ||
    headline.includes("liquidity crisis") ||
    headline.includes("funding stress") ||
    (headline.includes("overnight") &&
      headline.includes("rate") &&
      headline.includes("spike"))
  ) {
    return "liquidityStress";
  }

  // V3: Bank stress
  if (
    (wordMatch(headline, "bank") || headline.includes("banking")) &&
    (headline.includes("stress") ||
      headline.includes("fail") ||
      headline.includes("run") ||
      headline.includes("insolvency") ||
      headline.includes("bailout") ||
      headline.includes("deposit flight") ||
      headline.includes("fdic"))
  ) {
    return "bankStress";
  }

  // V3: Leverage warnings
  if (
    (headline.includes("margin debt") ||
      headline.includes("leverage ratio") ||
      headline.includes("record margin") ||
      headline.includes("margin call")) &&
    (headline.includes("record") ||
      headline.includes("high") ||
      headline.includes("surge") ||
      headline.includes("warning") ||
      headline.includes("cascade"))
  ) {
    return "leverageWarning";
  }

  // Fed/Policy
  if (
    eventType === "feddecision" ||
    wordMatch(headline, "fomc") ||
    /\bfed\b/.test(headline)
  ) {
    if (headline.includes("powell")) return "powellSpeak";
    return "fedDecision";
  }

  // Geopolitical
  if (headline.includes("tariff")) return "tariffs";
  if (headline.includes("china") && wordMatch(headline, "trade"))
    return "chinaTrade";
  if (
    wordMatch(headline, "war") ||
    headline.includes("attack") ||
    headline.includes("missile")
  )
    return "conflict";
  if (eventType === "geopolitical") return "geopolitical";

  // Economic Data — strict keyword gates (word boundaries prevent false positives)
  if (
    eventType === "cpiprint" ||
    wordMatch(headline, "cpi") ||
    headline.includes("consumer price index")
  )
    return "cpiPrint";
  if (
    eventType === "pceprint" ||
    wordMatch(headline, "pce") ||
    headline.includes("personal consumption")
  )
    return "pcePrint";
  if (
    eventType === "nfpprint" ||
    wordMatch(headline, "nfp") ||
    headline.includes("payrolls") ||
    headline.includes("non-farm")
  )
    return "nfpPrint";
  if (wordMatch(headline, "jolts")) return "jolts";
  if (
    eventType === "gdpprint" ||
    wordMatch(headline, "gdp") ||
    headline.includes("gross domestic")
  )
    return "gdpPrint";
  if (
    wordMatch(headline, "ism") ||
    headline.includes("institute for supply management")
  )
    return "ismPrint";

  // Political Commentary — Senate/Congress/cabinet officials → commentary, NOT geopolitical
  if (
    headline.includes("trump") ||
    headline.includes("lutnick") ||
    headline.includes("bessent") ||
    headline.includes("senate") ||
    headline.includes("congress") ||
    headline.includes("speaker") ||
    headline.includes("white house") ||
    headline.includes("mnuchin")
  ) {
    return "politicalCommentary";
  }

  // Earnings
  if (eventType === "earnings" || headline.includes("earnings")) {
    // Check for Mag7
    const mag7 = ["aapl", "msft", "googl", "amzn", "meta", "nvda", "tsla"];
    if (mag7.some((ticker) => headline.includes(ticker))) {
      return "earningsHighImpact";
    }
    return "earningsMidCap";
  }

  // Other
  if (headline.includes("merger") || headline.includes("acquisition"))
    return "merger";
  if (headline.includes("retail sales")) return "retailSales";

  return "other";
}

// ============================================================================
// [claude-code 2026-03-28] S9-T2: MARTINGALE DIMINISHING RETURNS
// Repeated high-severity headlines in a 4h window get diminishing implied points.
// Escalation chains (military action, strikes, etc.) bypass the cap.
// ============================================================================

const SESSION_WINDOW_MS = 4 * 60 * 60 * 1000;

interface SessionHeadlineEntry {
  timestamp: number;
  macroLevel: number;
  headline: string;
}

const sessionHeadlines: SessionHeadlineEntry[] = [];

const ESCALATION_KEYWORDS = [
  "military",
  "strike",
  "bomb",
  "invasion",
  "retaliate",
  "mobilize",
  "deploy",
  "attack",
  "offensive",
  "missile",
  "nuclear",
  "blockade",
  "drone",
];

export function isEscalation(headline: string): boolean {
  const lower = headline.toLowerCase();
  return ESCALATION_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * Get Martingale multiplier for implied points.
 * 1st critical headline of session: 100%
 * 2nd: 60%
 * 3rd+: 30%
 * Escalation chains bypass diminishing returns entirely.
 */
export function getMartingaleMultiplier(
  headline: string,
  macroLevel: number,
): number {
  const now = Date.now();

  // Prune stale entries outside the 4h session window
  while (
    sessionHeadlines.length > 0 &&
    now - sessionHeadlines[0].timestamp > SESSION_WINDOW_MS
  ) {
    sessionHeadlines.shift();
  }

  // Escalation bypasses diminishing returns — full weight always
  if (isEscalation(headline)) {
    sessionHeadlines.push({ timestamp: now, macroLevel, headline });
    return 1.0;
  }

  // Count high-impact items already in session (macroLevel >= 3)
  const criticalCount = sessionHeadlines.filter(
    (e) => e.macroLevel >= 3,
  ).length;

  // Record this entry
  sessionHeadlines.push({ timestamp: now, macroLevel, headline });

  // Diminishing returns
  if (criticalCount <= 0) return 1.0;
  if (criticalCount === 1) return 0.6;
  return 0.3;
}

// ============================================================================
// S9-T2: CONTEXTUAL SENTIMENT ENFORCEMENT
// Not a flat keyword list. Uses if-this-then-that rules:
//   - destruction/violence/escalation → bearish
//   - de-escalation/peace/resolution → bullish
//   - context-dependent combos: "sanctions lifted" = bullish, "new sanctions" = bearish
//   - monetary policy: "rate cut" = bullish, "rate hike" = bearish
// ============================================================================

// ── Unambiguous bearish (no context needed) ──
const FORCED_BEARISH = [
  "bomb",
  "bombing",
  "drone strike",
  "drone attack",
  "airstrike",
  "missile",
  "nuclear",
  "invasion",
  "invade",
  "destroy",
  "destruction",
  "devastat",
  "war crime",
  "genocide",
  "massacre",
  "blockade",
  "siege",
  "crash",
  "collapse",
  "meltdown",
  "default",
  "insolvency",
  "bankruptcy",
  "government shutdown",
  "contagion",
  "bank run",
  "liquidity crisis",
  "panic sell",
  "flash crash",
];

// ── Unambiguous bullish (no context needed) ──
const FORCED_BULLISH = [
  "ceasefire",
  "cease fire",
  "peace deal",
  "peace agreement",
  "peace treaty",
  "de-escalat",
  "deescalat",
  "truce",
  "hostage release",
  "prisoner exchange",
  "diplomatic breakthrough",
  "diplomatic resolution",
  "stimulus package",
  "stimulus plan",
  "record high",
  "all-time high",
  "recession averted",
  "soft landing confirmed",
];

// ── Context-dependent: [trigger, modifier, direction] ──
// If headline has trigger AND modifier → force that direction.
// If headline has trigger WITHOUT modifier → fall through to next rule or keep original.
interface ContextRule {
  trigger: string;
  bullishModifiers: string[];
  bearishModifiers: string[];
}

const CONTEXT_RULES: ContextRule[] = [
  // Sanctions: "lifted/eased/removed" = bullish, "new/impose/expand" = bearish
  {
    trigger: "sanction",
    bullishModifiers: [
      "lift",
      "ease",
      "remov",
      "suspend",
      "waiv",
      "relax",
      "roll back",
    ],
    bearishModifiers: [
      "new",
      "impose",
      "expand",
      "escalat",
      "tighten",
      "additional",
      "sweeping",
    ],
  },
  // Rate decisions: "cut" = bullish, "hike/raise" = bearish
  {
    trigger: "rate",
    bullishModifiers: ["cut", "lower", "reduc", "ease", "dovish", "pause"],
    bearishModifiers: [
      "hike",
      "raise",
      "increas",
      "hawk",
      "tighten",
      "higher for longer",
    ],
  },
  // Tariff: "remove/reduce/exempt" = bullish, "new/impose/increase" = bearish
  {
    trigger: "tariff",
    bullishModifiers: [
      "remov",
      "reduc",
      "exempt",
      "rollback",
      "repeal",
      "suspen",
      "delay",
      "pause",
    ],
    bearishModifiers: [
      "new",
      "impose",
      "increas",
      "escalat",
      "retaliatory",
      "additional",
      "raise",
      "hike",
    ],
  },
  // Strike: military context = bearish, labor context = depends
  {
    trigger: "strike",
    bullishModifiers: ["end", "settle", "resolution", "averted"],
    bearishModifiers: [
      "military",
      "air",
      "drone",
      "missile",
      "target",
      "retaliat",
      "launch",
      "bomb",
    ],
  },
  // Conflict: resolution = bullish, escalation = bearish
  {
    trigger: "conflict",
    bullishModifiers: [
      "resolv",
      "de-escalat",
      "peace",
      "end",
      "wind down",
      "ceasefire",
    ],
    bearishModifiers: [
      "escalat",
      "intensif",
      "spread",
      "widen",
      "new front",
      "expand",
    ],
  },
  // War: ending = bullish, starting/escalating = bearish
  {
    trigger: "war",
    bullishModifiers: [
      "end",
      "ceasefire",
      "peace",
      "truce",
      "withdraw",
      "retreat",
    ],
    bearishModifiers: [
      "declar",
      "escalat",
      "expand",
      "new",
      "threaten",
      "mobiliz",
    ],
  },
  // Trade: deal/agreement = bullish, war/dispute = bearish
  {
    trigger: "trade",
    bullishModifiers: ["deal", "agreement", "pact", "cooperat", "open"],
    bearishModifiers: ["war", "disput", "restrict", "ban", "block", "retali"],
  },
  // Recession: fears/entering = bearish, avoiding/exiting = bullish
  {
    trigger: "recession",
    bullishModifiers: ["averted", "avoid", "exit", "over", "end", "unlikely"],
    bearishModifiers: [
      "enter",
      "confirm",
      "fear",
      "risk",
      "deepen",
      "loom",
      "imminent",
      "warn",
    ],
  },
  // Shutdown: averted = bullish, looming/starts = bearish
  {
    trigger: "shutdown",
    bullishModifiers: ["averted", "avoid", "deal", "fund", "reopen"],
    bearishModifiers: [
      "loom",
      "begin",
      "start",
      "partial",
      "full",
      "extend",
      "no deal",
    ],
  },
];

/**
 * Contextual sentiment enforcement.
 * Checks unambiguous bearish/bullish lists first, then applies context-dependent rules.
 * Falls back to the Grok analyzer's original sentiment if no rule matches.
 */
export function enforceSentiment(
  headline: string,
  currentSentiment: string,
): string {
  const lower = headline.toLowerCase();

  // 1. Unambiguous bearish — destruction, violence, systemic crisis
  if (FORCED_BEARISH.some((kw) => lower.includes(kw))) {
    return "bearish";
  }

  // 2. Unambiguous bullish — peace, de-escalation, resolution
  if (FORCED_BULLISH.some((kw) => lower.includes(kw))) {
    return "bullish";
  }

  // 3. Context-dependent rules — trigger + modifier
  for (const rule of CONTEXT_RULES) {
    if (!lower.includes(rule.trigger)) continue;

    const hasBullishMod = rule.bullishModifiers.some((m) => lower.includes(m));
    const hasBearishMod = rule.bearishModifiers.some((m) => lower.includes(m));

    // If both modifiers present, whichever has more matches wins
    if (hasBullishMod && !hasBearishMod) return "bullish";
    if (hasBearishMod && !hasBullishMod) return "bearish";
    if (hasBullishMod && hasBearishMod) {
      const bullCount = rule.bullishModifiers.filter((m) =>
        lower.includes(m),
      ).length;
      const bearCount = rule.bearishModifiers.filter((m) =>
        lower.includes(m),
      ).length;
      if (bullCount > bearCount) return "bullish";
      if (bearCount > bullCount) return "bearish";
      // Tie: keep bearish (conservative — protect capital)
      return "bearish";
    }
  }
  return currentSentiment;
}

// ============================================================================
// S9-T2b: INSTRUMENT-AWARE SENTIMENT FLIPPER
// The equity sentiment (from enforceSentiment) is /ES-centric. When a user
// selects a different instrument (e.g. /GC gold), the sentiment must be
// flipped based on event type × asset class relationship.
// "drone strike on Iran" = bearish for /ES but bullish for /GC (safe-haven bid).
// ============================================================================

// ── Asset class groupings ────────────────────────────────────────────────────

const ASSET_CLASS_MAP: Record<string, string> = {
  // Equity Index Futures
  "/ES": "equities",
  "/MES": "equities",
  "/NQ": "equities",
  "/MNQ": "equities",
  "/YM": "equities",
  "/MYM": "equities",
  "/RTY": "equities",
  "/M2K": "equities",
  // Safe-Haven
  "/GC": "safe-haven",
  "/MGC": "safe-haven",
  "/SI": "precious",
  "/SIL": "precious",
  // Energy
  "/CL": "energy",
  "/MCL": "energy",
  "/NG": "energy",
  // Bonds
  "/ZB": "bonds",
  "/ZN": "bonds",
  // FX Majors
  "/6E": "fx-major",
  "/6J": "fx-major",
  "/6B": "fx-major",
};

// ── Map classifyEventType() output → flipper category ────────────────────────

type FlipperCategory = "geopolitical" | "monetary" | "economic" | "default";

const EVENT_TYPE_TO_FLIPPER: Record<string, FlipperCategory> = {
  // Monetary policy
  fedDecision: "monetary",
  fomc: "monetary",
  powellSpeak: "monetary",
  // Economic data
  cpiPrint: "economic",
  pcePrint: "economic",
  nfpPrint: "economic",
  gdpPrint: "economic",
  ismPrint: "economic",
  jolts: "economic",
  retailSales: "economic",
  // Credit/liquidity stress → treated as economic conditions
  creditSpreadWidening: "economic",
  yieldCurveSignal: "economic",
  liquidityStress: "economic",
  bankStress: "economic",
  leverageWarning: "economic",
  // Geopolitical
  geopolitical: "geopolitical",
  conflict: "geopolitical",
  tariffs: "geopolitical",
  chinaTrade: "geopolitical",
  governmentShutdown: "geopolitical",
  // Default — earnings, mergers, sector news, commentary, etc.
  earningsHighImpact: "default",
  earningsMidCap: "default",
  merger: "default",
  sectorNews: "default",
  politicalCommentary: "default",
  datacenterHalt: "default",
  majorCrisis: "geopolitical",
  blackSwan: "geopolitical",
  other: "default",
};

// ── Reaction table: how each asset class reacts relative to equity sentiment ─
// 'same'    = same direction as equities
// 'inverse' = opposite direction (bearish equities → bullish this asset)
// null      = no override, pass through equity sentiment as-is

type Reaction = "same" | "inverse" | null;

const EVENT_SENTIMENT_REACTIONS: Record<
  FlipperCategory,
  Record<string, Reaction>
> = {
  geopolitical: {
    equities: "same",
    "safe-haven": "inverse",
    precious: "inverse",
    bonds: "inverse",
    energy: "inverse",
    "fx-major": null,
  },
  monetary: {
    equities: "same",
    "safe-haven": "same",
    precious: "same",
    bonds: "same",
    energy: "same",
    "fx-major": "inverse",
  },
  economic: {
    equities: "same",
    "safe-haven": "inverse",
    precious: "inverse",
    bonds: "inverse",
    energy: "same",
    "fx-major": null,
  },
  default: {
    equities: "same",
    "safe-haven": null,
    precious: null,
    bonds: null,
    energy: null,
    "fx-major": null,
  },
};

// ── Fallback: map classifyRiskType() broad categories when eventType is 'other' ─

const RISK_TYPE_TO_FLIPPER: Record<string, FlipperCategory> = {
  Geopolitical: "geopolitical",
  Macro: "economic", // conservative default; monetary detected via eventType
  Credit: "economic",
  Liquidity: "economic",
  Earnings: "default",
  Technical: "default",
  Commentary: "default",
};

/**
 * Determine the flipper category for a feed item.
 * Uses classifyEventType() (precise, 25 categories) with fallback to risk_type (broad, 7 categories).
 */
export function getFlipperCategory(
  headline: string,
  riskType?: string | null,
): FlipperCategory {
  // Build a minimal ParsedHeadline for classifyEventType
  const parsed = { raw: headline, eventType: riskType ?? "" } as ParsedHeadline;
  const eventType = classifyEventType(parsed);

  // Look up in precise map
  const precise = EVENT_TYPE_TO_FLIPPER[eventType];
  if (precise) return precise;

  // Fallback to broad risk_type
  if (riskType) {
    const broad = RISK_TYPE_TO_FLIPPER[riskType];
    if (broad) return broad;
  }

  return "default";
}

/**
 * Flip equity-centric sentiment for a target instrument based on event category.
 * enforceSentiment() runs BEFORE this — it determines the /ES-centric direction.
 * This function converts that direction for the user's selected instrument.
 */
export function getInstrumentSentiment(
  equitySentiment: "bullish" | "bearish",
  headline: string,
  instrument: string,
  riskType?: string | null,
): "bullish" | "bearish" {
  // Equities pass through unchanged
  const assetClass = ASSET_CLASS_MAP[instrument];
  if (!assetClass || assetClass === "equities") return equitySentiment;

  const category = getFlipperCategory(headline, riskType);
  const reactions = EVENT_SENTIMENT_REACTIONS[category];
  const reaction = reactions[assetClass] ?? null;

  if (reaction === "inverse") {
    return equitySentiment === "bullish" ? "bearish" : "bullish";
  }
  // 'same' or null → pass through
  return equitySentiment;
}

// ============================================================================
// S9-T2: SESSION BASELINE FOR DELTA DISPLAY
// Tracks cumulative session implied points so each headline shows its
// incremental contribution (+X pts) instead of absolute value.
// ============================================================================

let _sessionBaselinePoints = 0;
let _sessionBaselineTs = 0;

export function getSessionBaselinePoints(): number {
  const now = Date.now();
  if (now - _sessionBaselineTs > SESSION_WINDOW_MS) {
    _sessionBaselinePoints = 0;
    _sessionBaselineTs = now;
  }
  return _sessionBaselinePoints;
}

export function addToSessionBaseline(deltaPoints: number): void {
  const now = Date.now();
  if (now - _sessionBaselineTs > SESSION_WINDOW_MS) {
    _sessionBaselinePoints = 0;
    _sessionBaselineTs = now;
  }
  _sessionBaselinePoints += deltaPoints;
}
