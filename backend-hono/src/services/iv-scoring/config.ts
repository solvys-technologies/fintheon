// [claude-code 2026-04-16] S20-T9: Split from iv-scoring-v2.ts — config, event weights
// [claude-code 2026-04-16] Taxonomy loader extracted to taxonomy.ts
// [claude-code 2026-03-24] Added continuousVIXMultiplier() piecewise curve, finer EVENT_WEIGHTS with half-point granularity
// [claude-code 2026-03-11] IV Scoring V3: Added volatility taxonomy, regime-aware decay, new event types
// [claude-code 2026-03-09] Added config-driven scoring: IVScoringConfig type, loadIVScoringConfig(), config param on calculateIVScoreV2

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

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

// ============================================================================
// VIX MULTIPLIERS
// ============================================================================

export const VIX_MULTIPLIERS: {
  max: number;
  multiplier: number;
  context: string;
}[] = [
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

// ============================================================================
// TIME DECAY HALF-LIVES
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

export function loadIVScoringConfig(): IVScoringConfig {
  if (_loadedConfig) return _loadedConfig;

  try {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const configPath = resolve(
      __dirname,
      "../../config/iv-scoring-config.json",
    );
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

export function resetIVScoringConfig(): void {
  _loadedConfig = null;
}

export function getIVScoringConfig(): IVScoringConfig {
  return _loadedConfig ?? loadIVScoringConfig();
}
