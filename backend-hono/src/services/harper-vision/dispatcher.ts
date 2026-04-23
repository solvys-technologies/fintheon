// [claude-code 2026-04-23] S32-T2 Harper Vision — trigger dispatch to boardroom
/**
 * Dispatches Harper Vision triggers to the boardroom as desk-agent interventions.
 * Rate-limited per user+trigger-type (10-min window) so a noisy scene cannot
 * flood the boardroom with repeats.
 */
import type { HarperVisionTrigger } from "../../types/harper-vision.js";
import { appendToBoardroom } from "../hermes-sessions.js";
import type { BoardroomAgent } from "../../types/boardroom.js";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("HarperVisionDispatcher");

const WINDOW_MS = 10 * 60 * 1000;

const AGENT_LABEL: Record<string, BoardroomAgent> = {
  feucht: "Feucht",
  oracle: "Oracle",
  herald: "Herald",
  consul: "Consul",
};

const lastDispatch = new Map<string, number>();

function rateLimitKey(userId: string, triggerType: string): string {
  return `${userId}:${triggerType}`;
}

function isRateLimited(userId: string, triggerType: string): boolean {
  const key = rateLimitKey(userId, triggerType);
  const last = lastDispatch.get(key);
  if (!last) return false;
  return Date.now() - last < WINDOW_MS;
}

function markDispatched(userId: string, triggerType: string): void {
  lastDispatch.set(rateLimitKey(userId, triggerType), Date.now());
}

export interface DispatchReport {
  dispatched: HarperVisionTrigger[];
  skipped: {
    trigger: HarperVisionTrigger;
    reason: "rate_limit" | "unknown_agent" | "post_failed";
  }[];
}

export async function dispatchTriggers(
  triggers: HarperVisionTrigger[],
  userId: string,
): Promise<DispatchReport> {
  const report: DispatchReport = { dispatched: [], skipped: [] };

  for (const trigger of triggers) {
    const agentLabel = AGENT_LABEL[trigger.agent];
    if (!agentLabel) {
      report.skipped.push({ trigger, reason: "unknown_agent" });
      continue;
    }

    if (isRateLimited(userId, trigger.type)) {
      report.skipped.push({ trigger, reason: "rate_limit" });
      continue;
    }

    const content = formatTriggerMessage(trigger, agentLabel);

    try {
      await appendToBoardroom(content, "assistant", {
        source: "harper-vision",
        agent: agentLabel,
        triggerType: trigger.type,
        confidence: trigger.confidence,
        userId,
      });
      markDispatched(userId, trigger.type);
      report.dispatched.push(trigger);
    } catch (err) {
      log.warn("dispatch failed", {
        userId,
        triggerType: trigger.type,
        error: err instanceof Error ? err.message : String(err),
      });
      report.skipped.push({ trigger, reason: "post_failed" });
    }
  }

  return report;
}

function formatTriggerMessage(
  trigger: HarperVisionTrigger,
  agent: BoardroomAgent,
): string {
  const header = `[Harper Vision → ${agent}] ${trigger.type} (${(trigger.confidence * 100).toFixed(0)}%)`;
  const body = trigger.description?.trim() || "(no description)";
  return `${header}\n${body}`;
}
