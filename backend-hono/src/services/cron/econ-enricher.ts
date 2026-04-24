// [claude-code 2026-04-24 S35-T7] Re-export shim — lets boot/services.ts:13 keep importing
// startEconEnricher / stopEconEnricher until T12 unification rewires the import.
// T12 deletes this file.
export {
  startRiskFlowEconEnricher as startEconEnricher,
  stopRiskFlowEconEnricher as stopEconEnricher,
} from "./riskflow-econ-enricher.js";
