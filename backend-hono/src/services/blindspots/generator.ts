// [claude-code 2026-04-23] S31-T6 — blindspots generator. Template-first (pure
// detectors) with an optional fluid LLM pass that is hard-gated by the
// pattern allowlist. If the LLM drifts outside the allowed patterns the row
// is discarded.

import { query, isPoolAvailable } from "../../db/optimized.js";
import {
  PSYCH_BLINDSPOT_TEMPLATES,
  TRADING_BLINDSPOT_TEMPLATES,
  isAllowedPsychPattern,
  isAllowedTradingPattern,
  type BlindspotTemplate,
  type DetectContext,
  type TradeRecord,
} from "./templates.js";
import { generateTextViaClaude } from "../claude-sdk/process-manager.js";

export interface BlindspotRow {
  id?: string;
  userId: string;
  date: string;
  pattern: string;
  evidence: string;
  correctiveAction: string;
  severity: number;
  source: "template" | "fluid";
}

export interface GenerateResult {
  psych: BlindspotRow[];
  trading: BlindspotRow[];
}

interface TradesQueryRow {
  id: string;
  contract: string;
  side: string;
  qty: number;
  entry_at: string;
  exit_at: string | null;
  entry_price: string;
  exit_price: string | null;
  realized_pnl: string;
}

async function loadTradesForDate(
  userId: string,
  date: string,
): Promise<TradeRecord[]> {
  if (!isPoolAvailable()) return [];
  const from = `${date}T00:00:00Z`;
  const to = `${date}T23:59:59Z`;
  try {
    const result = await query<TradesQueryRow>(
      `SELECT id, contract, side, qty, entry_at, exit_at, entry_price, exit_price, realized_pnl
       FROM trades
       WHERE user_id = $1 AND entry_at >= $2 AND entry_at <= $3
       ORDER BY entry_at ASC`,
      [userId, from, to],
    );
    return result.rows.map((r) => ({
      id: r.id,
      contract: r.contract,
      side: (r.side as TradeRecord["side"]) ?? "long",
      qty: Number(r.qty),
      entryAt: r.entry_at,
      exitAt: r.exit_at,
      entryPrice: Number(r.entry_price),
      exitPrice: r.exit_price !== null ? Number(r.exit_price) : null,
      realizedPnL: Number(r.realized_pnl),
    }));
  } catch {
    return [];
  }
}

async function loadAvgTradesPer30Days(
  userId: string,
  untilDate: string,
): Promise<number | undefined> {
  if (!isPoolAvailable()) return undefined;
  try {
    const result = await query<{ c: string }>(
      `SELECT COUNT(*)::text AS c
       FROM trades
       WHERE user_id = $1
         AND entry_at >= ($2::date - INTERVAL '30 days')
         AND entry_at <  $2::date`,
      [userId, untilDate],
    );
    const total = Number(result.rows[0]?.c ?? 0);
    if (!Number.isFinite(total) || total <= 0) return undefined;
    return total / 30;
  } catch {
    return undefined;
  }
}

function runTemplates(
  templates: BlindspotTemplate[],
  ctx: DetectContext,
): BlindspotRow[] {
  const rows: BlindspotRow[] = [];
  for (const t of templates) {
    const hit = t.detect(ctx);
    if (!hit) continue;
    rows.push({
      userId: ctx.userId,
      date: ctx.date,
      pattern: hit.pattern,
      evidence: hit.evidence.slice(0, 400),
      correctiveAction: t.correctiveAction,
      severity: t.severity,
      source: "template",
    });
  }
  return rows;
}

interface FluidCandidate {
  category: "psych" | "trading";
  pattern: string;
  evidence: string;
  correctiveAction: string;
  severity: number;
}

function buildFluidPrompt(
  ctx: DetectContext,
  existing: BlindspotRow[],
): string {
  const alreadyHit = existing.map((r) => r.pattern).join(", ") || "(none)";
  const summary = {
    date: ctx.date,
    tradeCount: ctx.trades.length,
    vix: ctx.vix ?? null,
    news: ctx.newsEventsToday?.length ?? 0,
    alreadyCaught: alreadyHit,
  };
  return `You are auditing a day of futures trading for blindspot patterns.

HARD RULES:
- Return ONLY JSON: {"candidates":[{"category":"psych|trading","pattern":"<key>","evidence":"...","correctiveAction":"...","severity":1-5}]}
- "pattern" MUST be one of:
  psych:   revenge_entry, size_escalation, post_loss_cluster, fomo_entry
  trading: over_trading, over_leverage, high_vol_env, news_trading_early, plan_deviation
- If no pattern applies, return {"candidates":[]}.
- NEVER invent a pattern key outside this list.
- NEVER duplicate a pattern already in alreadyCaught.

Context: ${JSON.stringify(summary)}
Trades: ${JSON.stringify(ctx.trades.slice(0, 30))}

Return JSON only.`;
}

