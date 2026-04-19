// [claude-code 2026-04-19] S27-T7 (W2d): tier coordinators — compose source
// collectors and hand off to persist.ts. Per-source failures are isolated so
// one bad source never kills the tier (AgentReach pattern).

import { collectFromBrowserHarness } from "./browser-harness.js";
import { collectFromExa } from "./exa.js";
import { collectFromAgentReach } from "./agent-reach.js";
import { writeCollectedItems } from "../persist.js";
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

export async function runBreakingTier(): Promise<TierRunResult> {
  const results = await Promise.all([
    safeCollect("browser-harness", () =>
      collectFromBrowserHarness({
        urls: [
          "https://www.reuters.com/markets/",
          "https://www.bloomberg.com/markets",
        ],
        tier: "breaking",
      }),
    ),
    safeCollect("agent-reach", () =>
      collectFromAgentReach({
        rssFeeds: [
          "https://feeds.reuters.com/reuters/marketsNews",
          "https://feeds.bloomberg.com/markets/news.rss",
        ],
        tier: "breaking",
      }),
    ),
  ]);

  const items = results.flatMap((r) => r.items);
  const errors = results.reduce((sum, r) => sum + r.errors, 0);
  const ingested = await writeCollectedItems(items);
  return { ingested, errors };
}

export async function runStandardTier(): Promise<TierRunResult> {
  const results = await Promise.all([
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
    safeCollect("agent-reach", () =>
      collectFromAgentReach({
        rssFeeds: [
          "https://www.sec.gov/rss/news/press.xml",
          "https://home.treasury.gov/news/press-releases/feed",
        ],
        tier: "standard",
      }),
    ),
  ]);

  const items = results.flatMap((r) => r.items);
  const errors = results.reduce((sum, r) => sum + r.errors, 0);
  const ingested = await writeCollectedItems(items);
  return { ingested, errors };
}
