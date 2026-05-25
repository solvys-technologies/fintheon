// [claude-code 2026-04-24] S34-T10: backfill orchestrator cron.
// Monday 02:00 ET — claims 2 oldest pending slices, pulls raw econ events via free-tier LLM,
// queues raw, then batch-normalizes via Harper and upserts into economic_events idempotently.
// Gated on ECON_BACKFILL_ENABLED; no-op if DEEPSEEK_API_KEY missing (warn, don't crash).

import cron from "node-cron";
import { createLogger } from "../../lib/logger.js";
import { getSupabaseClient } from "../../config/supabase.js";
import { pullSliceViaFreeTierLLM } from "./econ-backfill-puller.js";
import {
  harperCategorizeBacklog,
  getHarperTokensThisWeek,
} from "./econ-backfill-harper.js";
import type {
  BackfillDiagnostics,
  BackfillSlice,
  NormalizedBackfillEvent,
} from "../../types/econ-backfill.js";

const log = createLogger("EconBackfillOrchestrator");

const CRON_EXPR = "0 2 * * 1"; // Monday 02:00 local (America/New_York)
const SLICES_PER_TICK = 2;

let task: cron.ScheduledTask | null = null;
let running = false;
let lastRunAt: string | null = null;

async function claimSlices(limit: number): Promise<BackfillSlice[]> {
  const sb = getSupabaseClient();
  if (!sb) return [];

  const { data: candidates, error: selectErr } = await sb
    .from("econ_backfill_progress")
    .select("id")
    .eq("status", "pending")
    .order("slice_start", { ascending: true })
    .limit(limit);

  if (selectErr || !candidates || candidates.length === 0) return [];

  const ids = (candidates as Array<{ id: string }>).map((r) => r.id);
  const { data: claimed, error: updateErr } = await sb
    .from("econ_backfill_progress")
    .update({ status: "claimed", claimed_at: new Date().toISOString() })
    .in("id", ids)
    .eq("status", "pending")
    .select();

  if (updateErr || !claimed) return [];
  return claimed as BackfillSlice[];
}

async function markFailed(sliceId: string, message: string): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) return;
  await sb
    .from("econ_backfill_progress")
    .update({ status: "failed", error: message.slice(0, 500) })
    .eq("id", sliceId);
}

async function markEnriching(sliceId: string): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) return;
  await sb
    .from("econ_backfill_progress")
    .update({ status: "enriching" })
    .eq("id", sliceId);
}

async function markComplete(
  sliceId: string,
  rowsWritten: number,
): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) return;
  await sb
    .from("econ_backfill_progress")
    .update({
      status: "complete",
      completed_at: new Date().toISOString(),
      rows_written: rowsWritten,
    })
    .eq("id", sliceId);
}

async function upsertNormalized(
  events: NormalizedBackfillEvent[],
): Promise<number> {
  const sb = getSupabaseClient();
  if (!sb || events.length === 0) return 0;

  const rows = events.map((e) => ({
    name: e.name,
    date: e.date,
    time: e.time,
    country: e.country,
    category: e.category,
    forecast: e.forecast,
    actual: e.actual,
    previous: e.previous,
    detail: e.detail,
    impact: e.impact,
    event_key: e.event_key,
    updated_at: new Date().toISOString(),
  }));

  const { error, count } = await sb
    .from("economic_events")
    .upsert(rows, { onConflict: "event_key", count: "exact" });

  if (error) {
    log.warn("Upsert to economic_events failed", { error: error.message });
    return 0;
  }
  return count ?? rows.length;
}

async function processSlice(slice: BackfillSlice): Promise<void> {
  log.info("Processing slice", {
    id: slice.id,
    country: slice.country,
    range: `${slice.slice_start}..${slice.slice_end}`,
  });

  const payload = await pullSliceViaFreeTierLLM(slice);
  if (!payload) {
    await markFailed(slice.id, "puller returned null (no LLM output, no FRED)");
    return;
  }

  const sb = getSupabaseClient();
  if (!sb) {
    await markFailed(slice.id, "supabase client unavailable");
    return;
  }

  const { error: queueErr } = await sb.from("econ_backfill_queue").insert({
    progress_id: slice.id,
    raw_payload: payload,
    normalized: false,
  });
  if (queueErr) {
    await markFailed(slice.id, `queue insert failed: ${queueErr.message}`);
    return;
  }

  await markEnriching(slice.id);

  const normalized = await harperCategorizeBacklog(slice.id);
  const rowsWritten = await upsertNormalized(normalized);
  await markComplete(slice.id, rowsWritten);

  log.info("Slice complete", {
    id: slice.id,
    rowsWritten,
    normalized: normalized.length,
  });
}

export async function runBackfillTickOnce(): Promise<{
  processed: number;
  failed: number;
}> {
  lastRunAt = new Date().toISOString();

  if (!process.env.DEEPSEEK_API_KEY) {
    log.warn("DEEPSEEK_API_KEY missing — skipping backfill tick");
    return { processed: 0, failed: 0 };
  }

  const slices = await claimSlices(SLICES_PER_TICK);
  if (slices.length === 0) {
    log.info("No pending slices to claim — backfill may be complete");
    return { processed: 0, failed: 0 };
  }

  let processed = 0;
  let failed = 0;
  for (const slice of slices) {
    try {
      await processSlice(slice);
      processed++;
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      log.error("Slice processing threw", { id: slice.id, error: msg });
      await markFailed(slice.id, msg).catch(() => {});
    }
  }

  log.info("Backfill tick done", { processed, failed });
  return { processed, failed };
}

export function startEconBackfillOrchestrator(): void {
  if (running) return;
  if (process.env.ECON_BACKFILL_ENABLED === "false") {
    log.info("Econ backfill disabled via ECON_BACKFILL_ENABLED=false");
    return;
  }

  task = cron.schedule(
    CRON_EXPR,
    () => {
      runBackfillTickOnce().catch((err) =>
        log.warn("Cron tick swallowed error", { error: String(err) }),
      );
    },
    { timezone: "America/New_York" },
  );

  running = true;
  log.info(
    `Registered backfill cron (${CRON_EXPR} America/New_York, ${SLICES_PER_TICK} slices/tick)`,
  );
}

export function stopEconBackfillOrchestrator(): void {
  if (!running) return;
  task?.stop();
  task = null;
  running = false;
  log.info("Stopped econ backfill orchestrator");
}

export function isEconBackfillOrchestratorActive(): boolean {
  return running;
}

export async function getEconBackfillDiagnostics(): Promise<BackfillDiagnostics> {
  const base: BackfillDiagnostics = {
    last_run_at: lastRunAt,
    slices_pending: 0,
    slices_claimed: 0,
    slices_enriching: 0,
    slices_complete: 0,
    slices_failed: 0,
    rows_written_total: 0,
    harper_tokens_week: getHarperTokensThisWeek(),
  };

  const sb = getSupabaseClient();
  if (!sb) return base;

  const { data, error } = await sb
    .from("econ_backfill_progress")
    .select("status, rows_written");
  if (error || !data) return base;

  for (const row of data as Array<{ status: string; rows_written: number }>) {
    const key = `slices_${row.status}` as keyof BackfillDiagnostics;
    if (typeof base[key] === "number") {
      (base[key] as number) = (base[key] as number) + 1;
    }
    base.rows_written_total += row.rows_written ?? 0;
  }

  return base;
}