function parseFluidResponse(raw: string): FluidCandidate[] {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]);
    const candidates = Array.isArray(parsed.candidates)
      ? parsed.candidates
      : [];
    return candidates.filter(
      (c: unknown): c is FluidCandidate =>
        !!c &&
        typeof c === "object" &&
        typeof (c as FluidCandidate).pattern === "string" &&
        typeof (c as FluidCandidate).evidence === "string" &&
        typeof (c as FluidCandidate).correctiveAction === "string" &&
        typeof (c as FluidCandidate).severity === "number" &&
        ((c as FluidCandidate).category === "psych" ||
          (c as FluidCandidate).category === "trading"),
    );
  } catch {
    return [];
  }
}

function applyAllowlist(
  candidates: FluidCandidate[],
  existing: BlindspotRow[],
  userId: string,
  date: string,
): BlindspotRow[] {
  const taken = new Set(existing.map((r) => r.pattern));
  const out: BlindspotRow[] = [];
  for (const c of candidates) {
    const ok =
      c.category === "psych"
        ? isAllowedPsychPattern(c.pattern)
        : isAllowedTradingPattern(c.pattern);
    if (!ok) continue; // drift → discard
    if (taken.has(c.pattern)) continue;
    const severity = Math.max(1, Math.min(5, Math.round(c.severity)));
    out.push({
      userId,
      date,
      pattern: c.pattern,
      evidence: c.evidence.slice(0, 400),
      correctiveAction: c.correctiveAction.slice(0, 400),
      severity,
      source: "fluid",
    });
    taken.add(c.pattern);
  }
  return out;
}

async function runFluidPass(
  ctx: DetectContext,
  existing: BlindspotRow[],
): Promise<{ psych: BlindspotRow[]; trading: BlindspotRow[] }> {
  try {
    const raw = await generateTextViaClaude(buildFluidPrompt(ctx, existing), {
      timeoutMs: 30_000,
    });
    const candidates = parseFluidResponse(raw);
    const filtered = applyAllowlist(candidates, existing, ctx.userId, ctx.date);
    return {
      psych: filtered.filter((r) => isAllowedPsychPattern(r.pattern)),
      trading: filtered.filter((r) => isAllowedTradingPattern(r.pattern)),
    };
  } catch {
    return { psych: [], trading: [] };
  }
}

async function writeRows(
  table: "psych_blindspots" | "trading_blindspots",
  rows: BlindspotRow[],
): Promise<void> {
  if (!isPoolAvailable() || rows.length === 0) return;
  for (const r of rows) {
    try {
      await query(
        `INSERT INTO ${table} (user_id, date, pattern, evidence, corrective_action, severity, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          r.userId,
          r.date,
          r.pattern,
          r.evidence,
          r.correctiveAction,
          r.severity,
          r.source,
        ],
      );
    } catch (err) {
      console.error(`[blindspots] insert into ${table} failed:`, err);
    }
  }
}

export interface GenerateOptions {
  enableFluidPass?: boolean;
  vix?: number;
  accountLimitNotional?: number;
  newsEventsToday?: DetectContext["newsEventsToday"];
  plannedSymbols?: string[];
}

export async function generateBlindspots(
  userId: string,
  date: string,
  opts: GenerateOptions = {},
): Promise<GenerateResult> {
  const trades = await loadTradesForDate(userId, date);
  const avgTradesPer30Days = await loadAvgTradesPer30Days(userId, date);

  const ctx: DetectContext = {
    userId,
    date,
    trades,
    vix: opts.vix,
    accountLimitNotional: opts.accountLimitNotional,
    newsEventsToday: opts.newsEventsToday,
    plannedSymbols: opts.plannedSymbols?.map((s) => s.toUpperCase()),
    avgTradesPer30Days,
  };

  const psych = runTemplates(PSYCH_BLINDSPOT_TEMPLATES, ctx);
  const trading = runTemplates(TRADING_BLINDSPOT_TEMPLATES, ctx);

  if (opts.enableFluidPass && trades.length > 0) {
    const fluid = await runFluidPass(ctx, [...psych, ...trading]);
    psych.push(...fluid.psych);
    trading.push(...fluid.trading);
  }

  await writeRows("psych_blindspots", psych);
  await writeRows("trading_blindspots", trading);

  return { psych, trading };
}
