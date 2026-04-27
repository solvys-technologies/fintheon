// [claude-code 2026-04-19] S27-T7 (W2d): tier coordinators — compose source
// collectors and hand off to persist.ts. Per-source failures are isolated so
// one bad source never kills the tier (AgentReach pattern).
// [claude-code 2026-04-24] S34-T5: add DB-driven handle collectors — Wire in
// Breaking tier, Macro in Standard tier — sourced from riskflow_source_accounts
// via source-accounts-service (30s cache). Closes the Refinement Engine loop.
// [claude-code 2026-04-26] S46.1: BREAKING TIER IS TWITTER-ONLY. Reuters/
// Bloomberg URLs and RSS feeds removed permanently — they are noise, not signal.
// The only breaking-tier sources are the Refinement Engine wire handles
// (riskflow_source_accounts.category = 'Wire'). Standard tier remains
// government data + Exa (gov-only sites + macro keywords).

import { collectFromBrowserHarness } from "./browser-harness.js";
import { collectFromExa } from "./exa.js";
import { collectFromAgentReach } from "./agent-reach.js";
import { writeCollectedItems } from "../persist.js";
import {
  getWireHandles,
  getMacroHandles,
  getActiveAccounts,
} from "../../../services/source-accounts/source-accounts-service.js";
import type { CollectedNewsItem } from "./types.js";

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
        service: "news-worker",
        stage: "collector_error",
        source: label,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return { items: [], errors: 1 };
  }
}

// [claude-code 2026-04-26] Returns every active handle in the Refinement Engine
// — Wire + OSINT + Geopolitical + Macro + Custom. Breaking tier hits ALL of
// them so Iran/Trump/geopolitics tape lands in the feed alongside Wire flashes.
async function getAllRefinementHandles(): Promise<string[]> {
  const accounts = await getActiveAccounts();
  return accounts.map((a) => a.handle);
}

export async function runBreakingTier(): Promise<TierRunResult> {
  const results = await Promise.all([
    // [claude-code 2026-04-26] Twitter-only breaking tier. Wire handles get
    // their own dedicated pull so Wire latency is measurable per source; the
    // wider OSINT/Geopolitical/Macro pull catches everything else.
    safeCollect("agent-reach:wire-handles", async () => {
      const handles = await getWireHandles();
      if (handles.length === 0) return [];
      return collectFromAgentReach({ handles, tier: "breaking" });
    }),
    safeCollect("agent-reach:all-refinement-handles", async () => {
      const handles = await getAllRefinementHandles();
      if (handles.length === 0) return [];
      return collectFromAgentReach({ handles, tier: "breaking" });
    }),
  ]);

  const items = results.flatMap((r) => r.items);
  const errors = results.reduce((sum, r) => sum + r.errors, 0);
  const ingested = await writeCollectedItems(items);
  return { ingested, errors };
}

export async function runStandardTier(): Promise<TierRunResult> {
  const results = await Promise.all([
    // [claude-code 2026-04-26] Standard tier is government-data only. SEC EDGAR
    // + Federal Reserve press are TP-approved off-Internet sources.
    safeCollect("browser-harness", () =>
      collectFromBrowserHarness({
        urls: [
          "https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent",
          "https://www.federalreserve.gov/newsevents/pressreleases.htm",
        ],
        tier: "standard",
      }),
    ),
    safeCollect("exa", () =>
      collectFromExa({
        query: "macro policy OR FOMC OR Treasury OR inflation headline",
        tier: "standard",
      }),
    ),
    // [claude-code 2026-04-26] Government RSS only — SEC + Treasury + Fed +
    // BLS + FRED. No mainstream wire feeds.
    safeCollect("agent-reach", () =>
      collectFromAgentReach({
        rssFeeds: [
          "https://www.sec.gov/rss/news/press.xml",
          "https://home.treasury.gov/news/press-releases/feed",
          "https://www.federalreserve.gov/feeds/press_all.xml",
          "https://www.federalreserve.gov/feeds/speeches.xml",
          "https://www.federalreserve.gov/feeds/press_monetary.xml",
          "https://www.bls.gov/feed/news_release.rss",
          "https://www.bls.gov/feed/bls_latest.rss",
          "https://fredblog.stlouisfed.org/feed/",
        ],
        tier: "standard",
      }),
    ),
    safeCollect("agent-reach:macro-handles", async () => {
      const handles = await getMacroHandles();
      if (handles.length === 0) return [];
      return collectFromAgentReach({ handles, tier: "standard" });
    }),
  ]);

  const items = results.flatMap((r) => r.items);
  const errors = results.reduce((sum, r) => sum + r.errors, 0);
  const ingested = await writeCollectedItems(items);
  return { ingested, errors };
}
