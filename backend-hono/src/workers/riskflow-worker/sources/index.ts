// [claude-code 2026-04-27] S46.4 source narrowing per TP:
//   - SEC EDGAR + Treasury press REMOVED from standard tier.
//   - Exa STRIPPED entirely (worker no longer imports the Exa collector;
//     sources/exa.ts deleted in v5.33.2 per TP "turn off Exa completely").
//   - Standard tier .gov set narrowed to TP-approved trio:
//       1) COT (Commitment of Traders) — CFTC weekly Friday 15:30 ET via
//          browser-harness (HTML page; no clean RSS).
//       2) FOMC Minutes — federalreserve.gov/feeds/press_monetary.xml,
//          post-filtered to titles starting with "Minutes of the Federal
//          Open Market Committee" (drops every other press release).
//       3) Speech transcripts — federalreserve.gov/feeds/speeches.xml, full feed.
//   - Macro X-handle path unchanged.
// [claude-code 2026-04-26] Removed direct mainstream-media scrape URLs from
// breaking tier (reuters.com, bloomberg.com browser-harness + RSS). Policy:
// no website pulls from mainstream media. Twitter wire-handles + .gov + bank
// research are the only intake. Standard tier kept .gov / Treasury / Exa
// unchanged. Mainstream content still flows through curated Twitter relays
// when those handles re-quote a headline.
// [claude-code 2026-04-24] S35-T10: renamed dir from workers/news-worker. Tier-coordinator
//   semantics unchanged; service log strings now emit "riskflow-worker".
// [claude-code 2026-04-29] Rettiwt + Agent Reach removed from active worker
// composition. X uses browser-harness/browser-use first; official gov RSS has
// its own collector so no retired Nitter/RSS path can leak back in.
// [claude-code 2026-04-19] S27-T7 (W2d): tier coordinators — compose source
// collectors and hand off to persist.ts.
// [claude-code 2026-04-24] S34-T5: add DB-driven handle collectors — Wire in
// Breaking tier, Macro in Standard tier — sourced from riskflow_source_accounts
// via source-accounts-service (30s cache). Closes the Refinement Engine loop.

import { collectFromBrowserHarness } from "./browser-harness.js";
import { collectFromOfficialGovRss } from "./official-gov-rss.js";
import { collectFromXHandlesBrowser } from "./x-handles-browser.js";
import { writeCollectedItems } from "../persist.js";
import {
  getBrowserHandles,
} from "../../../services/source-accounts/source-accounts-service.js";
import type { CollectedNewsItem } from "./types.js";
// [claude-code 2026-04-29] S48-T5: Kalshi whale-alert pipe wired into
// Standard tier. Pipeline-gated via ingest_pipeline_state so TP can kill
// the source from the Refinement Engine without a deploy.
import { pollKalshiWhaleAlerts } from "../../../services/riskflow/kalshi-feed-pipe.js";
import { isPipelineEnabled } from "../../../services/riskflow/pipeline-gate.js";

// FOMC Minutes title prefix — press_monetary.xml mixes minutes with every other
// monetary press release (intermeeting statements, FAQ updates, etc.). TP only
// wants the meeting minutes; drop the rest.
const FOMC_MINUTES_TITLE_PREFIX =
  "Minutes of the Federal Open Market Committee";

// CFTC Commitment of Traders weekly report — public HTML page updated Friday
// 15:30 ET. Browser-harness already strips boilerplate and pulls the body.
const COT_REPORT_URL = "https://www.cftc.gov/dea/futures/deacmesf.htm";

export interface TierRunResult {
  ingested: number;
  errors: number;
}

async function safeCollect(
  label: string,
  fn: () => Promise<CollectedNewsItem[]>,
): Promise<{ items: CollectedNewsItem[]; errors: number }> {
  try {
    const items = await fn();
    return { items, errors: 0 };
  } catch (err) {
    console.warn(
      JSON.stringify({
        ts: new Date().toISOString(),
        service: "riskflow-worker",
        stage: "collector_error",
        source: label,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return { items: [], errors: 1 };
  }
}

export async function runBreakingTier(): Promise<TierRunResult> {
  // Browser-harness / browser-use driven X.com scrape per curated handle.
  // Rettiwt and Agent Reach are not fallbacks.
  const wireHandles = await getBrowserHandles().catch(() => []);
  const primary = await safeCollect("x-handles-browser:wire", () =>
    collectFromXHandlesBrowser({ handles: wireHandles, tier: "breaking" }),
  );

  const items = primary.items;
  const errors = primary.errors;
  const ingested = await writeCollectedItems(items);
  return { ingested, errors };
}

export async function runStandardTier(): Promise<TierRunResult> {
  const results = await Promise.all([
    // [claude-code 2026-04-27] S46.4: only the COT weekly report is left from
    // the gov-website pulls. SEC EDGAR + Federal Reserve press-releases page
    // were noisy and overlap with the FOMC Minutes/Speech RSS we pull below;
    // SEC EDGAR + Treasury press dropped per TP. Keep the wrapper so the
    // browser-harness pool stays warm for COT.
    safeCollect("browser-harness:cot", () =>
      collectFromBrowserHarness({
        urls: [COT_REPORT_URL],
        tier: "standard",
      }),
    ),
    // [claude-code 2026-04-27] FOMC Minutes — pulled from press_monetary.xml
    // and post-filtered to titles starting with the canonical minutes prefix.
    // The press_monetary feed mixes minutes with intermeeting statements,
    // FAQ updates, and admin notes; TP only wants the actual meeting minutes.
    safeCollect("official-gov-rss:fomc-minutes", async () => {
      const items = await collectFromOfficialGovRss({
        feeds: ["https://www.federalreserve.gov/feeds/press_monetary.xml"],
        tier: "standard",
      });
      return items.filter((it) =>
        it.headline.startsWith(FOMC_MINUTES_TITLE_PREFIX),
      );
    }),
    // [claude-code 2026-04-27] Fed speech transcripts — full feed.
    safeCollect("official-gov-rss:fed-speeches", () =>
      collectFromOfficialGovRss({
        feeds: ["https://www.federalreserve.gov/feeds/speeches.xml"],
        tier: "standard",
      }),
    ),
    // Macro handles — browser-harness/browser-use only.
    safeCollect("x-handles-browser:macro", async () => {
      const handles = await getBrowserHandles();
      if (handles.length === 0) return [];
      return collectFromXHandlesBrowser({ handles, tier: "standard" });
    }),
    // S48-T5: Kalshi whale alerts (Econ & Politics only). Pipeline-gated.
    safeCollect("kalshi-whale", async () => {
      if (!(await isPipelineEnabled("kalshi-whale"))) return [];
      return pollKalshiWhaleAlerts();
    }),
  ]);

  const items = results.flatMap((r) => r.items);
  const errors = results.reduce((sum, r) => sum + r.errors, 0);
  const ingested = await writeCollectedItems(items);
  return { ingested, errors };
}
