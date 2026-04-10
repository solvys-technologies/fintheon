// [claude-code 2026-03-24] VIX-triggered rescore engine — listens for spike/velocity/regime triggers, rescores with cooldown
import { onVIXTrigger, type VIXTrigger } from "../vix-service.js";
import { rescoreCycle } from "./central-scorer.js";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("VIXRescore");
const RESCORE_COOLDOWN_MS = 120_000; // 2 min between rescores
let lastRescoreAt = 0;
let rescoreCount = 0;

function isOnCooldown(): boolean {
  return Date.now() - lastRescoreAt < RESCORE_COOLDOWN_MS;
}

export function initVIXRescore(): void {
  onVIXTrigger(async (trigger: VIXTrigger) => {
    if (isOnCooldown()) {
      const remaining = Math.round(
        (RESCORE_COOLDOWN_MS - (Date.now() - lastRescoreAt)) / 1000,
      );
      log.info(`Skipping rescore — cooldown (${remaining}s remaining)`);
      return;
    }

    log.info(
      `VIX trigger [${trigger.type}]: VIX ${trigger.vixLevel.toFixed(1)} — ${trigger.detail}`,
    );
    lastRescoreAt = Date.now();
    rescoreCount++;

    try {
      const updated = await rescoreCycle();
      log.info(`Rescore #${rescoreCount} complete: ${updated} items updated`);
    } catch (err) {
      log.error(`Rescore #${rescoreCount} failed`, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  log.info("Initialized — listening for spike/velocity/regime triggers");
}

export function getRescoreStats(): { count: number; lastAt: number } {
  return { count: rescoreCount, lastAt: lastRescoreAt };
}
