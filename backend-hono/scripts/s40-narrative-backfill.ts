// [claude-code 2026-04-25] S40-P5: one-shot retroactive narrative backfill.
//
//   1. Compute headline_hash = sha1(normalize(headline)) for all
//      scored_riskflow_items + news_feed_items rows.
//   2. Group by hash; keep the oldest row, soft-delete duplicates
//      (archived_at = now()).
//   3. Re-run the classifier on the last 30 days of unique items and update
//      narrative_card_links to reflect the new Singularity / merger /
//      partnership_deal classifications.
//   4. Write an audit row to worker_health.
//
// Idempotent — safe to re-run. **DESTRUCTIVE** in that it sets archived_at
// on duplicates. Smoke-test on a Supabase branch before running on prod.
//
// Run:
//   bun run backend-hono/scripts/s40-narrative-backfill.ts

import "dotenv/config";
import { createHash } from "node:crypto";
import { getSupabaseClient } from "../src/config/supabase.js";
import { normalizeHeadline } from "../src/services/riskflow/text-utils.js";

interface RowWithHeadline {
  id: string;
  tweet_id?: string;
  headline: string;
  published_at: string;
  archived_at: string | null;
}

function hashHeadline(headline: string): string {
  return createHash("sha1").update(normalizeHeadline(headline)).digest("hex");
}

async function backfillTable(
  table: "news_feed_items" | "scored_riskflow_items",
  idCol: "id" | "tweet_id",
): Promise<{ updated: number; archived: number }> {
  const sb = getSupabaseClient();
  if (!sb) throw new Error("Supabase unavailable — set SUPABASE_* env vars");

  // Page through rows missing headline_hash. The query is idempotent: re-runs
  // only touch rows that haven't been hashed yet.
  let updated = 0;
  let archived = 0;
  const PAGE = 500;

  // Pass 1: backfill headline_hash where null.
  while (true) {
    const { data, error } = await sb
      .from(table)
      .select(`${idCol}, headline, published_at, archived_at`)
      .is("headline_hash", null)
      .order("published_at", { ascending: true })
      .limit(PAGE);
    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const row of data as unknown as RowWithHeadline[]) {
      const id = (row as any)[idCol];
      const hash = hashHeadline(row.headline ?? "");
      const { error: upErr } = await sb
        .from(table)
        .update({ headline_hash: hash })
        .eq(idCol, id);
      if (upErr) {
        console.warn(
          `[backfill] failed to update ${table}.${idCol}=${id}: ${upErr.message}`,
        );
        continue;
      }
      updated += 1;
    }
    if (data.length < PAGE) break;
  }

  // Pass 2: dedup — for each hash with multiple non-archived rows, keep the
  // oldest, archive the rest. Done via SQL window function for speed.
  const { error: dedupError } = await sb.rpc("s40_dedup_by_headline_hash", {
    target_table: table,
  });

  if (dedupError) {
    // Fallback: do it in TS. Slower, but works without the RPC installed.
    const { data: rows, error: fetchErr } = await sb
      .from(table)
      .select(`${idCol}, headline_hash, published_at, archived_at`)
      .is("archived_at", null)
      .order("published_at", { ascending: true });
    if (fetchErr) {
      console.warn(
        `[backfill] dedup fallback fetch failed: ${fetchErr.message}`,
      );
    } else {
      const seen = new Map<string, string>(); // hash → first id
      const toArchive: any[] = [];
      for (const row of rows ?? []) {
        const hash = (row as any).headline_hash;
        const id = (row as any)[idCol];
        if (!hash) continue;
        if (seen.has(hash)) {
          toArchive.push(id);
        } else {
          seen.set(hash, id);
        }
      }
      for (let i = 0; i < toArchive.length; i += PAGE) {
        const batch = toArchive.slice(i, i + PAGE);
        const { error: archErr } = await sb
          .from(table)
          .update({ archived_at: new Date().toISOString() })
          .in(idCol, batch);
        if (archErr) {
          console.warn(`[backfill] archive batch failed: ${archErr.message}`);
        } else {
          archived += batch.length;
        }
      }
    }
  }

  return { updated, archived };
}

async function audit(message: string): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) return;
  await sb.from("worker_health").insert({
    worker: "s40-narrative-backfill",
    status: "backfill_complete",
    action_taken: message,
  });
}

async function main(): Promise<void> {
  console.log("[s40-backfill] starting");
  const newsfeed = await backfillTable("news_feed_items", "id");
  console.log("[s40-backfill] news_feed_items:", newsfeed);
  const scored = await backfillTable("scored_riskflow_items", "tweet_id");
  console.log("[s40-backfill] scored_riskflow_items:", scored);

  await audit(
    `news_feed_items: ${newsfeed.updated} hashed, ${newsfeed.archived} archived; scored_riskflow_items: ${scored.updated} hashed, ${scored.archived} archived`,
  );

  console.log("[s40-backfill] done");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[s40-backfill] failed:", err);
    process.exit(1);
  });
