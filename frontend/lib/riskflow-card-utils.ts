// [claude-code 2026-04-19] RiskFlow card polish: shared helpers used by every desktop
//   RiskFlow card to map severity to the fuse-palette key and to derive a 0-10 fuse fill
//   from either an explicit IV score or a severity bucket. Centralizing avoids drift across
//   AlertCardBase, AlertRow, TradeIdeaRow and SanctumRiskAssessment.
import type { RiskFlowAlert } from "./riskflow-feed";
import type { FuseSeverity } from "./fuse-palette";

export function alertSeverityToPalette(
  sev: RiskFlowAlert["severity"],
): FuseSeverity {
  if (sev === "critical") return "critical";
  if (sev === "high") return "high";
  if (sev === "medium") return "medium";
  if (sev === "low") return "low";
  return "neutral";
}

const SEVERITY_FALLBACK_SCORE: Record<RiskFlowAlert["severity"], number> = {
  critical: 9,
  high: 7,
  medium: 5,
  low: 3,
};

/** Resolve a 0-10 score for the fuse fill: prefer the alert's IV score, else map from severity. */
export function fuseScoreFromAlert(alert: RiskFlowAlert): number {
  if (alert.ivScore != null) return Number(alert.ivScore);
  return SEVERITY_FALLBACK_SCORE[alert.severity] ?? 1;
}
