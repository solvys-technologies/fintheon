// [claude-code 2026-04-19] S28: In-process cron scheduler for the 3 mandatory news-worker audits.
//   Fires at 6:00am / 11:30am / 4:00pm America/New_York. Paused state honoured via routine_config
//   so operators can pause from the UI without a restart. Skips the run + logs if DB flags paused.

import cron from "node-cron";
import { createLogger } from "../../lib/logger.js";
import {
  NEWS_WORKER_AUDIT_IDS,
  getRoutine,
  type NewsWorkerAuditId,
} from "../routines/registry.js";
import { runNewsWorkerAudit } from "../routines/handlers/news-worker-audit.js";
import { getConfig } from "../routines/state-store.js";

const log = createLogger("NewsWorkerAuditCron");

interface AuditJob {
  triggerId: NewsWorkerAuditId;
  cron: string;
  label: string;
}

const JOBS: AuditJob[] = [
  {
    triggerId: NEWS_WORKER_AUDIT_IDS.morning,
    cron: "0 6 * * *",
    label: "Morning Open (6:00am ET)",
  },
  {
    triggerId: NEWS_WORKER_AUDIT_IDS.midday,
    cron: "30 11 * * *",
    label: "Midday (11:30am ET)",
  },
  {
    triggerId: NEWS_WORKER_AUDIT_IDS.close,
    cron: "0 16 * * *",
    label: "Close (4:00pm ET)",
  },
];

let tasks: cron.ScheduledTask[] = [];
let running = false;

async function fireAudit(job: AuditJob): Promise<void> {
  const def = getRoutine(job.triggerId);
  if (!def) {
    log.warn(`Unknown routine ${job.triggerId} — audit skipped`);
    return;
  }

  const cfg = await getConfig(job.triggerId).catch(() => null);
  if (cfg?.paused) {
    log.info(`${def.name} paused by operator — skipping scheduled run`);
    return;
  }

  try {
    const result = await runNewsWorkerAudit({
      auditName: def.name,
      triggerId: def.triggerId,
    });
    log.info(`${def.name} complete`, {
      finalStatus: result.snapshot.finalStatus,
      heal: result.snapshot.healActions,
      reasons: result.snapshot.reasons,
    });
  } catch (err) {
    log.error(`${def.name} threw — audit did not complete`, {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export function startNewsWorkerAuditScheduler(): void {
  if (running) return;
  if (process.env.NEWS_WORKER_AUDIT_ENABLED === "false") {
    log.info(
      "News worker audit scheduler disabled via NEWS_WORKER_AUDIT_ENABLED=false",
    );
    return;
  }

  for (const job of JOBS) {
    const task = cron.schedule(
      job.cron,
      () => {
        fireAudit(job).catch((err) =>
          log.warn("Cron tick failed (swallowed)", {
            triggerId: job.triggerId,
            error: String(err),
          }),
        );
      },
      { timezone: "America/New_York" },
    );
    tasks.push(task);
    log.info(`Registered: ${job.label} (${job.cron} America/New_York)`);
  }

  running = true;
  log.info(`Started ${tasks.length} news-worker audit cron jobs`);
}

export function stopNewsWorkerAuditScheduler(): void {
  if (!running) return;
  for (const t of tasks) t.stop();
  tasks = [];
  running = false;
  log.info("Stopped news-worker audit scheduler");
}

export function isNewsWorkerAuditSchedulerActive(): boolean {
  return running;
}
