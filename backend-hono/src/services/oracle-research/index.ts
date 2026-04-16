// [claude-code 2026-04-16] S20-T3: Oracle research — public API

export { scanPredictionMarkets } from "./scanner.js";
export { detectArbOpportunities } from "./arb-detector.js";
export type {
  OracleResearchFinding,
  ScannedContract,
  FindingType,
  Platform,
  FindingStatus,
} from "./types.js";
export { ORACLE_SUBJECTS } from "./types.js";
