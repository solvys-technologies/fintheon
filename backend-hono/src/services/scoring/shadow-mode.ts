// [claude-code 2026-04-19] S24-T3: Shadow-mode tracking for agent proposals.
// Agents in shadow mode log what they would have proposed *before* any real proposal
// lands. When the equivalent real decision arrives, resolveShadowDecision compares the
// two and sets agreed=true/false. T4 surfaces agreement rate; auto-apply graduation
// requires >0.85 over 30d AND super admin confirmation.

import { getSupabaseClient } from "../../config/supabase.js";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("ShadowMode");

export type ShadowDecisionType =
  | "regime_proposal"
  | "lexicon_addition"
  | "walk_back";

export const SHADOW_DECISION_TYPES: ShadowDecisionType[] = [
  "regime_proposal",
  "lexicon_addition",
  "walk_back",
];

export interface ShadowDecisionRecord {
  id: string;
  decisionType: ShadowDecisionType;
  wouldPropose: Record<string, unknown>;
  actualDecision: Record<string, unknown> | null;
  actualDecidedBy: string | null;
  agreed: boolean | null;
  createdAt: string;
  resolvedAt: string | null;
}

const ROLLING_WINDOW_DAYS = 30;
const AUTO_APPLY_AGREEMENT_THRESHOLD = 0.85;

export async function logShadowDecision(
  decisionType: ShadowDecisionType,
  wouldPropose: Record<string, unknown>,
): Promise<string | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;

  const { data, error } = await sb
    .from("agent_shadow_decisions")
    .insert({
      decision_type: decisionType,
      would_propose: wouldPropose,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "42P01") return null; // table missing — silent during T1 transition
    log.warn("Failed to log shadow decision", {
      decisionType,
      error: error.message,
    });
    return null;
  }
  return (data?.id as string | undefined) ?? null;
}

export async function resolveShadowDecision(
  decisionType: ShadowDecisionType,
  actualDecision: Record<string, unknown>,
  actualDecidedBy: string,
): Promise<{ matched: number }> {
  const sb = getSupabaseClient();
  if (!sb) return { matched: 0 };

  // Pull all unresolved decisions of this type from the last 24h — the agent proposed
  // before the human acted, and the time gap should be small.
  const cutoff = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { data, error } = await sb
    .from("agent_shadow_decisions")
    .select("id, would_propose")
    .eq("decision_type", decisionType)
    .is("resolved_at", null)
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    if (error.code === "42P01") return { matched: 0 };
    log.warn("Failed to fetch unresolved shadow decisions", {
      error: error.message,
    });
    return { matched: 0 };
  }

  if (!data || data.length === 0) return { matched: 0 };

  let matched = 0;
  const nowIso = new Date().toISOString();
  for (const row of data) {
    const wouldPropose = row.would_propose as Record<string, unknown>;
    const agreed = compareProposals(decisionType, wouldPropose, actualDecision);

    const { error: updateError } = await sb
      .from("agent_shadow_decisions")
      .update({
        actual_decision: actualDecision,
        actual_decided_by: actualDecidedBy,
        agreed,
        resolved_at: nowIso,
      })
      .eq("id", row.id);

    if (updateError) {
      log.warn("Failed to resolve shadow decision", {
        id: row.id,
        error: updateError.message,
      });
      continue;
    }
    matched++;
  }
  return { matched };
}

/** Semantic equality across decision types. */
function compareProposals(
  decisionType: ShadowDecisionType,
  would: Record<string, unknown>,
  actual: Record<string, unknown>,
): boolean {
  if (decisionType === "regime_proposal") {
    return (
      String(would.proposedRegime ?? "").toUpperCase() ===
      String(actual.proposedRegime ?? actual.regime ?? "").toUpperCase()
    );
  }
  if (decisionType === "lexicon_addition") {
    const wouldKw = String(would.keyword ?? "")
      .toLowerCase()
      .trim();
    const actualKw = String(actual.keyword ?? "")
      .toLowerCase()
      .trim();
    return wouldKw.length > 0 && wouldKw === actualKw;
  }
  if (decisionType === "walk_back") {
    return (
      String(would.targetEvent ?? would.headlineId ?? "") ===
      String(actual.targetEvent ?? actual.headlineId ?? "")
    );
  }
  return false;
}

export interface ShadowStatsByType {
  agreed: number;
  total: number;
  rate: number | null;
  canAutoApply: boolean;
}

export type ShadowStats = Record<ShadowDecisionType, ShadowStatsByType>;

export async function getShadowStats(): Promise<ShadowStats> {
  const empty: ShadowStats = {
    regime_proposal: emptyStat(),
    lexicon_addition: emptyStat(),
    walk_back: emptyStat(),
  };

  const sb = getSupabaseClient();
  if (!sb) return empty;

  const cutoff = new Date(
    Date.now() - ROLLING_WINDOW_DAYS * 24 * 3600_000,
  ).toISOString();

  const { data, error } = await sb
    .from("agent_shadow_decisions")
    .select("decision_type, agreed")
    .gte("created_at", cutoff)
    .not("agreed", "is", null);

  if (error) {
    if (error.code === "42P01") return empty;
    log.warn("Failed to fetch shadow stats", { error: error.message });
    return empty;
  }

  for (const row of data ?? []) {
    const t = row.decision_type as ShadowDecisionType;
    if (!empty[t]) continue;
    empty[t].total++;
    if (row.agreed === true) empty[t].agreed++;
  }

  for (const t of SHADOW_DECISION_TYPES) {
    const s = empty[t];
    s.rate = s.total > 0 ? Number((s.agreed / s.total).toFixed(3)) : null;
    s.canAutoApply =
      s.rate !== null &&
      s.rate >= AUTO_APPLY_AGREEMENT_THRESHOLD &&
      s.total >= 20;
  }
  return empty;
}

function emptyStat(): ShadowStatsByType {
  return { agreed: 0, total: 0, rate: null, canAutoApply: false };
}
