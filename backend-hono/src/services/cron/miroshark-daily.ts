// [claude-code 2026-04-05] MiroShark auto-run every 6h (weekdays) to keep Sanctum fresh
import cron from "node-cron";
import {
  shouldAutoRun,
  startPrediction,
} from "../miroshark/miroshark-service.js";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("MiroSharkDaily");

let scheduled = false;

async function runMiroSharkUpdate(): Promise<void> {
  try {
    const { shouldRun, staleness } = await shouldAutoRun();
    if (!shouldRun) {
      log.info("Skipping — recent run exists", {
        staleness: `${staleness.toFixed(1)}h`,
      });
      return;
    }

    log.info("Starting scheduled auto-run");
    const result = await startPrediction(
      { lanes: [], catalysts: [], ropes: [] },
      undefined,
      "full-brief",
    );

    if ("error" in result) {
      log.error("Scheduled auto-run failed", { error: result.error });
    } else {
      log.info("Scheduled auto-run complete", {
        simulationId: result.simulationId,
      });
    }
  } catch (err) {
    log.error("MiroShark cron error", { error: String(err) });
  }
}

export function startMiroSharkDaily(): void {
  if (scheduled) return;
  scheduled = true;

  // Every 6h on weekdays: 00:00, 06:00, 12:00, 18:00 ET
  cron.schedule(
    "0 0,6,12,18 * * 1-5",
    async () => {
      log.info("MiroShark 6h cron triggered");
      await runMiroSharkUpdate();
    },
    { timezone: "America/New_York" },
  );

  log.info("MiroShark cron scheduled (every 6h, weekdays: 00/06/12/18 ET)");
}
