// [claude-code 2026-04-16] S20-T9: iv-scoring barrel — re-exports all modules from the former iv-scoring-v2.ts

// Config, constants, taxonomy
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
  loadVolatilityTaxonomy,
  getVolatilityProfile,
  resetVolatilityTaxonomy,
} from "./config.js";

// Computation: session, VIX, decay, stacking, scoring
export {
  type VIXState,
  type ActivityLevel,
  type StackedEvent,
  type EdgeCaseResult,
  type IVScoreInputV2,
  type IVScoreResultV2,
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
  calculateIVScoreV2,
} from "./computation.js";

// Instrument betas, implied points
export {
  type ImpliedPoints,
  INSTRUMENT_BETAS,
  calculateImpliedPoints,
  getInstrumentConfig,
  getSupportedInstruments,
} from "./instrument.js";

// Event classification, sentiment, martingale, instrument flipper
export {
  classifyEventType,
  isEscalation,
  getMartingaleMultiplier,
  enforceSentiment,
  getFlipperCategory,
  getInstrumentSentiment,
  getSessionBaselinePoints,
  addToSessionBaseline,
} from "./systemic.js";
