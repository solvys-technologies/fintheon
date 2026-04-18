// [claude-code 2026-04-18] Backend lifecycle management — idle shutdown for routine-started instances.
// When the Electron app disconnects and the backend was started by a Claude Code routine,
// the app arms an idle timer. If no HTTP requests arrive within the timeout, the backend exits.
// Clamp: timeoutMs is now floored at 60s so a pathological/accidental 0 can't self-terminate
// on the first tick. Defence-in-depth beside the localhost guard on the route.

import { createLogger } from "../lib/logger.js";

const log = createLogger("Lifecycle");

const MIN_IDLE_TIMEOUT_MS = 60_000; // floor — prevents self-terminate on first tick

let lastActivityAt = Date.now();
let idleTimerId: ReturnType<typeof setInterval> | null = null;
let idleTimeoutMs = 0;
let isArmed = false;

/** Call on every HTTP request to track activity */
export function markActivity(): void {
  lastActivityAt = Date.now();
}

/** Get ms since last HTTP request */
export function getIdleDurationMs(): number {
  return Date.now() - lastActivityAt;
}

/**
 * Arm the idle shutdown timer.
 * Backend will exit after `timeoutMs` of no HTTP activity.
 * Called by Electron when closing if the backend was routine-started.
 */
export function armIdleShutdown(timeoutMs: number): void {
  if (idleTimerId) {
    clearInterval(idleTimerId);
  }

  idleTimeoutMs = Math.max(MIN_IDLE_TIMEOUT_MS, timeoutMs);
  isArmed = true;
  lastActivityAt = Date.now();

  log.info(
    `Idle shutdown armed: ${Math.round(idleTimeoutMs / 60000)}min timeout`,
  );

  // Check every 60s
  idleTimerId = setInterval(() => {
    const idle = getIdleDurationMs();
    if (idle >= idleTimeoutMs) {
      log.info(
        `Idle shutdown triggered after ${Math.round(idle / 60000)}min — exiting`,
      );
      // Give logs a moment to flush
      setTimeout(() => process.exit(0), 500);
    }
  }, 60_000);
  idleTimerId.unref?.();
}

/** Disarm the idle shutdown (e.g., app reconnected) */
export function disarmIdleShutdown(): void {
  if (idleTimerId) {
    clearInterval(idleTimerId);
    idleTimerId = null;
  }
  isArmed = false;
  idleTimeoutMs = 0;
  log.info("Idle shutdown disarmed");
}

/** Get current lifecycle state */
export function getLifecycleState(): {
  isArmed: boolean;
  idleTimeoutMs: number;
  idleDurationMs: number;
  lastActivityAt: string;
} {
  return {
    isArmed,
    idleTimeoutMs,
    idleDurationMs: getIdleDurationMs(),
    lastActivityAt: new Date(lastActivityAt).toISOString(),
  };
}
