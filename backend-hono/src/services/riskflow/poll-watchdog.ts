// [claude-code 2026-04-18] S25-T6: Poll watchdog — detects stalled sources and nudges them.
// Runs every 60s. If any critical source hasn't recorded a run in WARN_MS, log + one-shot tick.
// If stalled past CRITICAL_MS, stop+restart the poller.

import { createLogger } from "../../lib/logger.js";
import { getStatus } from "../health-registry.js";
import {
  AGENT_REACH_POLLER_NAME,
  agentReachTick,
  startAgentReachPoller,
  stopAgentReachPoller,
} from "./agent-reach-poller.js";

const log = createLogger("PollWatchdog");

const CHECK_INTERVAL_MS = 60_000;
const WARN_MS = 10 * 60_000; // 10 min — warn + soft nudge
const CRITICAL_MS = 20 * 60_000; // 20 min — stop/start the poller

interface WatchdogState {
  lastWarningAt: number;
  lastCriticalRecoveryAt: number;
}

const state: Record<string, WatchdogState> = {};

function getSourceAge(name: string): number | null {
  const { services } = getStatus();
  const entry = services.find((s) => s.name === name);
  if (!entry || !entry.lastRunAt) return null;
  return Date.now() - new Date(entry.lastRunAt).getTime();
}

async function checkAgentReach(): Promise<void> {
  const age = getSourceAge(AGENT_REACH_POLLER_NAME);
  const now = Date.now();
  if (!state[AGENT_REACH_POLLER_NAME]) {
    state[AGENT_REACH_POLLER_NAME] = {
      lastWarningAt: 0,
      lastCriticalRecoveryAt: 0,
    };
  }
  const s = state[AGENT_REACH_POLLER_NAME];

  // Never ran yet — wait one more cycle (could be boot)
  if (age === null) return;

  if (age > CRITICAL_MS) {
    // Avoid recovery thrash — only one restart per CRITICAL_MS window.
    if (now - s.lastCriticalRecoveryAt < CRITICAL_MS) return;
    s.lastCriticalRecoveryAt = now;
    log.error(
      `Agent Reach stalled >${CRITICAL_MS / 60_000}min — restarting poller`,
      { ageMs: age },
    );
    try {
      stopAgentReachPoller();
      startAgentReachPoller();
    } catch (err) {
      log.warn("Watchdog restart failed", { error: String(err) });
    }
    return;
  }

  if (age > WARN_MS) {
    if (now - s.lastWarningAt < WARN_MS) return;
    s.lastWarningAt = now;
    log.warn(
      `Agent Reach stalled >${WARN_MS / 60_000}min — nudging with one-shot tick`,
      { ageMs: age },
    );
    try {
      await agentReachTick();
    } catch (err) {
      log.warn("Watchdog soft-nudge tick failed", { error: String(err) });
    }
  }
}

let timer: ReturnType<typeof setInterval> | null = null;

export function startPollWatchdog(): void {
  if (timer) return;
  log.info(`Starting (check every ${CHECK_INTERVAL_MS / 1000}s)`);
  timer = setInterval(() => {
    checkAgentReach().catch((err) =>
      log.warn("Watchdog cycle failed (swallowed)", { error: String(err) }),
    );
  }, CHECK_INTERVAL_MS);
  timer.unref?.();
}

export function stopPollWatchdog(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
    log.info("Stopped");
  }
}
