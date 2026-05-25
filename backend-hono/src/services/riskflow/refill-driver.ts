// [claude-code 2026-04-27] S46.4: Mass-refill driver for the Refinement
// Engine "Bulk Handling" panel. Iterates requested sources sequentially with
// a tail rate-limit between handle fetches and between cycle passes — TP
// runs this manually after a mass-delete + MSM-purge to repopulate the feed
// from the approved source set without tripping syndication.twitter.com
// 429s.
//
// Source classification:
//   - "twitter:<handle>" → social refill via collectFromXHandlesBrowser
//   - "<host>" → web refill via collectFromBrowserHarness (gov pages only)
//
// NOTE on date-range coverage: syndication.twitter.com only returns the most
// recent ~12 tweets per handle (~3-7 days depending on cadence). The
// {from, to} window is recorded for telemetry but the underlying collector
// caps at MAX_AGE_MS internally — the refill therefore only reaches as deep
// as the upstream API exposes. browser-harness scraping is the only path
// for older windows now (Exa stripped in v5.33.2).

import { collectFromXHandlesBrowser } from "../../workers/riskflow-worker/sources/x-handles-browser.js";
import { collectFromBrowserHarness } from "../../workers/riskflow-worker/sources/browser-harness.js";
import { writeCollectedItems } from "../../workers/riskflow-worker/persist.js";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("RefillDriver");

interface RefillOpts {
  sources: string[];
  from: string; // ISO_DATE
  to: string; // ISO_DATE
  tailHandleMs: number;
  tailCycleMs: number;
  /** Tier for all `twitter:` sources in this run (default standard). */
  twitterTier?: "breaking" | "standard" | "commentary";
}

interface RefillSourceResult {
  source: string;
  type: "social" | "web";
  fetched: number;
  ingested: number;
  error?: string;
}

interface RefillResult {
  from: string;
  to: string;
  sources_total: number;
  ingested_total: number;
  per_source: RefillSourceResult[];
  duration_ms: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runRefillForSources(
  opts: RefillOpts,
): Promise<RefillResult> {
  const started = Date.now();
  const perSource: RefillSourceResult[] = [];
  let ingestedTotal = 0;

  for (const source of opts.sources) {
    if (source.startsWith("twitter:")) {
      const handle = source.slice("twitter:".length);
      try {
        const items = await collectFromXHandlesBrowser({
          handles: [handle],
          tier: opts.twitterTier ?? "standard",
          from: opts.from,
          to: opts.to,
        });
        const ingested = await writeCollectedItems(items);
        perSource.push({
          source,
          type: "social",
          fetched: items.length,
          ingested,
        });
        ingestedTotal += ingested;
      } catch (err) {
        log.warn("refill_handle_failed", {
          handle,
          err: err instanceof Error ? err.message : String(err),
        });
        perSource.push({
          source,
          type: "social",
          fetched: 0,
          ingested: 0,
          error: err instanceof Error ? err.message : String(err),
        });
      }
      await sleep(opts.tailHandleMs);
      continue;
    }

    // Web source — only gov hosts are valid here. The publisher-blocklist
    // gate at the persist boundary will drop anything else.
    const url = source.startsWith("http") ? source : `https://${source}`;
    try {
      const items = await collectFromBrowserHarness({
        urls: [url],
        tier: "standard",
      });
      const ingested = await writeCollectedItems(items);
      perSource.push({
        source,
        type: "web",
        fetched: items.length,
        ingested,
      });
      ingestedTotal += ingested;
    } catch (err) {
      log.warn("refill_web_failed", {
        source,
        err: err instanceof Error ? err.message : String(err),
      });
      perSource.push({
        source,
        type: "web",
        fetched: 0,
        ingested: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    await sleep(opts.tailHandleMs);
  }

  if (opts.tailCycleMs > 0) await sleep(opts.tailCycleMs);

  return {
    from: opts.from,
    to: opts.to,
    sources_total: opts.sources.length,
    ingested_total: ingestedTotal,
    per_source: perSource,
    duration_ms: Date.now() - started,
  };
}
