// [claude-code 2026-05-06] S60-T5: Policy gate for autonomous action execution decisions

import { createLogger } from "../../../lib/logger.js";

const log = createLogger("PolicyGate");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PolicyAction = "notify" | "update" | "fix_proposal" | "deploy";

export interface PolicyContext {
  severity?: "low" | "medium" | "high" | "critical";
  confidence?: number; // 0-1
  signalCount?: number;
  isBusinessHours?: boolean;
  requiresDeploy?: boolean;
}

export interface PolicyDecision {
  allowed: boolean;
  reason?: string;
  action?: PolicyAction;
  escalated?: boolean;
}

// ---------------------------------------------------------------------------
// Severity thresholds for fix_proposal auto-approval
// ---------------------------------------------------------------------------

const FIX_PROPOSAL_SEVERITY_THRESHOLD: Record<string, number> = {
  low: 0.7,
  medium: 0.8,
  high: 0.9,
  critical: 0.95,
};

const FIX_PROPOSAL_CONFIDENCE_MIN = 0.6;

// ---------------------------------------------------------------------------
// Gate evaluation
// ---------------------------------------------------------------------------

export function evaluatePolicy(
  action: PolicyAction,
  context: PolicyContext,
  verificationPassed?: boolean,
): PolicyDecision {
  // notify and update are always permitted
  if (action === "notify" || action === "update") {
    return { allowed: true, action };
  }

  // fix_proposal — permitted if under severity/confidence threshold
  if (action === "fix_proposal") {
    const severity = context.severity ?? "low";
    const threshold = FIX_PROPOSAL_SEVERITY_THRESHOLD[severity] ?? 0.8;
    const confidence = context.confidence ?? 0;

    if (confidence < FIX_PROPOSAL_CONFIDENCE_MIN) {
      log.info("policy gate: fix_proposal blocked — insufficient confidence", {
        confidence,
        threshold: FIX_PROPOSAL_CONFIDENCE_MIN,
      });
      return {
        allowed: false,
        action: "notify",
        reason: `Fix proposal blocked — confidence ${confidence} below minimum ${FIX_PROPOSAL_CONFIDENCE_MIN}`,
        escalated: true,
      };
    }

    if (confidence < threshold) {
      // Allowed but escalated — propose as notify with flag rather than direct fix
      log.info("policy gate: fix_proposal below severity threshold", {
        severity,
        confidence,
        threshold,
      });
      return { allowed: true, action: "fix_proposal" };
    }

    return { allowed: true, action: "fix_proposal" };
  }

  // deploy — must pass verification gate
  if (action === "deploy") {
    if (!verificationPassed) {
      log.warn("policy gate: deploy blocked — verification not passed");
      return {
        allowed: false,
        action: "notify",
        reason: "Deploy blocked — verification gate did not pass",
        escalated: true,
      };
    }

    if (!context.requiresDeploy) {
      return {
        allowed: false,
        action: "notify",
        reason: "Deploy blocked — action does not require deployment",
      };
    }

    log.info("policy gate: deploy approved via verification");
    return { allowed: true, action: "deploy" };
  }

  return { allowed: false, reason: `Unknown action: ${action}` };
}
