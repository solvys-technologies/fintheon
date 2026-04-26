// [claude-code 2026-04-25] S40-P2: news-worker maintenance crons.
//   - Hourly: soft-delete junk items (iv_score<3, age>24h, no tags)
//   - Daily 02:00 ET: hard-delete rows archived more than 7 days ago
//   - Daily 03:00 ET: auto-downweight noisy source accounts (rolling 7d iv avg)
//
// All disabled together via NEWS_WORKER_MAINTENANCE_ENABLED=false.

import cron from "node-cron";
import { sql, isDatabaseAvailable } from "../../config/database.js";
import { createLogger } from "../../lib/logger.js";
import {
  cleanupOldItems,
  hardDeleteArchivedItems,
} from "../riskflow/news-cache.js";

const log = createLogger("NewsWorkerMaintenance");

interface SourceRollingAvg {
  handle: string;
  avg_iv: number;
  sample: number;
}

let tasks: cron.ScheduledTask[] = [];
let running = false;

async function runAutoDownweight(): Promise<void> {
  if (!isDatabaseAvailable() || !sql) return;
  try {
    // Compute rolling 7-day avg iv_score per source-account handle. Match
    // by (source = 'twitter') AND (raw_data->>'username' = handle); fall
    // back to no-op when the join finds nothing.
    const rows = (await sql`
      SELECT
        sa.handle AS handle,
        COALESCE(AVG(nfi.iv_score), 0) AS avg_iv,
        COUNT(nfi.id) AS sample
      FROM riskflow_source_accounts sa
      LEFT JOIN news_feed_items nfi
        ON LOWER(nfi.raw_data->>'username') = LOWER(sa.handle)
        AND nfi.published_at > NOW() - INTERVAL '7 days'
        AND nfi.archived_at IS NULL
      WHERE sa.active = TRUE
      GROUP BY sa.handle
    `) as unknown as SourceRollingAvg[];

    let bumped = 0;
    let dropped = 0;
    for (const r of rows) {
      if (r.sample === 0) continue;
      const avg = Number(r.avg_iv);
      if (avg < 2) {
        await sql`
          UPDATE riskflow_source_accounts
          SET tier_weight = GREATEST(1, tier_weight - 1),
              noise_score = ${1 - avg / 10}
          WHERE handle = ${r.handle}
        `;
        dropped += 1;
      } else if (avg > 5) {
        await sql`
          UPDATE riskflow_source_accounts
          SET tier_weight = LEAST(10, tier_weight + 1)
          WHERE handle = ${r.handle}
        `;
        bumped += 1;
      }
    }
    log.info("Auto-downweight pass complete", {
      total: rows.length,
      bumped,
      dropped,
    });
  } catch (err) {
    log.warn("Auto-downweight threw (swallowed)", { error: String(err) });
  }
}

export function startNewsWorkerMaintenance(): void {
  if (running) return;
  if (process.env.NEWS_WORKER_MAINTENANCE_ENABLED === "false") {
    log.info("Disabled via NEWS_WORKER_MAINTENANCE_ENABLED=false");
    return;
  }

  // Hourly: soft-delete sweep
  tasks.push(
    cron.schedule(
      "0 * * * *",
      () => {
        cleanupOldItems(24)
          .then((archived) =>
            log.info("Hourly soft-delete sweep complete", { archived }),
          )
          .catch((err) =>
            log.warn("Hourly sweep threw (swallowed)", { error: String(err) }),
          );
      },
      { timezone: "America/New_York" },
    ),
  );

  // 02:00 ET: hard-delete rows archived > 7 days
  tasks.push(
    cron.schedule(
      "0 2 * * *",
      () => {
        hardDeleteArchivedItems(7)
          .then((deleted) =>
            log.info("Daily hard-delete sweep complete", { deleted }),
          )
          .catch((err) =>
            log.warn("Hard-delete sweep threw (swallowed)", {
              error: String(err),
            }),
          );
      },
      { timezone: "America/New_York" },
    ),
  );

  // 03:00 ET: auto-downweight noisy source accounts
  tasks.push(
    cron.schedule(
      "0 3 * * *",
      () => {
        runAutoDownweight().catch((err) =>
          log.warn("Auto-downweight threw (swallowed)", {
            error: String(err),
          }),
        );
      },
      { timezone: "America/New_York" },
    ),
  );

  running = true;
  log.info("Started — soft@:00, hard@02:00 ET, downweight@03:00 ET");
}

export function stopNewsWorkerMaintenance(): void {
  if (!running) return;
  for (const t of tasks) t.stop();
  tasks = [];
  running = false;
}
