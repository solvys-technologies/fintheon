// [claude-code 2026-04-24] S35-T10: renamed dir from workers/news-worker. Heartbeat table
//   now writes to riskflow_worker_heartbeats (legacy view alias preserved through 2026-05-08).
//   submitted_by tag updated to "riskflow-worker"; FLAG_WRITES env var has legacy fallback.
// [claude-code 2026-04-19] S27-T7 (W2d): Supabase write layer. Worker and
// backend-hono never talk HTTP — this is the contract. Dry-run mode skips
// writes while still upserting heartbeats, so load tests don't pollute the
// scorer's inbox.
//
// [claude-code 2026-04-20] S27 final-sanitation fix: W2d invented a
// `public.riskflow_items` table that does not exist. Real ingestion inbox
// is `public.raw_riskflow_items` (keyed on tweet_id, not item_id).
//
// [claude-code 2026-04-20] Schema mismatch fixed for the now-live writer:
// raw_riskflow_items keys on `tweet_id` (unique), not `item_id`, and has
// `is_breaking` instead of `tier`. There is no `url` column — the live
// schema is id/tweet_id/source/headline/body/symbols/tags/is_breaking/urgency/
// published_at/submitted_by/created_at + the source-provenance trio
// (source_domain/fetched_at/fetch_latency_ms) added by the sources migration.
// URL is appended to `tags` so the original link survives until a real `url`
// column lands; symbols stays empty (worker doesn't tag tickers yet).
//
// [claude-code 2026-04-24] S34-T4: Count dedup silent-drops per source. When
// upsert with ignoreDuplicates collapses rows, the gap between `items.length`
// and the returned id[] is the dedup count. Emit into riskflow_drop_counters
// via bumpCounter so the quiet "items_ingested: 0" zero is traceable.

import { getSupabaseClient } from "../../config/supabase.js";
import { bumpCounter } from "../../services/riskflow/drop-counters.js";
import { isBannedPublisher } from "../../services/riskflow/content-guard.js";
import {
  recordIngestAttempt,
  recordLeakEvent,
} from "../../services/riskflow/ingest-ledger.js";
import {
  checkSourcePolicy,
  refreshAllowlist,
} from "../../services/riskflow/source-policy.js";
import type { CollectedNewsItem } from "./sources/types.js";

const FLAG_WRITES_NEW = "FLAG_RISKFLOW_WORKER_WRITES_RISKFLOW";
const FLAG_WRITES_LEGACY = "FLAG_NEWS_WORKER_WRITES_RISKFLOW";

function writesEnabled(): boolean {
  // Legacy alias FLAG_NEWS_WORKER_WRITES_RISKFLOW honored until 2026-05-08.
  const flag = process.env[FLAG_WRITES_NEW] ?? process.env[FLAG_WRITES_LEGACY];
  return flag === "true";
}

