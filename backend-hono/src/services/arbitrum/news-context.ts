// [claude-code 2026-04-26] S35-T13: Past-30-day RiskFlow context loader for
// Arbitrum chamber runs. Pulls top-scored news items + recent narrative
// threads + last few chamber verdicts so seats reason against the full
// landscape, not just the single triggering catalyst.
//
// Token discipline:
//   - Top ~80 RiskFlow items by IV score (last 30d)
//   - Last ~10 Arbitrum verdicts (their consensus + dissent line)
//   - Compact format — date | iv | speaker/source | headline (≤120 chars)

import { createLogger } from "../../lib/logger.js";
import { getSupabaseClient } from "../../config/supabase.js";

const log = createLogger("ArbitrumNewsContext");

const DEFAULT_LOOKBACK_DAYS = 30;
const DEFAULT_RISKFLOW_LIMIT = 80;
const DEFAULT_VERDICT_LIMIT = 10;

export interface ArbitrumNewsContext {
  windowDays: number;
  riskflow: ArbitrumNewsLine[];
  verdicts: ArbitrumVerdictLine[];
}

export interface ArbitrumNewsLine {
  date: string | null;
  iv: number | null;
  speaker: string | null;
  source: string | null;
  headline: string;
}

export interface ArbitrumVerdictLine {
  date: string | null;
  category: string | null;
  question: string;
  consensus: number | null;
  confidence: number | null;
  dissent: string | null;
}

export async function loadArbitrumNewsContext(opts?: {
  lookbackDays?: number;
  riskflowLimit?: number;
  verdictLimit?: number;
}): Promise<ArbitrumNewsContext | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;

  const windowDays = opts?.lookbackDays ?? DEFAULT_LOOKBACK_DAYS;
  const riskflowLimit = opts?.riskflowLimit ?? DEFAULT_RISKFLOW_LIMIT;
  const verdictLimit = opts?.verdictLimit ?? DEFAULT_VERDICT_LIMIT;

  const since = new Date(
    Date.now() - windowDays * 24 * 60 * 60 * 1000,
  ).toISOString();

  const [riskflow, verdicts] = await Promise.all([
    loadRiskFlow(sb, since, riskflowLimit),
    loadVerdicts(sb, since, verdictLimit),
  ]);

  if (riskflow.length === 0 && verdicts.length === 0) return null;
  return { windowDays, riskflow, verdicts };
}

async function loadRiskFlow(
  sb: ReturnType<typeof getSupabaseClient>,
  since: string,
  limit: number,
): Promise<ArbitrumNewsLine[]> {
  if (!sb) return [];
  const { data, error } = await sb
    .from("scored_riskflow_items")
    .select(
      "created_at, headline, iv_score, speaker, source, source_domain, author_handle",
    )
    .gte("created_at", since)
    .order("iv_score", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) {
    log.warn("scored_riskflow_items read failed", { error: error.message });
    return [];
  }
  return (data ?? []).map((row) => ({
    date: row.created_at
      ? new Date(row.created_at as string).toISOString().slice(0, 10)
      : null,
    iv:
      row.iv_score != null && Number.isFinite(Number(row.iv_score))
        ? Number(row.iv_score)
        : null,
    speaker: (row.speaker ?? row.author_handle ?? null) as string | null,
    source: (row.source_domain ?? row.source ?? null) as string | null,
    headline: String(row.headline ?? "").slice(0, 200),
  }));
}

async function loadVerdicts(
  sb: ReturnType<typeof getSupabaseClient>,
  since: string,
  limit: number,
): Promise<ArbitrumVerdictLine[]> {
  if (!sb) return [];
  const { data, error } = await sb
    .from("arbitrum_verdicts")
    .select(
      "created_at, category, question, consensus_probability, confidence, dissent_summary",
    )
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    log.warn("arbitrum_verdicts read failed", { error: error.message });
    return [];
  }
  return (data ?? []).map((row) => ({
    date: row.created_at
      ? new Date(row.created_at as string).toISOString().slice(0, 10)
      : null,
    category: (row.category ?? null) as string | null,
    question: String(row.question ?? "").slice(0, 200),
    consensus:
      row.consensus_probability != null
        ? Number(row.consensus_probability)
        : null,
    confidence: row.confidence != null ? Number(row.confidence) : null,
    dissent:
      typeof row.dissent_summary === "string" && row.dissent_summary.length > 0
        ? row.dissent_summary.slice(0, 220)
        : null,
  }));
}

export function formatNewsContext(
  ctx: ArbitrumNewsContext | null | undefined,
): string | null {
  if (!ctx) return null;
  const lines: string[] = [];
  if (ctx.riskflow.length > 0) {
    lines.push(
      `RiskFlow tape (top ${ctx.riskflow.length} by IV, last ${ctx.windowDays}d):`,
    );
    for (const r of ctx.riskflow) {
      const iv = r.iv != null ? `iv ${r.iv.toFixed(1)}` : "iv —";
      const who = r.speaker ?? r.source ?? "—";
      const head = r.headline.length > 140 ? r.headline.slice(0, 140) + "…" : r.headline;
      lines.push(`  ${r.date ?? "—"} | ${iv.padEnd(7)} | ${who} | ${head}`);
    }
  }
  if (ctx.verdicts.length > 0) {
    lines.push(``);
    lines.push(
      `Recent Arbitrum verdicts (last ${ctx.verdicts.length}, ${ctx.windowDays}d):`,
    );
    for (const v of ctx.verdicts) {
      const cons =
        v.consensus != null ? `p=${v.consensus.toFixed(2)}` : "p=—";
      const conf =
        v.confidence != null ? `conf=${v.confidence.toFixed(2)}` : "conf=—";
      const q =
        v.question.length > 130 ? v.question.slice(0, 130) + "…" : v.question;
      lines.push(`  ${v.date ?? "—"} | ${cons} ${conf} | ${q}`);
      if (v.dissent) lines.push(`      dissent: ${v.dissent}`);
    }
  }
  return lines.length > 0 ? lines.join("\n") : null;
}
