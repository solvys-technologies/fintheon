// [claude-code 2026-04-24] S35-T10: renamed dir from workers/news-worker. RiskFlow Worker
//   is the new infra label; semantics unchanged. Env vars RISKFLOW_WORKER_PORT /
//   FLAG_RISKFLOW_WORKER_WRITES_RISKFLOW with legacy NEWS_WORKER_* fallback (sunset 2026-05-08).
// [claude-code 2026-04-19] S27-T7 (W2d): Always-On RiskFlow Worker entrypoint.
// Sibling process to backend-hono. HTTP surface is /healthz only — all data
// flow is Supabase-coupled (riskflow_items + riskflow_worker_heartbeats). Kept
// alive by launchd (local) + Fly restart_policy (cloud).

import "dotenv/config";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import {
  startScheduler,
  stopScheduler,
  getSchedulerSnapshot,
} from "./scheduler.js";

const PORT = Number(
  process.env.RISKFLOW_WORKER_PORT ?? process.env.NEWS_WORKER_PORT ?? 8082,
);
const WRITES_ENABLED =
  (process.env.FLAG_RISKFLOW_WORKER_WRITES_RISKFLOW ??
    process.env.FLAG_NEWS_WORKER_WRITES_RISKFLOW) === "true";
const START_AT = new Date().toISOString();

const log = (stage: string, payload: Record<string, unknown> = {}) => {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      service: "riskflow-worker",
      stage,
      ...payload,
    }),
  );
};

async function main() {
  log("boot", {
    port: PORT,
    writes_enabled: WRITES_ENABLED,
  });

  startScheduler();

  const app = new Hono();

  app.get("/healthz", (c) => {
    const snapshot = getSchedulerSnapshot();
    return c.json({
      ok: true,
      service: "riskflow-worker",
      started_at: START_AT,
      port: PORT,
      ...snapshot,
    });
  });

  app.get("/", (c) =>
    c.json({
      service: "riskflow-worker",
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
