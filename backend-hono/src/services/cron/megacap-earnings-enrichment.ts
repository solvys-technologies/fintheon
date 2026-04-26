// [claude-code 2026-04-25] S40-P8: post-print earnings enrichment.
// Every 5 minutes during market hours: scans earnings_events for rows where
// report_time has elapsed 5+ minutes ago and actual_eps is still null. For
// each, calls enrichEarningsActual(symbol, date) which hits FMP and fills
// actual_eps / beat_miss / surprise_percent. On success, fires a megacap
// analyst dispatch via the existing P7 path.
//
// Disable via env: MEGACAP_EARNINGS_ENRICHMENT_ENABLED=false.

// [claude-code 2026-04-26] S45.5/F1: import path FMP → megacap-orchestrator. Note that
// enrichEarningsActual is currently stubbed (returns ok:false) until either the
// FinancialDatasets MCP path is wired or TP greenlights an actuals source.
import cron from "node-cron";
import { sql, isDatabaseAvailable } from "../../config/database.js";
import { createLogger } from "../../lib/logger.js";
import { enrichEarningsActual } from "../earnings/megacap-orchestrator.js";
import { triggerMegacapAnalyst } from "../analysts/megacap-analyst.js";
import { isMegacap, type MegacapTicker } from "../earnings/megacap-tickers.js";

const log = createLogger("MegacapEarningsEnrichment");

let task: cron.ScheduledTask | null = null;
let running = false;

interface PendingEarning {
  symbol: string;
  report_date: string;
  report_time: string | null;
}

function elapsedMsSinceReport(row: PendingEarning): number {
  // Best-effort ET conversion. Same shape used in agency-pollers/scheduler.
  const dateIso = row.report_date;
  const time =
    row.report_time === "BMO"
      ? "13:00"
      : row.report_time === "AMC"
        ? "20:30"
        : row.report_time && /^\d{2}:\d{2}/.test(row.report_time)
          ? row.report_time
          : "20:30";
  const fires = new Date(`${dateIso}T${time}:00-04:00`);
  return Date.now() - fires.getTime();
}

async function tick(): Promise<void> {
  if (!isDatabaseAvailable() || !sql) return;
  const horizonStart = new Date(
    Date.now() - 6 * 60 * 60 * 1000, // last 6h window
  )
    .toISOString()
    .slice(0, 10);
  try {
    const rows = (await sql`
      SELECT symbol, report_date, report_time
      FROM earnings_events
      WHERE in_ndx = TRUE
        AND in_spx = TRUE
        AND actual_eps IS NULL
        AND report_date >= ${horizonStart}
        AND report_date <= ${new Date().toISOString().slice(0, 10)}
    `) as unknown as PendingEarning[];

    for (const row of rows) {
      const elapsed = elapsedMsSinceReport(row);
      // T+5 min < elapsed < T+6h: in the enrichment window.
      if (elapsed < 5 * 60 * 1000) continue;
      if (elapsed > 6 * 60 * 60 * 1000) continue;
      const result = await enrichEarningsActual(row.symbol, row.report_date);
      if (!result.ok) {
        log.info("Enrichment skipped", {
          symbol: row.symbol,
          reportDate: row.report_date,
          reason: result.reason,
        });
        continue;
      }
      log.info("Earnings actual enriched", {
        symbol: row.symbol,
        reportDate: row.report_date,
      });
      // P7 dispatch: now that the actual is in, fire the megacap analyst.
      if (isMegacap(row.symbol)) {
        await triggerMegacapAnalyst({
          source: "earnings",
          symbol: row.symbol as MegacapTicker,
          headline: `${row.symbol} earnings actual landed`,
          riskType: "earnings",
        }).catch((err) =>
          log.warn("Megacap analyst dispatch threw (swallowed)", {
            error: String(err),
          }),
        );
      }
    }
  } catch (err) {
    log.warn("Enrichment tick threw (swallowed)", { error: String(err) });
  }
}

export function startMegacapEarningsEnrichment(): void {
  if (running) return;
  if (process.env.MEGACAP_EARNINGS_ENRICHMENT_ENABLED === "false") {
    log.info("Disabled via MEGACAP_EARNINGS_ENRICHMENT_ENABLED=false");
    return;
  }
  task = cron.schedule(
    "*/5 * * * *",
    () => {
      tick().catch((err) =>
        log.warn("Cron tick threw (swallowed)", { error: String(err) }),
      );
    },
    { timezone: "America/New_York" },
  );
  running = true;
  log.info("Started — every 5 minutes (America/New_York)");
}

export function stopMegacapEarningsEnrichment(): void {
  if (!running) return;
  task?.stop();
  task = null;
  running = false;
}
