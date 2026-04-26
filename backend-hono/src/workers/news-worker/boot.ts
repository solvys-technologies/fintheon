// [claude-code 2026-04-25] S40-P2: news-worker boot-time contract assertion.
// Reads NEWS_WORKER_CONTRACT and verifies the actual scheduler config matches
// before the scheduler starts. On drift, logs a loud [CONTRACT-VIOLATION],
// notifies superadmins, and the contract values win.
//
// In practice the scheduler reads directly from NEWS_WORKER_CONTRACT (single
// source of truth), so the assertion is a belt-and-suspenders check against
// future drift introduced by a careless edit. The audit is also recorded in
// worker_health.

import { createLogger } from "../../lib/logger.js";
import { getSupabaseClient } from "../../config/supabase.js";
import { notifySuperadmins } from "../../services/notifications/notify-superadmins.js";
import { NEWS_WORKER_CONTRACT } from "./contract.js";

const log = createLogger("NewsWorkerBoot");

interface AssertionResult {
  ok: boolean;
  violations: Array<{ field: string; expected: number; observed: number }>;
}

export async function assertNewsWorkerContract(observed: {
  BREAKING_INTERVAL_MS: number;
  STANDARD_INTERVAL_MS: number;
}): Promise<AssertionResult> {
  const violations: AssertionResult["violations"] = [];

  for (const field of [
    "BREAKING_INTERVAL_MS",
    "STANDARD_INTERVAL_MS",
  ] as const) {
    const expected = NEWS_WORKER_CONTRACT[field];
    const got = observed[field];
    if (got !== expected) {
      violations.push({ field, expected, observed: got });
    }
  }

  if (violations.length === 0) {
    log.info("[CONTRACT-OK] news-worker cadence matches NEWS_WORKER_CONTRACT");
    await recordAudit("ok", "contract verified at boot");
    return { ok: true, violations: [] };
  }

  for (const v of violations) {
    log.error("[CONTRACT-VIOLATION] news-worker cadence drift", v);
  }

  // Notify each violation as a separate line so the alert reads cleanly in
  // TP's notification feed.
  const summary = violations
    .map(
      (v) =>
        `News worker contract auto-restored: ${v.field} was ${v.observed}, reset to ${v.expected}`,
    )
    .join("; ");
  await notifySuperadmins({
    title: "News worker contract violation",
    body: summary,
    severity: "warn",
    source: "news-worker-boot",
  }).catch((err) =>
    log.warn("notifySuperadmins threw (non-fatal)", { error: String(err) }),
  );
  await recordAudit("contract_violation", summary);

  return { ok: false, violations };
}

async function recordAudit(
  status: "ok" | "contract_violation",
  action: string,
): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) return;
  await sb
    .from("worker_health")
    .insert({
      worker: "news-worker",
      status,
      action_taken: action,
      metadata: { contract: NEWS_WORKER_CONTRACT },
    })
    .then((res) => {
      if (res.error) {
        log.warn("worker_health audit insert failed", {
          error: res.error.message,
        });
      }
    });
}
