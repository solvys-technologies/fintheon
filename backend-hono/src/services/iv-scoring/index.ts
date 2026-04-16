// [claude-code 2026-04-16] S20-T9: iv-scoring barrel — re-exports all modules from the former iv-scoring-v2.ts
// [claude-code 2026-04-16] Added taxonomy.ts, ticker.ts, sentiment.ts barrel exports

// Config, constants
export {
  type IVScoringConfig,
  type SessionInfo,
  EVENT_WEIGHTS,
  SESSIONS,
  VIX_MULTIPLIERS,
  DECAY_HALF_LIVES,
  INSTANT_TRIGGERS,
  loadIVScoringConfig,
  resetIVScoringConfig,
  getIVScoringConfig,
} from "./config.js";

// Volatility taxonomy
export {
  loadVolatilityTaxonomy,
  getVolatilityProfile,
  resetVolatilityTaxonomy,
} from "./taxonomy.js";

// Computation: session, VIX, decay, stacking, edge cases
export {
  type VIXState,
  type ActivityLevel,
  type StackedEvent,
  type EdgeCaseResult,
  getCurrentSession,
  getVIXMultiplier,
  continuousVIXMultiplier,
  calculateVIXSpikeAdjustment,
  getNoEventBaseline,
  calculateDecayedScore,
  calculateDecayedScoreV3,
  getEventWeight,
  getInstrumentAdjustedWeight,
  getActivityBaseline,
  calculateStackedScore,
  isInstantTrigger,
  checkEdgeCases,
  calculateSpillover,
} from "./computation.js";

// Main scoring function
export {
  type IVScoreInputV2,
  type IVScoreResultV2,
  calculateIVScoreV2,
} from "./ticker.js";

// Instrument betas, implied points
export {
  type ImpliedPoints,
  INSTRUMENT_BETAS,
  calculateImpliedPoints,
  getInstrumentConfig,
  getSupportedInstruments,
} from "./instrument.js";

// Event classification, martingale
export {
  classifyEventType,
  isEscalation,
  getMartingaleMultiplier,
} from "./systemic.js";

// Sentiment enforcement, instrument flipper, session baseline
export {
  enforceSentiment,
  getFlipperCategory,
  getInstrumentSentiment,
  getSessionBaselinePoints,
  addToSessionBaseline,
} from "./sentiment.js";
