// [claude-code 2026-04-19] S27-T7 (W2d): tier coordinators — compose source
// collectors and hand off to persist.ts. Per-source failures are isolated so
// one bad source never kills the tier (AgentReach pattern).
// [claude-code 2026-04-24] S34-T5: add DB-driven handle collectors — Wire in
// Breaking tier, Macro in Standard tier — sourced from riskflow_source_accounts
// via source-accounts-service (30s cache). Closes the Refinement Engine loop.
// [claude-code 2026-04-25] S40-P2/P3: Reuters/Bloomberg dropped from breaking
// (rate-limit pollution); agent-reach retired in Pillar 3 — all Twitter intake
// flows through services/twitter/streaming-watcher.ts (Browserbase XHR
// intercept) + services/twitter/rettiwt-fallback.ts. The handle helpers stay
// here as a thin adapter that shells out to the new Twitter pipeline.

import { collectFromBrowserHarness } from "./browser-harness.js";
import { collectFromExa } from "./exa.js";
import { writeCollectedItems } from "../persist.js";
import {
  getWireHandles,
  getMacroHandles,
} from "../../../services/source-accounts/source-accounts-service.js";
import {
  collectFromTwitterPipeline,
  type TwitterPipelineMode,
} from "../../../services/twitter/pipeline.js";
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
    // Browser harness: SEC + FOMC fast paths only. Reuters/Bloomberg dropped
    // (S40-P2) — they were eating browser-harness budget for headlines that
    // arrive faster via the Twitter wire pool anyway.
    safeCollect("browser-harness:fast", () =>
      collectFromBrowserHarness({
        urls: ["https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent"],
        tier: "breaking",
      }),
    ),
    // [S40-P3] Twitter pipeline — Browserbase XHR intercept primary,
    // rettiwt-api guest-mode fallback, $-flag commercial firehose emergency.
    safeCollect("twitter:wire", async () => {
      const handles = await getWireHandles();
      if (handles.length === 0) return [];
      return collectFromTwitterPipeline({ handles, tier: "breaking" });
    }),
    safeCollect("twitter:macro", async () => {
      // [S40-P2] Promoted to breaking — the 8 Macro handles drive the
      // econ-print storyline and beat any RSS feed by 5-10 seconds.
      const handles = await getMacroHandles();
      if (handles.length === 0) return [];
      return collectFromTwitterPipeline({ handles, tier: "breaking" });
    }),
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
    // Standard-tier Twitter handles cover lower-frequency commentators
    // (whose iv-score average is moderate). Keep the cadence at 1h.
    safeCollect("twitter:standard", async () => {
      const handles = await getMacroHandles();
      if (handles.length === 0) return [];
      return collectFromTwitterPipeline({
        handles,
        tier: "standard",
        mode: "fallback-only" as TwitterPipelineMode,
      });
    }),
  ]);

  const items = results.flatMap((r) => r.items);
  const errors = results.reduce((sum, r) => sum + r.errors, 0);
  const ingested = await writeCollectedItems(items);
  return { ingested, errors };
}
