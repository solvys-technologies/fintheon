// [claude-code 2026-04-25] S40-P3: DEPRECATED — agent-reach as a news-worker
// source has been retired. Twitter intake now flows through
// services/twitter/streaming-watcher.ts (Browserbase XHR intercept) +
// services/twitter/rettiwt-fallback.ts. Calling collectFromAgentReach throws,
// which surfaces any stale wiring as a loud test/build failure rather than a
// silent ingest gap.
//
// Note: the underlying services/agent-reach-service.ts (RSS + HTML scraper)
// is NOT retired — fiscal-sources/, exa-scheduled-monitor.ts, and the riskflow
// agent-reach-poller still use it for non-Twitter scraping.

import type { CollectedNewsItem, NewsTier } from "./types.js";

interface CollectOpts {
  rssFeeds?: string[];
  handles?: string[];
  tier: NewsTier;
  enrich?: boolean;
}

export async function collectFromAgentReach(
  _opts: CollectOpts,
): Promise<CollectedNewsItem[]> {
  throw new Error(
    "agent-reach retired in S40 — use services/twitter/pipeline.ts (Browserbase XHR + rettiwt fallback) for Twitter intake",
  );
}
