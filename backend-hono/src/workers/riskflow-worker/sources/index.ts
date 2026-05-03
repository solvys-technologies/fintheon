// [claude-code 2026-05-03] Unified X tier: all handles (wire + commentary + macro)
// polled in one home-timeline pass, filtered post-extraction by handle-routing rules.
// Replaces the three separate tier collectors (breaking/commentary/standard X).
// Non-X standard-tier sources (COT, FOMC, Fed Speeches, Kalshi) kept separate.
//
// [claude-code 2026-04-27] S46.4 source narrowing per TP:
//   - SEC EDGAR + Treasury press REMOVED from standard tier.
//   - Exa STRIPPED entirely (worker no longer imports the Exa collector).
//   - Standard tier .gov set narrowed to TP-approved trio:
//       1) COT (Commitment of Traders) — CFTC weekly
//       2) FOMC Minutes — federalreserve.gov/feeds/press_monetary.xml
//       3) Speech transcripts — federalreserve.gov/feeds/speeches.xml
//   - Macro X-handle path unchanged.
// [claude-code 2026-04-26] Removed direct mainstream-media scrape URLs.
// [claude-code 2026-04-24] S35-T10: renamed dir from workers/news-worker.
// [claude-code 2026-04-24] S34-T5: add DB-driven handle collectors.
// [claude-code 2026-04-30] S55: Commentary tier added.
// [claude-code 2026-04-29] Rettiwt + Agent Reach removed from active worker composition.

import { collectFromBrowserHarness } from "./browser-harness.js";
import { collectFromOfficialGovRss } from "./official-gov-rss.js";
import { collectFromXHandlesBrowser } from "./x-handles-browser.js";
import { writeCollectedItems } from "../persist.js";
import { getBrowserHandles } from "../../../services/source-accounts/source-accounts-service.js";
import type { CollectedNewsItem } from "./types.js";
import { isPipelineEnabled } from "../../../services/riskflow/pipeline-gate.js";
import { pollKalshiWhaleAlerts } from "../../../services/riskflow/kalshi-feed-pipe.js";

const FOMC_MINUTES_TITLE_PREFIX =
  "Minutes of the Federal Open Market Committee";
const COT_REPORT_URL = "https://www.cftc.gov/dea/futures/deacmesf.htm";

export interface TierRunResult {
  ingested: number;
  errors: number;
}

async function safeCollect(
  label: string,
  fn: () => Promise<CollectedNewsItem[]>,
  timeoutMs = 90_000,
): Promise<{ items: CollectedNewsItem[]; errors: number }> {
  try {
    const items = await Promise.race([
      fn(),
      new Promise<CollectedNewsItem[]>((_, reject) =>
        setTimeout(
          () => reject(new Error(`collector timeout after ${timeoutMs}ms`)),
          timeoutMs,
        ),
      ),
    ]);
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

/**
 * Unified X tier: one home-timeline pass for all browser handles.
 * Content filtering via handle-routing.ts rules applied post-extraction.
 * Passes tier="unified" so the tier gating in collectFromXHandlesBrowser
 * lets all routing tiers through.
 */
export async function runUnifiedXTier(): Promise<TierRunResult> {
  const handles = await getBrowserHandles().catch(() => [] as string[]);
  if (handles.length === 0) {
    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        service: "riskflow-worker",
        stage: "unified_x_tier_empty",
        message: "No browser handles configured",
      }),
    );
    return { ingested: 0, errors: 0 };
  }

  const primary = await safeCollect("x-handles-browser:unified", () =>
    collectFromXHandlesBrowser({ handles, tier: "unified" }),
  );

  const ingested = await writeCollectedItems(primary.items);
  return { ingested, errors: primary.errors };
}

/**
 * Standard tier: non-X sources only (COT, FOMC, Fed Speeches, Kalshi).
 * X handles are now in the unified tier.
 */
export async function runStandardTier(): Promise<TierRunResult> {
  const results = await Promise.all([
    safeCollect("browser-harness:cot", () =>
      collectFromBrowserHarness({
        urls: [COT_REPORT_URL],
        tier: "standard",
      }),
    ),
    safeCollect("official-gov-rss:fomc-minutes", async () => {
      const items = await collectFromOfficialGovRss({
        feeds: ["https://www.federalreserve.gov/feeds/press_monetary.xml"],
        tier: "standard",
      });
      return items.filter((it) =>
        it.headline.startsWith(FOMC_MINUTES_TITLE_PREFIX),
      );
    }),
    safeCollect("official-gov-rss:fed-speeches", () =>
      collectFromOfficialGovRss({
        feeds: ["https://www.federalreserve.gov/feeds/speeches.xml"],
        tier: "standard",
      }),
    ),
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

// Legacy exports for backward compatibility during migration.
// These are no-op wrappers that log a warning — the scheduler now calls
// runUnifiedXTier directly. Remove after 2026-06-03.
export async function runBreakingTier(): Promise<TierRunResult> {
  console.warn(
    JSON.stringify({
      ts: new Date().toISOString(),
      service: "riskflow-worker",
      stage: "legacy_tier_call",
      tier: "breaking",
      message: "runBreakingTier is deprecated — use runUnifiedXTier",
    }),
  );
  return { ingested: 0, errors: 0 };
}

export async function runCommentaryTier(): Promise<TierRunResult> {
  console.warn(
    JSON.stringify({
      ts: new Date().toISOString(),
      service: "riskflow-worker",
      stage: "legacy_tier_call",
      tier: "commentary",
      message: "runCommentaryTier is deprecated — use runUnifiedXTier",
    }),
  );
  return { ingested: 0, errors: 0 };
}