function flagDisplay(): string {
  return process.env[FLAG_WRITES_NEW] !== undefined
    ? FLAG_WRITES_NEW
    : FLAG_WRITES_LEGACY;
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
        service: "riskflow-worker",
        stage: "dry_run_skip",
        reason: `${flagDisplay()} != true`,
        would_write: items.length,
      }),
    );
    return 0;
  }

  // [claude-code 2026-04-19] url now writes to a real column; we keep the
  // url: tag for one release as a transition fallback so legacy consumers
  // that still read from `tags` don't suddenly see empty source links.
  // [claude-code 2026-04-24] S34-T4: pre-filter missing-field items so the
  // dedup math below isn't polluted by schema rejects that would short-circuit
  // the upsert silently.
  // [claude-code 2026-04-27] Per TP: scrub bot-wall / rate-limit / captcha
  // noise that makes it past the source layer when a scraper tripped a wall
  // and ingested the wall page itself. Patterns cover the canonical Twitter
  // / Cloudflare / Google / SEC throttle surfaces.
  const NOISE_PATTERNS: RegExp[] = [
    /\bare you a robot\b/i,
    /\brate[- ]?limit(?:ed|ing|s)?\b/i,
    /\btoo many requests\b/i,
    /\b429\b.*(?:limit|throttle)/i,
    /\bcaptcha\b/i,
    /\brecaptcha\b/i,
    /\bcloudflare\b.*(?:check|verify|just a moment)/i,
    /\bjust a moment\.\.\./i,
    /\bplease (?:complete|verify) the security check\b/i,
    /\brequest rate threshold exceeded\b/i, // SEC EDGAR throttle page
    /\bunusual traffic from your computer network\b/i, // Google bot wall
    /\bplease verify you are a human\b/i,
    /\bsign in to (?:x|twitter)\b/i, // X login wall scraped as headline
    /\bsomething went wrong\.? try reloading\b/i, // X soft error page
  ];
  function isNoiseHeadline(headline: string, body: string): boolean {
    const blob = `${headline} ${body}`.slice(0, 500);
    return NOISE_PATTERNS.some((p) => p.test(blob));
  }

  const eligible: CollectedNewsItem[] = [];
  const perSourceMissing = new Map<string, number>();
  const perSourceBannedHost = new Map<string, number>();
  const perSourceNoise = new Map<string, number>();
  for (const item of items) {
    const src = item.source || "unknown";
    if (!item.item_id || !item.headline || !item.headline.trim()) {
      perSourceMissing.set(src, (perSourceMissing.get(src) ?? 0) + 1);
      continue;
    }
    // [claude-code 2026-04-26] Banned-publisher URL/host gate. Worker writes
    // bypass supabase-service.ts:writeRawItems (uses raw Supabase client),
    // so the gate has to live here too. Twitter relays mentioning a banned
    // outlet by name still pass — only direct URL hits drop.
    if (
      isBannedPublisher({
        url: item.url,
        tags: item.source_domain ? [item.source_domain] : [],
      })
    ) {
      perSourceBannedHost.set(src, (perSourceBannedHost.get(src) ?? 0) + 1);
      continue;
    }
    // [claude-code 2026-04-27] Bot-wall / rate-limit / captcha scrub.
    if (isNoiseHeadline(item.headline, item.body)) {
      perSourceNoise.set(src, (perSourceNoise.get(src) ?? 0) + 1);
      continue;
    }
    eligible.push(item);
  }
  for (const [src, count] of perSourceMissing) {
    bumpCounter(src, "persist", "dropped_missing_fields", count);
  }
  for (const [src, count] of perSourceBannedHost) {
    bumpCounter(src, "persist", "dropped_banned_publisher_host", count);
  }
  for (const [src, count] of perSourceNoise) {
    bumpCounter(src, "persist", "dropped_bot_wall_noise", count);
  }
  if (eligible.length === 0) return 0;

  await refreshAllowlist();
  const policyEligible: CollectedNewsItem[] = [];
  for (const item of eligible) {
    const verdict = checkSourcePolicy(item.source, item.url, {
      pipeline: item.ingest_pipeline,
      sourceDomain: item.source_domain,
    });
    if (verdict.decision === "allowed") {
      policyEligible.push(item);
      recordIngestAttempt({
        source: item.source,
        pipeline: item.ingest_pipeline ?? "riskflow-worker",
        decision: "accepted",
        reason: verdict.reason,
        headlinePreview: item.headline,
      });
      continue;
    }

    recordIngestAttempt({
      source: item.source,
      pipeline: item.ingest_pipeline ?? "riskflow-worker",
      decision: "blocked_by_policy",
      reason: verdict.reason,
      headlinePreview: item.headline,
    });
    recordLeakEvent(
      `${verdict.decision}: ${item.source_domain || item.source} — ${item.headline.slice(0, 80)}`,
    );
    bumpCounter(item.source || "unknown", "persist", "blocked_source_policy");
  }
  if (policyEligible.length === 0) return 0;

  // [claude-code 2026-04-27] image_url + url are the two display fields the
  // frontend RiskFlow card depends on (RiskFlowDetailCard.tsx renders an <img>
  // wrapped in <a href={alert.url ?? alert.imageUrl}>). Persist both — the
  // central-scorer copies them straight through to scored_riskflow_items.
  // [claude-code 2026-04-27] S46.4/I: video_url threaded through for tweet
  // attachments (highest-bitrate mp4 from extended_entities.media[].video_info).
  const rows = policyEligible.map((item) => ({
    tweet_id: item.item_id,
    source: item.source,
    source_domain: item.source_domain,
    headline: item.headline,
    body: item.body,
    url: item.url ?? null,
    image_url: item.image_url ?? null,
    video_url: item.video_url ?? null,
    symbols: [] as string[],
    tags: item.url
      ? [`url:${item.url}`, `tier:${item.tier}`]
      : [`tier:${item.tier}`],
    is_breaking: item.tier === "breaking",
    urgency: item.tier === "breaking" ? 8 : 4,
    published_at: item.published_at,
    submitted_by: "riskflow-worker",
    fetched_at: item.fetched_at,
    fetch_latency_ms: item.fetch_latency_ms,
    ingest_pipeline: item.ingest_pipeline ?? null,
  }));

  try {
    const { data, error } = await sb
      .from("raw_riskflow_items")
      .upsert(rows, { onConflict: "tweet_id", ignoreDuplicates: true })
      .select("id");
    if (error) {
      console.warn(
        JSON.stringify({
          ts: new Date().toISOString(),
          service: "riskflow-worker",
          stage: "persist_error",
          error: error.message,
        }),
      );
      for (const item of eligible) {
        bumpCounter(
          item.source || "unknown",
          "persist",
          "dropped_supabase_error",
        );
      }
      return 0;
    }
    const written = data?.length ?? 0;
    const droppedDedup = Math.max(0, eligible.length - written);
    if (droppedDedup > 0) {
      // ignoreDuplicates doesn't tell us WHICH rows got dropped, so distribute
      // the dedup count across sources proportionally to their share of the
      // eligible batch. This is good-enough attribution for trend detection;
      // per-row precision would require a read-before-write per batch.
      const perSource = new Map<string, number>();
      for (const item of eligible) {
        const src = item.source || "unknown";
        perSource.set(src, (perSource.get(src) ?? 0) + 1);
      }
      const entries = Array.from(perSource.entries());
      const total = eligible.length;
      let allocated = 0;
      for (let i = 0; i < entries.length; i++) {
        const [src, share] = entries[i];
        const portion =
          i === entries.length - 1
            ? droppedDedup - allocated
            : Math.round((droppedDedup * share) / total);
        if (portion > 0) {
          bumpCounter(src, "persist", "dropped_dedup", portion);
          allocated += portion;
        }
      }
    }
    return written;
  } catch (err) {
    console.warn(
      JSON.stringify({
        ts: new Date().toISOString(),
        service: "riskflow-worker",
        stage: "persist_exception",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    for (const item of eligible) {
      bumpCounter(
        item.source || "unknown",
        "persist",
        "dropped_supabase_exception",
      );
    }
    return 0;
  }
}

export async function upsertHeartbeat(row: {
  tier: "breaking" | "standard" | "commentary";
  last_run_at: string;
  items_ingested: number;
  errors: number;
}): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) return;
  try {
    await sb.from("riskflow_worker_heartbeats").upsert(row, {
      onConflict: "tier",
    });
  } catch (err) {
    console.warn(
      JSON.stringify({
        ts: new Date().toISOString(),
        service: "riskflow-worker",
        stage: "heartbeat_error",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }
}
