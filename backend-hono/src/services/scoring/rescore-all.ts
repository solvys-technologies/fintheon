// [claude-code 2026-04-19] S24-T3: One-shot rescore-all migration job.
// Re-runs the V4 scoring pipeline over every row in scored_riskflow_items.
// Writes back iv_score, macro_level, sub_scores, sentiment, rescored_at.
// Preserves headline, created_at, raw source fields.

import { getSupabaseClient } from "../../config/supabase.js";
import { createLogger } from "../../lib/logger.js";
import { parseHeadline } from "../headline-parser.js";
import {
  calculateIVScore,
  computeV4ScarcityGate,
  isScoringV4Enabled,
} from "../analysis/iv-scorer.js";
import { fetchVIX } from "../vix-service.js";
import { getLexicon } from "./lexicon-cache.js";
import type { NewsSource } from "../../types/news-analysis.js";

const log = createLogger("RescoreAll");

const BATCH_SIZE = 50;

export interface RescoreRunStats {
  total: number;
  rescored: number;
  unchanged: number;
  failed: number;
  l10Before: number;
  l10After: number;
  startedAt: string;
  finishedAt: string | null;
  dryRun: boolean;
}

interface RunState {
  inProgress: boolean;
  startedAt: number | null;
  current: RescoreRunStats | null;
}

const state: RunState = {
  inProgress: false,
  startedAt: null,
  current: null,
};

export function isRescoreInProgress(): boolean {
  return state.inProgress;
}

export function getLastRescoreStats(): RescoreRunStats | null {
  return state.current;
}

interface ScoredRow {
  id: string;
  tweet_id: string;
  source: string;
  headline: string;
  body: string | null;
  iv_score: number | null;
  macro_level: number | null;
  published_at: string | null;
  created_at: string;
}

interface RescoreOptions {
  dryRun?: boolean;
  limit?: number | null;
}

export async function runRescoreAll(
  options: RescoreOptions = {},
): Promise<RescoreRunStats> {
  if (state.inProgress) {
    throw new Error(
      "rescore-all already in progress — refusing to start a second run",
    );
  }

  const sb = getSupabaseClient();
  if (!sb) throw new Error("Supabase unavailable");

  const dryRun = options.dryRun === true;
  const limit = options.limit ?? null;

  const startedAt = new Date().toISOString();
  state.inProgress = true;
  state.startedAt = Date.now();
  state.current = {
    total: 0,
    rescored: 0,
    unchanged: 0,
    failed: 0,
    l10Before: 0,
    l10After: 0,
    startedAt,
    finishedAt: null,
    dryRun,
  };

  log.info("Rescore-all starting", { dryRun, limit, v4: isScoringV4Enabled() });

  try {
    // Pre-load lexicon once for the whole run
    const lexicon = await getLexicon();
    const vixData = await fetchVIX().catch(() => null);

    let cursor: string | null = null;
    let processed = 0;
    let pageIndex = 0;

    // Cursor-paginate by created_at to avoid OFFSET cost on large tables
    while (true) {
      let query = sb
        .from("scored_riskflow_items")
        .select(
          "id, tweet_id, source, headline, body, iv_score, macro_level, published_at, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(BATCH_SIZE);

      if (cursor) query = query.lt("created_at", cursor);
      if (limit && processed + BATCH_SIZE > limit) {
        query = query.limit(Math.max(1, limit - processed));
      }

      const { data, error } = await query;
      if (error) {
        log.warn("Failed to fetch batch", { error: error.message, pageIndex });
        break;
      }
      if (!data || data.length === 0) break;

      for (const row of data as ScoredRow[]) {
        state.current.total++;
        if ((row.iv_score ?? 0) >= 9.5) state.current.l10Before++;

        try {
          const updated = await rescoreRow(row, vixData, lexicon);
          if (!updated) {
            state.current.unchanged++;
            continue;
          }

          if (updated.iv_score >= 9.5) state.current.l10After++;

          if (!dryRun) {
            const { error: writeError } = await sb
              .from("scored_riskflow_items")
              .update({
                iv_score: updated.iv_score,
                macro_level: updated.macro_level,
                sub_scores: updated.sub_scores,
                sentiment: updated.sentiment,
                rescored_at: new Date().toISOString(),
              })
              .eq("id", row.id);
            if (writeError) {
              log.warn("Failed to write rescore", {
                tweetId: row.tweet_id,
                error: writeError.message,
              });
              state.current.failed++;
              continue;
            }
          }
          state.current.rescored++;
        } catch (err) {
          state.current.failed++;
          log.warn("Rescore failed for row", {
            tweetId: row.tweet_id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      processed += data.length;
      if (processed % 100 < BATCH_SIZE) {
        log.info("Rescore progress", {
          processed,
          rescored: state.current.rescored,
          l10After: state.current.l10After,
        });
      }

      if (limit && processed >= limit) break;
      if (data.length < BATCH_SIZE) break;

      const next = (data[data.length - 1] as ScoredRow).created_at;
      if (!next || next === cursor) break;
      cursor = next;
      pageIndex++;
    }

    state.current.finishedAt = new Date().toISOString();
    log.info("Rescore-all complete", { ...state.current });
    return state.current;
  } finally {
    state.inProgress = false;
    state.startedAt = null;
  }
}

async function rescoreRow(
  row: ScoredRow,
  vixData: Awaited<ReturnType<typeof fetchVIX>> | null,
  lexicon: Awaited<ReturnType<typeof getLexicon>>,
): Promise<{
  iv_score: number;
  macro_level: number;
  sub_scores: unknown;
  sentiment: string;
} | null> {
  const headline = (row.headline ?? "").trim();
  if (!headline) return null;

  const source = mapStoredSourceToNewsSource(row.source);
  const parseResult = parseHeadline(headline, { source });
  const parsed = parseResult.parsed;

  const ivResult = await calculateIVScore({
    parsed,
    hotPrint: null,
    timestamp: row.published_at ? new Date(row.published_at) : new Date(),
    vixData: vixData ?? undefined,
  });

  let finalScore = ivResult.score;
  // Stored as JSONB — widen to a record so the V4 gate annotation fits.
  const baseSubScores: Record<string, unknown> = ivResult.subScores
    ? { ...(ivResult.subScores as unknown as Record<string, unknown>) }
    : {};

  if (isScoringV4Enabled()) {
    const gate = computeV4ScarcityGate(ivResult.score, parsed, lexicon);
    if (gate.cappedScore < ivResult.score) {
      finalScore = gate.cappedScore;
      baseSubScores.v4Gate = {
        cappedScore: gate.cappedScore,
        reason: gate.capReason,
        level: gate.level,
        matrixFlip: gate.matrixFlip,
        targetRegime: gate.targetRegime,
      };
    }
  }

  return {
    iv_score: Number(finalScore.toFixed(2)),
    macro_level: ivResult.macroLevel,
    sub_scores: baseSubScores,
    sentiment: ivResult.sentiment,
  };
}

function mapStoredSourceToNewsSource(source: string | null | undefined): NewsSource {
  const s = (source ?? "").toLowerCase();
  if (s.includes("financialjuice") || s.includes("financial juice")) {
    return "FinancialJuice" as NewsSource;
  }
  if (s.includes("walter") || s.includes("bloomberg")) {
    return "Walter Bloomberg" as NewsSource;
  }
  if (s.includes("zerohedge") || s.includes("zero hedge")) {
    return "ZeroHedge" as NewsSource;
  }
  return "Custom" as NewsSource;
}
