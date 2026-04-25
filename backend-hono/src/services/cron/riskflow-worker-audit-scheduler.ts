// [claude-code 2026-04-19] S28: In-process cron scheduler for the 3 mandatory news-worker audits.
//   Fires at 6:00am / 11:30am / 4:00pm America/New_York.
// [claude-code 2026-04-23] Routines Console retired — dropped the operator pause-check and
//   the routines/registry lookup. Constants inlined below. Disable via env flag
//   NEWS_WORKER_AUDIT_ENABLED=false (same as before).

import cron from "node-cron";
import { createLogger } from "../../lib/logger.js";
import { runNewsWorkerAudit } from "./news-worker-audit-handler.js";

const log = createLogger("NewsWorkerAuditCron");

interface AuditJob {
  triggerId: string;
  cron: string;
  label: string;
  auditName: string;
}

const JOBS: AuditJob[] = [
  {
    triggerId: "news_worker_audit_morning",
    cron: "0 6 * * *",
    label: "Morning Open (6:00am ET)",
    auditName: "News Worker Audit — Morning Open",
  },
  {
    triggerId: "news_worker_audit_midday",
    cron: "30 11 * * *",
    label: "Midday (11:30am ET)",
    auditName: "News Worker Audit — Midday",
  },
  {
    triggerId: "news_worker_audit_close",
    cron: "0 16 * * *",
    label: "Close (4:00pm ET)",
    auditName: "News Worker Audit — Close",
  },
];

let tasks: cron.ScheduledTask[] = [];
let running = false;

async function fireAudit(job: AuditJob): Promise<void> {
  try {
    const result = await runNewsWorkerAudit({
      auditName: job.auditName,
      triggerId: job.triggerId,
    });
    log.info(`${job.auditName} complete`, {
      finalStatus: result.snapshot.finalStatus,
      heal: result.snapshot.healActions,
      reasons: result.snapshot.reasons,
    });
  } catch (err) {
    log.error(`${job.auditName} threw — audit did not complete`, {
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
