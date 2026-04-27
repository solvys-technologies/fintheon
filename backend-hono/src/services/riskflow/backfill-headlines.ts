// [claude-code 2026-04-26] S35-cleanup: high/critical RiskFlow headline backfill
// for windows where the news-worker went silent (e.g. 2026-04-04..05, 04-09,
// 04-24..25). For each silent day in [from, to], runs Exa search for a fixed
// macro query menu (Fed/ECB/BOJ/OPEC/geopolitics/CPI/jobs), writes the hits
// into raw_riskflow_items with published_at pinned to the silent day, then
// kicks the central scorer so the items move to scored_riskflow_items with
// real iv_scores. Idempotent on the raw layer (tweet_id is sha1 of url+title).

import { createHash } from "node:crypto";
import { exaSearch, isExaAvailable } from "../exa-service.js";
import { writeRawItems } from "../supabase-service.js";
import { scoringCycle } from "./central-scorer.js";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("RiskFlowBackfillHeadlines");

// [claude-code 2026-04-26] S46.1: widened to cover the Iran/Israel ceasefire
// surface and Trump-assassination-attempt arc TP says he was missing, plus the
// macro/Fed/BLS/Treasury core. Publisher-blocklist runs at writeRawItems so
// mainstream-media hits Exa returns are dropped automatically.
const DEFAULT_QUERIES: string[] = [
  // Geopolitics (Iran/Israel ceasefire + Trump assassination arc)
  "Iran Israel ceasefire negotiations tape",
  "Iran Israel war oil supply Strait of Hormuz",
  "Trump assassination attempt rally shooting",
  "Trump rally security incident gunman",
  "Middle East ceasefire Hamas Hezbollah",
  "Iran nuclear program enrichment IAEA",
  // Central banks
  "Federal Reserve interest rate decision Powell FOMC",
  "ECB rate decision Lagarde inflation eurozone",
  "Bank of Japan policy yen intervention Ueda",
  "China PBOC stimulus yuan",
  // US data
  "US CPI inflation report consumer prices",
  "US nonfarm payrolls jobs unemployment BLS",
  "US PPI producer price index",
  "Treasury yields 10-year auction",
  // Energy + earnings
  "OPEC oil production cut Saudi crude",
  "S&P 500 earnings guidance megacap",
];

const RESULTS_PER_QUERY = 8;

function dayBetween(fromISO: string, toISO: string): string[] {
  const out: string[] = [];
  const start = new Date(`${fromISO}T00:00:00Z`);
  const end = new Date(`${toISO}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return out;
  for (
    let d = new Date(start);
    d.getTime() <= end.getTime();
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function makeTweetId(url: string, title: string, day: string): string {
  return (
    "exa-bf-" +
    createHash("sha1")
      .update(`${day}::${url}::${title}`)
      .digest("hex")
      .slice(0, 18)
  );
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

export interface BackfillHeadlinesResult {
  from: string;
  to: string;
  days: number;
  queriesPerDay: number;
  exaHits: number;
  rawWritten: number;
  scoringCycles: number;
  scoredWritten: number;
}

export async function backfillRiskFlowHeadlines(opts: {
  from: string;
  to: string;
  queries?: string[];
}): Promise<BackfillHeadlinesResult> {
  const days = dayBetween(opts.from, opts.to);
  const queries = opts.queries?.length ? opts.queries : DEFAULT_QUERIES;
  const result: BackfillHeadlinesResult = {
    from: opts.from,
    to: opts.to,
    days: days.length,
    queriesPerDay: queries.length,
    exaHits: 0,
    rawWritten: 0,
    scoringCycles: 0,
    scoredWritten: 0,
  };

  // [claude-code 2026-04-27] S46.4 hotfix: gated behind EXA_POLLING_ENABLED
  // per feedback_exa_off.md. Don't call exaSearch from backfill paths until
  // TP says "turn Exa back on".
  if (process.env.EXA_POLLING_ENABLED !== "true") {
    log.warn(
      "EXA_POLLING_ENABLED is not 'true' — backfill is a no-op until TP re-enables Exa",
    );
    return result;
  }
  if (!isExaAvailable()) {
    log.warn("EXA_API_KEY not set — cannot backfill headlines");
    return result;
  }

  for (const day of days) {
    const dayItems = new Map<
      string,
      Parameters<typeof writeRawItems>[0][number]
    >();

    for (const query of queries) {
      const dayQuery = `${query} (${day})`;
      const hits = await exaSearch(dayQuery, {
        numResults: RESULTS_PER_QUERY,
        type: "auto",
      });
      for (const hit of hits) {
        if (!hit.url || !hit.title) continue;
        // Accept hits within ±3 days of the silent day if Exa provides a
        // publishedDate; if none, accept (we pin published_at to the silent
        // day at insert time anyway). The earlier strict same-day match
        // eliminated all results because Exa rarely returns publishedDate
        // matching the exact requested day.
        if (hit.publishedDate) {
          const hitMs = Date.parse(hit.publishedDate);
          const dayMs = Date.parse(`${day}T12:00:00Z`);
          if (Number.isFinite(hitMs) && Number.isFinite(dayMs)) {
            const diffDays = Math.abs(hitMs - dayMs) / (24 * 60 * 60 * 1000);
            if (diffDays > 3) continue;
          }
        }
        const tweet_id = makeTweetId(hit.url, hit.title, day);
        if (dayItems.has(tweet_id)) continue;
        dayItems.set(tweet_id, {
          tweet_id,
          source: "Custom",
          headline: hit.title.slice(0, 500),
          body: hit.text ? hit.text.slice(0, 1500) : "",
          url: hit.url,
          image_url: null,
          symbols: [],
          tags: [`backfill:${day}`, `host:${hostnameOf(hit.url)}`],
          is_breaking: false,
          urgency: "normal",
          published_at: `${day}T12:00:00Z`,
          submitted_by: "riskflow-backfill",
        });
      }
    }

    result.exaHits += dayItems.size;
    if (dayItems.size === 0) continue;

    const written = await writeRawItems(Array.from(dayItems.values()));
    result.rawWritten += written;
    log.info("Backfill day complete", {
      day,
      hits: dayItems.size,
      written,
    });
  }

  // Run scoring cycles until raw inbox drains. Each cycle batches BATCH_SIZE
  // (defined in central-scorer); cap at 10 cycles to bound runtime.
  for (let i = 0; i < 10; i++) {
    const scoredCount = await scoringCycle();
    result.scoringCycles++;
    result.scoredWritten += scoredCount;
    if (scoredCount === 0) break;
  }

  log.info("RiskFlow headline backfill complete", { ...result });
  return result;
}
