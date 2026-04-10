// [claude-code 2026-03-11] Volatility taxonomy types for IV Scoring V3
// Multi-dimensional event profiling: velocity, persistence, breadth, transmission, reflexivity

export type PersistenceClass =
  | "minutes"
  | "hours"
  | "days"
  | "weeks"
  | "months";
export type TransmissionChannel =
  | "rates"
  | "credit"
  | "fx"
  | "commodities"
  | "equities"
  | "vol";
export type VixRegime = "low" | "normal" | "elevated" | "crisis";

/**
 * Multi-dimensional volatility profile for an event type.
 * Replaces flat EVENT_WEIGHTS with richer scoring dimensions.
 */
export interface VolatilityProfile {
  /** How fast does this move markets? 1=slow-burn over weeks, 5=instantaneous */
  velocity: 1 | 2 | 3 | 4 | 5;
  /** How long do the primary effects last? */
  persistence: PersistenceClass;
  /** How many instruments/sectors are affected? 1=single name, 5=all markets */
  breadth: 1 | 2 | 3 | 4 | 5;
  /** Through what channels does the risk propagate? */
  transmissionChannels: TransmissionChannel[];
  /** Does the market reaction amplify the risk? 0=no reflexivity, 1=high (margin calls → selling → more margin calls) */
  reflexivity: number;
  /** Base weight (0-10), replaces flat EVENT_WEIGHTS value */
  baseWeight: number;
  /** Base decay half-life in minutes */
  decayBaseMinutes: number;
  /** Regime-dependent decay multipliers — events persist longer in crisis */
  decayRegimeMultipliers: Record<VixRegime, number>;
  /** Per-event instrument beta overrides — tariffs hit /CL harder than /ES */
  instrumentOverrides?: Record<string, number>;
  /** Human-readable description */
  description?: string;
}

/**
 * Full volatility taxonomy: map of event type → profile
 */
export interface VolatilityTaxonomy {
  _version: string;
  _note?: string;
  profiles: Record<string, VolatilityProfile>;
}

/**
 * VIX regime classification thresholds
 */
export const VIX_REGIME_THRESHOLDS: Record<
  VixRegime,
  { min: number; max: number }
> = {
  low: { min: 0, max: 15 },
  normal: { min: 15, max: 20 },
  elevated: { min: 20, max: 30 },
  crisis: { min: 30, max: Infinity },
};

/**
 * Classify current VIX level into a regime
 */
export function classifyVixRegime(vixLevel: number): VixRegime {
  if (vixLevel < 15) return "low";
  if (vixLevel < 20) return "normal";
  if (vixLevel < 30) return "elevated";
  return "crisis";
}

// ── Causal Chain Types ─────────────────────────────────────────────────────────

export interface CausalLink {
  /** Cause event type */
  from: string;
  /** Effect event type */
  to: string;
  /** Minimum lag before effect manifests (minutes) */
  lagMinMinutes: number;
  /** Maximum lag before effect manifests (minutes) */
  lagMaxMinutes: number;
  /** Probability that cause leads to effect (0-1) */
  probability: number;
  /** How much of the cause's score propagates (0-1) */
  scoreTransmission: number;
  /** Human-readable description */
  description: string;
}

export interface CausalChain {
  id: string;
  name: string;
  description: string;
  links: CausalLink[];
  /** Total estimated timeline description */
  totalTimelineDescription: string;
  /** Which instrument classes are most affected */
  affectedInstrumentClasses: string[];
}

export interface CausalChainsConfig {
  _version: string;
  chains: CausalChain[];
}

// ── Active Chain State (runtime) ───────────────────────────────────────────────

export interface ActiveChainInstance {
  chainId: string;
  chainName: string;
  /** The event that triggered this chain */
  triggerEventType: string;
  triggerTimestamp: string; // ISO
  /** Which link index we're currently at (0 = just triggered) */
  currentLinkIndex: number;
  /** Cumulative probability so far (product of all link probabilities) */
  cumulativeProbability: number;
  /** Cumulative score impact */
  cumulativeScoreImpact: number;
  /** When the next effect window opens/closes */
  nextEffectWindow?: {
    effectType: string;
    opensAt: string; // ISO
    closesAt: string; // ISO
    probability: number;
    scoreTransmission: number;
  };
  /** Whether this chain has been fully evaluated (all links past) */
  exhausted: boolean;
  createdAt: string; // ISO
}

// ── Historical Rhyming Types ───────────────────────────────────────────────────

export interface CrisisPrecondition {
  /** Indicator name (e.g. 'vix_level', 'hy_oas_spread', 'yield_curve_2s10s') */
  indicator: string;
  /** Condition to check */
  condition:
    | "above"
    | "below"
    | "between"
    | "inverted"
    | "widening"
    | "narrowing"
    | "complacent";
  /** Threshold value(s) */
  threshold: number | [number, number];
  /** Weight in matching (0-1) */
  weight: number;
  /** Human-readable description */
  description: string;
  /** Source: 'fred', 'vix', 'headline' */
  source: "fred" | "vix" | "headline";
}

