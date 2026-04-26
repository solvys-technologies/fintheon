// [claude-code 2026-04-25] S40-P8: weekly megacap earnings refresh cron.
// Fires Sunday 22:00 America/New_York; refreshes next 90 days.
// Disable via env: MEGACAP_EARNINGS_ENABLED=false.

import cron from "node-cron";
import { createLogger } from "../../lib/logger.js";
import { refreshMegacapEarnings } from "../earnings/megacap-fmp.js";

const log = createLogger("MegacapEarningsRefresh");

let task: cron.ScheduledTask | null = null;
let running = false;

export function startMegacapEarningsRefresh(): void {
  if (running) return;
  if (process.env.MEGACAP_EARNINGS_ENABLED === "false") {
    log.info("Disabled via MEGACAP_EARNINGS_ENABLED=false");
    return;
  }

  // Boot-time refresh (non-blocking) so a fresh env has earnings within minutes.
  refreshMegacapEarnings()
    .then((r) => log.info("Boot refresh complete", { ...r }))
    .catch((err) =>
      log.warn("Boot refresh threw (non-fatal)", { error: String(err) }),
    );

  task = cron.schedule(
    "0 22 * * 0", // Sun 22:00 ET
    () => {
      refreshMegacapEarnings()
        .then((r) => log.info("Weekly refresh complete", { ...r }))
        .catch((err) =>
          log.warn("Weekly refresh threw (swallowed)", { error: String(err) }),
        );
    },
    { timezone: "America/New_York" },
  );

  running = true;
  log.info("Started — Sunday 22:00 America/New_York");
}

export function stopMegacapEarningsRefresh(): void {
  if (!running) return;
  task?.stop();
  task = null;
  running = false;
  log.info("Stopped");
}

export function isMegacapEarningsRefreshActive(): boolean {
  return running;
}
