// [claude-code 2026-04-19] S27-T7 (W2d): Supabase write layer. Worker and
// backend-hono never talk HTTP — this is the contract. Dry-run mode skips
// writes while still upserting heartbeats, so load tests don't pollute the
// scorer's inbox.
//
// [claude-code 2026-04-20] S27 final-sanitation fix: W2d invented a
// `public.riskflow_items` table that does not exist. Real ingestion inbox
// is `public.raw_riskflow_items` (keyed on tweet_id, not item_id). Renamed
// the .from() target so that when FLAG_NEWS_WORKER_WRITES_RISKFLOW=true is
// ever flipped, it writes to a real table. Column schema mismatch
// (item_id/url/tier vs tweet_id/symbols/tags/is_breaking) left for S28 —
// the flag defaults off so this path is dormant in prod; writes stay inert.

import { getSupabaseClient } from "../../config/supabase.js";
import type { CollectedNewsItem } from "./sources/types.js";

const FLAG_WRITES = "FLAG_NEWS_WORKER_WRITES_RISKFLOW";

function writesEnabled(): boolean {
  return process.env[FLAG_WRITES] === "true";
}

export async function writeCollectedItems(
  items: CollectedNewsItem[],
): Promise<number> {
  if (items.length === 0) return 0;
  const sb = getSupabaseClient();
  if (!sb) return 0;

  if (!writesEnabled()) {
    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        service: "news-worker",
        stage: "dry_run_skip",
        reason: `${FLAG_WRITES} != true`,
        would_write: items.length,
      }),
    );
    return 0;
  }

  const rows = items.map((item) => ({
    item_id: item.item_id,
    source: item.source,
    source_domain: item.source_domain,
    headline: item.headline,
    body: item.body,
    url: item.url,
    tier: item.tier,
    published_at: item.published_at,
    fetched_at: item.fetched_at,
    fetch_latency_ms: item.fetch_latency_ms,
  }));

  try {
    // TODO(S28): schema mismatch — raw_riskflow_items keys on tweet_id, not
    // item_id, and does not have url/tier columns. Flag-gated + defaults off,
    // so dormant in prod. Fix column names in sources/types.ts + rewrite rows
    // mapper above when the news-worker is promoted past dry-run.
    const { data, error } = await sb
      .from("raw_riskflow_items")
      .upsert(rows, { onConflict: "item_id", ignoreDuplicates: true })
      .select("id");
    if (error) {
      console.warn(
        JSON.stringify({
          ts: new Date().toISOString(),
          service: "news-worker",
          stage: "persist_error",
          error: error.message,
        }),
      );
      return 0;
    }
    return data?.length ?? 0;
  } catch (err) {
    console.warn(
      JSON.stringify({
        ts: new Date().toISOString(),
        service: "news-worker",
        stage: "persist_exception",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return 0;
  }
}

export async function upsertHeartbeat(row: {
  tier: "breaking" | "standard";
  last_run_at: string;
  items_ingested: number;
  errors: number;
}): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) return;
  try {
    await sb.from("news_worker_heartbeats").upsert(row, {
      onConflict: "tier",
    });
  } catch (err) {
    console.warn(
      JSON.stringify({
        ts: new Date().toISOString(),
        service: "news-worker",
        stage: "heartbeat_error",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }
}
