// [claude-code 2026-04-26] S45-T1: Drift-monitor cron — every 15 minutes during
// session hours (08:00-17:00 ET, Mon-Fri). Invokes runDriftCycle which scans
// trades since last_seen, classifies each fill, and persists drift events.

import cron from "node-cron";
import { createLogger } from "../../lib/logger.js";
import { runDriftCycle } from "../desk-drift/drift-monitor.js";

const log = createLogger("DriftMonitorCron");

const SCHEDULE = "*/15 8-17 * * 1-5";

let task: cron.ScheduledTask | null = null;
let running = false;
let lastFiredAt: string | null = null;

async function tick(): Promise<void> {
  try {
    const events = await runDriftCycle();
    lastFiredAt = new Date().toISOString();
    if (events.length > 0) {
      log.info("Drift cycle fired", {
        eventCount: events.length,
        kinds: events.map((e) => e.kind),
      });
    }
  } catch (err) {
    log.error("Drift cycle threw", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export function startDriftMonitorCron(): void {
  if (running) return;
  if (process.env.DRIFT_MONITOR_CRON_ENABLED === "false") {
    log.info("Disabled via DRIFT_MONITOR_CRON_ENABLED=false");
    return;
  }

  task = cron.schedule(
    SCHEDULE,
    () => {
      tick().catch((err) =>
        log.warn("Drift tick failed (swallowed)", { error: String(err) }),
      );
    },
    { timezone: "America/New_York" },
  );
  running = true;
  log.info(`Registered Drift-monitor cron (${SCHEDULE} America/New_York)`);
}

export function stopDriftMonitorCron(): void {
  if (!running) return;
  task?.stop();
  task = null;
  running = false;
}

export function getLastDriftFiredAt(): string | null {
  return lastFiredAt;
}

export function isDriftMonitorCronActive(): boolean {
  return running;
}