export interface CrisisPhase {
  name: string;
  /** Days from crisis start */
  dayRange: [number, number];
  description: string;
  keyIndicators: string[];
}

export interface HistoricalCrisis {
  id: string;
  name: string;
  year: number;
  summary: string;
  /** How long the crisis took to fully unfold (days) */
  unfoldingDays: number;
  /** Peak-to-trough drawdown */
  maxDrawdown: number;
  /** Peak VIX during the crisis */
  peakVix: number;
  /** Preconditions that were present before the crisis */
  preconditions: CrisisPrecondition[];
  /** Key phases with timing */
  phases: CrisisPhase[];
  /** Most affected asset classes */
  affectedAssets: string[];
  /** Trading lessons / what to watch for */
  tradingLessons: string[];
}

export interface HistoricalCrisesConfig {
  _version: string;
  crises: HistoricalCrisis[];
}

// ── Rhyme Match Result ─────────────────────────────────────────────────────────

export interface RhymeMatch {
  crisisId: string;
  crisisName: string;
  crisisYear: number;
  /** How closely current conditions match (0-1) */
  matchScore: number;
  /** Per-precondition match details */
  matchedPreconditions: {
    indicator: string;
    currentValue: number | string | null;
    historicalCondition: string;
    matched: boolean;
    weight: number;
    description: string;
  }[];
  totalPreconditions: number;
  matchedCount: number;
  /** How this crisis unfolded */
  unfoldingTimeline: string;
  maxDrawdown: number;
  peakVix: number;
  /** What to watch for based on this historical parallel */
  tradingGuidance: string[];
}

// ── Systemic Risk Assessment ───────────────────────────────────────────────────

export interface SystemicRiskAssessment {
  /** Overall systemic risk level (0-10) */
  systemicScore: number;
  /** Active causal chains */
  activeChains: ActiveChainInstance[];
  /** Historical rhyme matches above threshold */
  rhymeMatches: RhymeMatch[];
  /** Credit risk signals detected in last 48h */
  creditSignalCount: number;
  /** Score overlay to add to IV scoring (0-2.5) */
  ivScoreOverlay: number;
  /** Rationale lines for the IV score card */
  rationale: string[];
  /** Generated RiskFlow alerts */
  generatedAlerts: SystemicRiskAlert[];
  timestamp: string;
}

export interface SystemicRiskAlert {
  type: "causal-chain" | "historical-rhyme" | "credit-warning" | "contagion";
  severity: "low" | "medium" | "high" | "critical";
  headline: string;
  summary: string;
  historicalContext?: string;
  timeline?: string;
  affectedInstruments: string[];
  tags: string[];
}

// ── FRED Macro Indicators ──────────────────────────────────────────────────────

export interface MacroIndicators {
  /** ICE BofA US High Yield OAS (credit spread proxy) */
  hyOasSpread?: number;
  /** 10Y-2Y Treasury spread (yield curve) */
  yieldCurve2s10s?: number;
  /** 10Y-3M Treasury spread (recession predictor) */
  yieldCurve3m10y?: number;
  /** TED Spread (interbank stress) */
  tedSpread?: number;
  /** Fed Funds Rate */
  fedFundsRate?: number;
  /** Current VIX level */
  vixLevel?: number;
  /** VIX 30-day average */
  vixAvg30d?: number;
  /** Headline-derived signals */
  headlineSignals: HeadlineSignal[];
  /** Timestamp of last FRED fetch */
  fredFetchedAt?: string;
}

export interface HeadlineSignal {
  type: string;
  detectedAt: string;
  headline: string;
  strength: "weak" | "moderate" | "strong";
}

// ── Systemic Risk Config ───────────────────────────────────────────────────────

export interface SystemicRiskConfig {
  /** Feature flags */
  enabled: boolean;
  causalChainsEnabled: boolean;
  historicalRhymingEnabled: boolean;
  fredEnabled: boolean;
  /** Overlay weight on IV score (0-1, where 0.25 = up to +2.5 pts) */
  overlayWeight: number;
  /** Rhyme match thresholds */
  rhymeHighThreshold: number;
  rhymeCriticalThreshold: number;
  /** Credit signal accumulation window (hours) */
  creditWindowHours: number;
  /** Min credit signals for alert */
  creditMinSignals: number;
  /** FRED polling interval (ms) */
  fredPollIntervalMs: number;
  /** Systemic assessment polling interval (ms) */
  assessmentPollIntervalMs: number;
  /** FRED API key (optional, higher rate limits) */
  fredApiKey?: string;
}
