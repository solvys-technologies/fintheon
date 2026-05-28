// [claude-code 2026-04-24] S35-T1/T11/T12: Arbitrum barrel.
// Re-exports the helpers consumed by brief-generator.ts (T11 Chamber Read
// injection) and future route/scheduler entrypoints.
//
// [claude-code 2026-05-01] S56 Track A: added seat override + health exports.

export {
  saveVerdict,
  getVerdict,
  getLatest,
  getLatestByTrigger,
  getLatestChamberRead,
  getChamberReadFreshness,
} from "./verdict-store.js";
export {
  ARBITRUM_SEATS,
  invokeMoA,
  getSeatOverrides,
  saveSeatOverrides,
  resetSeatOverrides,
} from "./seats.js";
export { synthesize, type SynthesisResult } from "./facilitator.js";
export { computeGates, type GatesContext } from "./gates.js";
export { seatChat } from "./adapters.js";
export {
  ARBITRUM_RUN_PRESETS,
  buildArbitrumPresetContext,
  normalizeArbitrumRunPresetIds,
  type ArbitrumRunPreset,
} from "./presets.js";
export {
  runChamber,
  type RunChamberOptions,
  type RunChamberResult,
} from "./engine.js";
export { checkAndFire as checkAndFireArbitrumEvent } from "./event-trigger.js";
export type {
  ArbitrumSeatId,
  ArbitrumSeatConfig,
  ArbitrumRunPresetId,
  ArbitrumSeatRound,
  ArbitrumSeatTranscript,
  ArbitrumDeliberateInput,
  ArbitrumDissent,
  ArbitrumGatesSurfaced,
  ArbitrumTriggerType,
  ArbitrumTriggerSource,
  ArbitrumIvSimulation,
  ArbitrumVerdict,
  SeatOverride,
  SeatOverrideRow,
  ArbitrumHealthResponse,
} from "./types.js";
