// [claude-code 2026-04-18] A2: translate VIX regime-change triggers into push notifications
/**
 * Regime-change push subscriber
 *
 * Registers with `onVIXTrigger` (vix-service) and, on `regime_change` events,
 * fans out a notification via emit.ts. Fingerprint: `regime:<from>:<to>:<minuteBucket>`
 * dedups duplicate crossings fired within the same minute.
 *
 * low→normal is intentionally skipped — it's noise.
 */

import { createLogger } from "../../lib/logger.js";
import { onVIXTrigger, type VIXTrigger } from "../vix-service.js";
import { emitPushAndLog } from "./emit.js";
import type { Severity } from "../web-push-sender.js";

const log = createLogger("RegimePush");

const REGIME_SEVERITY: Record<string, Severity> = {
  low: "low",
  normal: "low",
  elevated: "medium",
  crisis: "critical",
};

function parseFromTo(detail: string): { from: string; to: string } | null {
  // detail format: "<prev> → <cur>"
  const m = /^(.+?)\s*→\s*(.+?)$/.exec(detail.trim());
  if (!m) return null;
  return { from: m[1].trim(), to: m[2].trim() };
}

function formatTitle(from: string, to: string, level: number): string {
  return `VIX regime → ${to}`;
}

function formatBody(
  from: string,
  to: string,
  level: number,
  prev: number,
): string {
  const dir = level >= prev ? "up" : "down";
  return `${from} → ${to} · VIX ${level.toFixed(1)} (was ${prev.toFixed(1)}, ${dir})`;
}

export function startRegimePushListener(): () => void {
  const unsub = onVIXTrigger((trigger: VIXTrigger) => {
    if (trigger.type !== "regime_change") return;
    const parsed = parseFromTo(trigger.detail);
    if (!parsed) return;
    const { from, to } = parsed;

    // Skip low→normal — baseline noise.
    if (from === "low" && to === "normal") return;

    const severity: Severity = REGIME_SEVERITY[to] ?? "medium";
    const minuteBucket = Math.floor(trigger.timestamp.getTime() / 60_000);

    void emitPushAndLog({
      userId: "all",
      category: "regimeActivations",
      severity,
      title: formatTitle(from, to, trigger.vixLevel),
      body: formatBody(from, to, trigger.vixLevel, trigger.previousLevel),
      url: "/strategium",
      fingerprint: `regime:${from}:${to}:${minuteBucket}`,
      metadata: {
        from,
        to,
        vixLevel: trigger.vixLevel,
        previousLevel: trigger.previousLevel,
      },
    }).catch((err) =>
      log.warn("Regime push failed (non-fatal)", { error: String(err) }),
    );
  });

  log.info("Regime push listener started");
  return unsub;
}
