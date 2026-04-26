// [claude-code 2026-04-19] S27-T7 (W2d): Always-On News Worker entrypoint.
// Sibling process to backend-hono. HTTP surface is /healthz only — all data
// flow is Supabase-coupled (riskflow_items + news_worker_heartbeats). Kept
// alive by launchd (local) + Fly restart_policy (cloud).

import "dotenv/config";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import {
  startScheduler,
  stopScheduler,
  getSchedulerSnapshot,
} from "./scheduler.js";
// [claude-code 2026-04-25] S40-P2: contract assertion + watchdog
import { assertNewsWorkerContract } from "./boot.js";
import { NEWS_WORKER_CONTRACT } from "./contract.js";
import { startNewsWorkerWatchdog } from "./watchdog.js";
// [claude-code 2026-04-25] S40-P3: Twitter streaming watcher (Browserbase XHR intercept)
import { startTwitterStreamingWatcher } from "../../services/twitter/streaming-watcher.js";

const PORT = Number(process.env.NEWS_WORKER_PORT ?? 8082);
const START_AT = new Date().toISOString();

const log = (stage: string, payload: Record<string, unknown> = {}) => {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      service: "news-worker",
      stage,
      ...payload,
    }),
  );
};

async function main() {
  log("boot", {
    port: PORT,
    writes_enabled: process.env.FLAG_NEWS_WORKER_WRITES_RISKFLOW === "true",
  });

  // [claude-code 2026-04-25] S40-P2: contract assertion runs BEFORE the
  // scheduler so any drift is logged + auto-restored before the first tick.
  await assertNewsWorkerContract({
    BREAKING_INTERVAL_MS: NEWS_WORKER_CONTRACT.BREAKING_INTERVAL_MS,
    STANDARD_INTERVAL_MS: NEWS_WORKER_CONTRACT.STANDARD_INTERVAL_MS,
  }).catch((err) => log("contract_assertion_error", { error: String(err) }));

  startScheduler();

  // [claude-code 2026-04-25] S40-P2: watchdog. Pings /api/riskflow/health
  // (via direct Supabase read) every 60s; restarts process if stale > 5min.
  startNewsWorkerWatchdog();

  // [claude-code 2026-04-25] S40-P3: Twitter streaming watcher — Browserbase
  // Playwright + GraphQL XHR intercept on UserTweets/HomeLatestTimeline.
  startTwitterStreamingWatcher().catch((err) =>
    log("twitter_streaming_boot_error", {
      error: err instanceof Error ? err.message : String(err),
    }),
  );

  const app = new Hono();

  app.get("/healthz", (c) => {
    const snapshot = getSchedulerSnapshot();
    return c.json({
      ok: true,
      service: "news-worker",
      started_at: START_AT,
      port: PORT,
      ...snapshot,
    });
  });

  app.get("/", (c) =>
    c.json({
      service: "news-worker",
      docs: "This worker writes to Supabase. Only /healthz is served over HTTP.",
    }),
  );

  serve({ fetch: app.fetch, port: PORT }, (info) => {
    log("http_ready", { port: info.port });
  });

  const shutdown = async (signal: string) => {
    log("shutdown", { signal });
    await stopScheduler();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  log("boot_error", {
    error: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});
