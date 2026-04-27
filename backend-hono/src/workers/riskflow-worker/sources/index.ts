// [claude-code 2026-04-26] Removed direct mainstream-media scrape URLs from
// breaking tier (reuters.com, bloomberg.com browser-harness + RSS). Policy:
// no website pulls from mainstream media. Twitter wire-handles + .gov + bank
// research are the only intake. Standard tier kept .gov / Treasury / Exa
// unchanged. Mainstream content still flows through curated Twitter relays
// when those handles re-quote a headline.
// [claude-code 2026-04-24] S35-T10: renamed dir from workers/news-worker. Tier-coordinator
//   semantics unchanged; service log strings now emit "riskflow-worker".
// [claude-code 2026-04-19] S27-T7 (W2d): tier coordinators — compose source
// collectors and hand off to persist.ts. Per-source failures are isolated so
// one bad source never kills the tier (AgentReach pattern).
// [claude-code 2026-04-24] S34-T5: add DB-driven handle collectors — Wire in
// Breaking tier, Macro in Standard tier — sourced from riskflow_source_accounts
// via source-accounts-service (30s cache). Closes the Refinement Engine loop.

import { collectFromBrowserHarness } from "./browser-harness.js";
import { collectFromExa } from "./exa.js";
import { collectFromAgentReach } from "./agent-reach.js";
import { collectFromXHandlesBrowser } from "./x-handles-browser.js";
import { writeCollectedItems } from "../persist.js";
import {
  getWireHandles,
  getMacroHandles,
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
  // PRIMARY: Browserbase / Playwright-driven X.com timeline scrape per
  // curated handle. Public Nitter mirrors are mostly dead, so this is the
  // first attempt every tick. Returns tweet-granularity items keyed on
  // tweet_id for clean dedupe.
  const wireHandles = await getWireHandles().catch(() => []);
  const primary = await safeCollect("x-handles-browser:wire", () =>
    collectFromXHandlesBrowser({ handles: wireHandles, tier: "breaking" }),
  );

  // SECONDARY: agent-reach Nitter RSS — only fires if the primary returned
  // nothing for a handle (Playwright crash, X login wall, etc.). Idempotent
  // tweet_id collapsing means duplicates collapse if both win.
  const fallback =
    primary.items.length === 0 && wireHandles.length > 0
      ? await safeCollect("agent-reach:wire-handles", () =>
          collectFromAgentReach({ handles: wireHandles, tier: "breaking" }),
        )
      : { items: [] as CollectedNewsItem[], errors: 0 };

  const items = [...primary.items, ...fallback.items];
  const errors = primary.errors + fallback.errors;
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
    // PRIMARY for macro handles — Browserbase/Playwright. Falls through to
    // Nitter (next entry) only if the browser path returned nothing for a
    // handle.
    safeCollect("x-handles-browser:macro", async () => {
      const handles = await getMacroHandles();
      if (handles.length === 0) return [];
      return collectFromXHandlesBrowser({ handles, tier: "standard" });
    }),
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
