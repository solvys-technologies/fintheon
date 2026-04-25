// [claude-code 2026-04-24] S34-T6: Per-minute cron that sweeps raw_riskflow_items
// for "Actual"/"Forecast" keywords inside active econ event windows and promotes
// matches to scored_riskflow_items via econ-keyword-trigger. Pattern cloned from
// riskflow-worker-audit-scheduler — node-cron in-process, not an Anthropic Routine.

import cron from "node-cron";
import { createLogger } from "../../lib/logger.js";
import { runEconKeywordSweep } from "../riskflow/econ-keyword-trigger.js";

const log = createLogger("EconKeywordCron");

const TICK_CRON = "* * * * *";

let task: cron.ScheduledTask | null = null;
let running = false;
let lastResult: { scanned: number; promoted: number } | null = null;

async function tick(): Promise<void> {
  try {
    const result = await runEconKeywordSweep();
    lastResult = result;
    if (result.promoted > 0 || result.scanned > 0) {
      log.info("Keyword sweep tick", result);
    }
  } catch (err) {
    log.error("Keyword sweep tick threw", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export function startEconKeywordScheduler(): void {
  if (running) return;
  if (process.env.ECON_KEYWORD_TRIGGER_ENABLED === "false") {
    log.info("Disabled via ECON_KEYWORD_TRIGGER_ENABLED=false");
    return;
  }

  task = cron.schedule(
    TICK_CRON,
    () => {
      tick().catch((err) =>
        log.warn("Cron tick failed (swallowed)", { error: String(err) }),
      );
    },
    { timezone: "America/New_York" },
  );
  running = true;
  log.info(`Registered econ keyword sweep (${TICK_CRON} America/New_York)`);
}

export function stopEconKeywordScheduler(): void {
  if (!running) return;
  task?.stop();
  task = null;
  running = false;
  log.info("Stopped econ keyword scheduler");
}

export function isEconKeywordSchedulerActive(): boolean {
  return running;
}

export function getLastEconKeywordResult(): {
  scanned: number;
  promoted: number;
} | null {
  return lastResult;
}
