// [claude-code 2026-04-19] Routines Console — static registry of the 8 Claude Code Routines
// Source of truth: docs/routines.md. Mutable state lives in routine_config / routine_runs.

export type RoutineKind = "MOVE" | "AUGMENT";

export interface RoutineDefinition {
  triggerId: string;
  name: string;
  kind: RoutineKind;
  schedule: string; // cron (UTC)
  runsPerDay: number;
  description: string;
  backendFlag?: string; // env flag that disables the matching local scheduler
  replaces?: string; // human-readable description of replaced backend service
}

export const ROUTINES: readonly RoutineDefinition[] = [
  {
    triggerId: "trig_01ND9msD2oyniTwgYMtqBMQB",
    name: "REFLECT Nightly Quality Analysis",
    kind: "MOVE",
    schedule: "3 4 * * *",
    runsPerDay: 1,
    description:
      "Analyzes 7 days of scoring observations across 5 metrics and writes reflect_reports.",
    backendFlag: "REFLECT_VIA_ROUTINE",
    replaces: "startReflectScheduler()",
  },
  {
    triggerId: "trig_01QxEtsTB7exE9hZpmdEni3S",
    name: "Prediction Resolver",
    kind: "MOVE",
    schedule: "17 3,9,15,21 * * *",
    runsPerDay: 4,
    description:
      "Resolves Polymarket predictions where YES >= 0.95 or <= 0.05.",
    backendFlag: "PREDICTION_RESOLVER_VIA_ROUTINE",
    replaces: "startPredictionResolver()",
  },
  {
    triggerId: "trig_01UmqPKoqYmUQjHpZygWa4yg",
    name: "Market Impact Enricher",
    kind: "MOVE",
    schedule: "3 22 * * 1-5",
    runsPerDay: 1,
    description:
      "Enriches HIGH/CRITICAL scored items >24h old with /NQ /ES /YM daily-close impact.",
    backendFlag: "MARKET_IMPACT_VIA_ROUTINE",
    replaces: "startMarketImpactEnricher()",
  },
  {
    triggerId: "trig_01TbyLqsb3MEFXngNcf9DGqA",
    name: "Dispatch Watchdog",
    kind: "AUGMENT",
    schedule: "3 11 * * 1-5",
    runsPerDay: 1,
    description:
      "Verifies the morning daily brief was generated; regenerates if missing.",
  },
  {
    triggerId: "trig_012vcEGvYY4cdHSK2yMKp2wk",
    name: "Boardroom Synthesis",
    kind: "AUGMENT",
    schedule: "3 14 * * 1-5",
    runsPerDay: 1,
    description:
      "Synthesizes the 5 standup-round outputs into a regime/themes/action-items digest.",
  },
  {
    triggerId: "trig_01UkDCRytVP42cd7C6tUzon1",
    name: "MiroShark Meta",
    kind: "AUGMENT",
    schedule: "17 15 * * 1-5",
    runsPerDay: 1,
    description:
      "Daily MiroShark health check — stale predictions, convergence risk, drift, outliers.",
  },
  {
    triggerId: "trig_01LBtc1yHL8gEv4ofh4UP2eH",
    name: "Poly/Kalshi Divergence Analysis",
    kind: "AUGMENT",
    schedule: "17 13,21 * * *",
    runsPerDay: 2,
    description:
      "Deep-dive on persistent prediction-market divergences (>= 10%).",
  },
  {
    triggerId: "trig_01MgCTN6ALWt4Jr4eZkqimWi",
    name: "Aquarium Deep Outlook",
    kind: "AUGMENT",
    schedule: "33 12,20 * * *",
    runsPerDay: 2,
    description:
      "Full Context Bank synthesis + calibration preview → desk_reports (aquarium-deep).",
  },
] as const;

export function getRoutine(triggerId: string): RoutineDefinition | undefined {
  return ROUTINES.find((r) => r.triggerId === triggerId);
}

export function listRoutines(): readonly RoutineDefinition[] {
  return ROUTINES;
}
