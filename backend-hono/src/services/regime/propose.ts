// [claude-code 2026-04-19] S24-T1: regime proposal helper — MDB + any agent calls this instead of setRegime().
/**
 * proposeRegimeChange — the one function agents call to request a regime flip.
 *
 * Behavior:
 *   - Always inserts a regime_proposals row (status=pending).
 *   - If no manual lock is active on market_regimes, the proposal is eligible for
 *     auto-apply in a future wave; for now it stays pending until TP approves.
 *   - Fires an emitPushAndLog to TP with category=regimeProposals. Severity defaults
 *     to "high" (respects quiet hours); callers can pass "critical" for L10 matrix
 *     flips to bypass quiet hours.
 *
 * This function is the V4 guard against the 2026-04-17 incident where the MDB
 * agent silently called setRegime() 10h after TP had manually overridden the
 * regime. V4 never writes market_regimes directly from agents — it proposes.
 */

import { createLogger } from "../../lib/logger.js";
import { sql, isDatabaseAvailable } from "../../config/database.js";
import { emitPushAndLog } from "../notifications/emit.js";
import type { Severity } from "../web-push-sender.js";
import { getCurrentRegime } from "./regime-service.js";

const log = createLogger("RegimePropose");

export interface RegimeProposalEvidence {
  headlines?: string[];
  chartUrl?: string;
  xSentimentSnippet?: string;
  mdbExcerpt?: string;
  [key: string]: unknown;
}

export interface ProposeRegimeInput {
  proposedBy: string;
  proposedRegime: string;
  reason: string;
  evidence?: RegimeProposalEvidence;
  /** Target TP user id. Fallback: broadcast to every user subscribed to regimeProposals. */
  notifyUserId?: string | "all";
  /** Override push severity. Defaults to "high". Use "critical" for L10 matrix flips. */
  severity?: Severity;
}

export interface ProposeRegimeResult {
  id: string | null;
  status: "created" | "skipped-duplicate" | "db-unavailable";
  lockedUntil: string | null;
  pushed: number;
}

/**
 * Plain-language labels for lock-screen pushes per TP. Avoids dumping
 * "GEO_TENSIONS → BULL_TREND" on the notification center.
 */
const REGIME_PLAIN: Record<string, string> = {
  BULL_TREND: "Bull Market",
  BEAR_TREND: "Bear Market",
  CONSOLIDATION: "Consolidation",
  GEO_TENSIONS: "Geopol",
  MACRO_ECON: "Macro",
  RISK_OFF: "Risk Off",
  EARNINGS_SEASON: "Earnings Season",
  ILLIQUID_STUPIDITY: "Illiquid Chop",
};
function plainRegime(code: string | null | undefined): string {
  if (!code) return "Unknown";
  return REGIME_PLAIN[code] ?? code;
}

/**
 * Insert a regime proposal and fire a push. Idempotent within a 30min window
 * on the same (proposedRegime, proposedBy, current_regime) triple so repeat
 * agent calls don't spam TP.
 */
export async function proposeRegimeChange(
  input: ProposeRegimeInput,
): Promise<ProposeRegimeResult> {
  if (!isDatabaseAvailable()) {
    log.warn("DB unavailable — skipping regime proposal", {
      proposedRegime: input.proposedRegime,
    });
    return {
      id: null,
      status: "db-unavailable",
      lockedUntil: null,
      pushed: 0,
    };
  }

  const currentState = await getCurrentRegime().catch(() => null);
  const currentRegime = currentState?.regime ?? null;

  // Dedup: recent identical pending proposal from the same proposer in the last 30 min.
  const dedup = await sql`
    SELECT id FROM regime_proposals
    WHERE proposed_regime = ${input.proposedRegime}
      AND proposed_by = ${input.proposedBy}
      AND status = 'pending'
      AND created_at > now() - interval '30 minutes'
    LIMIT 1
  `;
  if (dedup.length > 0) {
    log.info("Skipping duplicate regime proposal", {
      existingId: dedup[0].id,
      proposedRegime: input.proposedRegime,
      proposedBy: input.proposedBy,
    });
    return {
      id: dedup[0].id as string,
      status: "skipped-duplicate",
      lockedUntil: null,
      pushed: 0,
    };
  }

  // Read current lock state so push body can say "your override still holds".
  const lockRows = await sql`
    SELECT locked_by, locked_until
    FROM market_regimes
    WHERE active = TRUE
    ORDER BY created_at DESC
    LIMIT 1
  `;
  const lockedUntilRaw = lockRows[0]?.locked_until ?? null;
  const lockedUntil = lockedUntilRaw
    ? new Date(lockedUntilRaw).toISOString()
    : null;
  const lockActive = lockedUntil
    ? new Date(lockedUntil).getTime() > Date.now()
    : false;

  const inserted = await sql`
    INSERT INTO regime_proposals (proposed_regime, current_regime, reason, evidence, proposed_by, status)
    VALUES (
      ${input.proposedRegime},
      ${currentRegime},
      ${input.reason},
      ${JSON.stringify(input.evidence ?? {})}::jsonb,
      ${input.proposedBy},
      'pending'
    )
    RETURNING id
  `;
  const proposalId = inserted[0]?.id as string | undefined;
  if (!proposalId) {
    log.warn("Regime proposal insert returned no id", {
      proposedRegime: input.proposedRegime,
    });
    return {
      id: null,
      status: "db-unavailable",
      lockedUntil,
      pushed: 0,
    };
  }

  // Fire push. Defaults to "high" severity (respects quiet hours). Caller can
  // pass "critical" for L10 matrix flips to bypass quiet hours.
  const severity: Severity = input.severity ?? "high";
  const lockSuffix = lockActive ? " (override active)" : "";

  // [claude-code 2026-04-19] Plain-language title + body per TP. Lock-screen reads
  //   title:  Regime Change
  //   body:   Geopol → Bear Market
  // instead of "Regime proposal: BULL_TREND" (technical tag). Preview stays tight.
  const pushResult = await emitPushAndLog({
    userId: input.notifyUserId ?? "all",
    category: "regimeProposals",
    severity,
    title: "Regime Change",
    body: `${plainRegime(currentRegime)} → ${plainRegime(input.proposedRegime)}${lockSuffix}`,
    url: `/admin/approvals/${proposalId}`,
    fingerprint: `regime-proposal:${input.proposedRegime}:${input.proposedBy}:${new Date().toISOString().slice(0, 13)}`,
    eventId: proposalId,
    metadata: {
      proposalId,
      proposedRegime: input.proposedRegime,
      currentRegime,
      proposedBy: input.proposedBy,
      lockActive,
    },
  }).catch((err) => {
    log.warn("Regime proposal push failed (non-fatal)", {
      proposalId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  });

  log.info("Regime proposal created", {
    proposalId,
    proposedRegime: input.proposedRegime,
    proposedBy: input.proposedBy,
    currentRegime,
    lockActive,
    pushed: pushResult?.pushed ?? 0,
  });

  return {
    id: proposalId,
    status: "created",
    lockedUntil,
    pushed: pushResult?.pushed ?? 0,
  };
}
