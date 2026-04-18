// [claude-code 2026-04-04] Harper Autonomous — barrel export + initialization

import {
  startLoop,
  stopLoop,
  isAlive,
  getStatus,
  enqueueTask,
  triggerHeartbeat,
} from "./loop-manager.js";
import { startHeartbeat, stopHeartbeat } from "./heartbeat.js";
import {
  writeJournalEntry,
  getRecentEntries,
  searchJournal,
  getEntriesByTags,
} from "./journal-store.js";
import {
  writeOpsEntry,
  getOpsFeed,
  getPendingApprovals,
  updateApproval,
  getOpsStatus,
  opsEmitter,
} from "./ops-store.js";
import { buildAutonomousContext, type HarperTask } from "./context-builder.js";
import { onVIXTrigger } from "../vix-service.js";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("HarperAutonomous");

export {
  // Loop
  startLoop,
  stopLoop,
  isAlive,
  getStatus,
  enqueueTask,
  triggerHeartbeat,
  // Heartbeat
  startHeartbeat,
  stopHeartbeat,
  // Journal
  writeJournalEntry,
  getRecentEntries,
  searchJournal,
  getEntriesByTags,
  // Ops
  writeOpsEntry,
  getOpsFeed,
  getPendingApprovals,
  updateApproval,
  getOpsStatus,
  opsEmitter,
  // Context
  buildAutonomousContext,
  // Types
  type HarperTask,
};

/**
 * Boot the Harper autonomous system.
 *
 * [claude-code 2026-04-17] The local Claude CLI subprocess loop is retired.
 * Claude Code Routines (cloud, /schedule) now drive Harper Ops. The
 * HARPER_AUTONOMOUS_ENABLED gate remains as an emergency escape hatch but
 * prints a deprecation warning. Ops feed + status are now Routine-driven
 * via POST /api/harper-ops/feed.
 */
export async function bootHarperAutonomous(): Promise<void> {
  const enabled = process.env.HARPER_AUTONOMOUS_ENABLED === "true";

  if (!enabled) {
    log.info(
      "Harper autonomous loop disabled — Claude Code Routines drive Harper Ops. See docs/routines.md",
    );
    return;
  }

  log.warn(
    "HARPER_AUTONOMOUS_ENABLED=true — the local CLI loop is DEPRECATED. Prefer Claude Code Routines.",
  );

  try {
    await startLoop();
    startHeartbeat();

    // Register VIX spike trigger
    onVIXTrigger((trigger) => {
      if (trigger.type === "spike" || trigger.type === "regime_change") {
        enqueueTask({
          type: "vix-spike",
          payload: {
            vixLevel: trigger.vixLevel,
            previousLevel: trigger.previousLevel,
            triggerType: trigger.type,
            detail: trigger.detail,
          },
          priority: trigger.type === "regime_change" ? "high" : "normal",
        });
      }
    });

    log.info("Harper autonomous system fully operational");
  } catch (err) {
    log.error("Failed to boot Harper autonomous system", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Graceful shutdown.
 */
export function shutdownHarperAutonomous(): void {
  stopHeartbeat();
  stopLoop();
  log.info("Harper autonomous system shut down");
}
