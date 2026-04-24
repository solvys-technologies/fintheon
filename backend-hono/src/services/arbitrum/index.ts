// [claude-code 2026-04-24] S35-T1/T11/T12: Arbitrum barrel.
// Re-exports the helpers consumed by brief-generator.ts (T11 Chamber Read
// injection) and future route/scheduler entrypoints.

export {
  saveVerdict,
  getVerdict,
  getLatest,
  getLatestByTrigger,
  getLatestChamberRead,
} from "./verdict-store.js";
export { ARBITRUM_SEATS, invokeMoA } from "./seats.js";
export { synthesize, type SynthesisResult } from "./facilitator.js";
export { computeGates, type GatesContext } from "./gates.js";
export { seatChat } from "./adapters.js";
export type {
  ArbitrumSeatId,
  ArbitrumSeatConfig,
  ArbitrumSeatRound,
  ArbitrumSeatTranscript,
  ArbitrumDeliberateInput,
  ArbitrumDissent,
  ArbitrumGatesSurfaced,
  ArbitrumTriggerType,
  ArbitrumTriggerSource,
  ArbitrumIvSimulation,
  ArbitrumVerdict,
} from "./types.js";
