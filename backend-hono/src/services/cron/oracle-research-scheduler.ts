// [claude-code 2026-04-18] S20-T3: Oracle research scheduler — cron trigger for
// prediction market scanning + arb detection during extended market hours.
// triggerResearchCycle now honors ORACLE_RESEARCH_ENABLED and an in-process
// cooldown so an authenticated admin cannot burn Polymarket/Kalshi quota in a loop.

import { createLogger } from "../../lib/logger.js";
import {
  getSupabaseClient,
  isSupabaseConfigured,
} from "../../config/supabase.js";
import { scanPredictionMarkets } from "../oracle-research/scanner.js";
import { detectArbOpportunities } from "../oracle-research/arb-detector.js";
import type { OracleResearchFinding } from "../oracle-research/types.js";

const log = createLogger("OracleResearchScheduler");

const DEFAULT_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours
const MANUAL_TRIGGER_COOLDOWN_MS = 5 * 60 * 1000; // 5 min between manual triggers
let timer: ReturnType<typeof setInterval> | null = null;
let lastManualRunAt = 0;

/** Extended market hours: 6 AM - 8 PM ET, weekdays only */
function isMarketHours(): boolean {
  const now = new Date();
  const et = new Date(
    now.toLocaleString("en-US", { timeZone: "America/New_York" }),
  );
  const day = et.getDay();
  const hour = et.getHours();

  if (day === 0 || day === 6) return false; // Weekend
  return hour >= 6 && hour < 20; // 6 AM - 8 PM ET
}

async function storeFindings(
  findings: OracleResearchFinding[],
): Promise<number> {
  if (!isSupabaseConfigured() || findings.length === 0) return 0;

  const sb = getSupabaseClient();
  const { error, data } = await sb
    .from("oracle_research_findings")
    .insert(findings)
    .select("id");

  if (error) {
    log.error("Failed to store findings", { error: error.message });
    return 0;
  }

  return data?.length ?? 0;
}

async function runResearchCycle(): Promise<void> {
  if (!isMarketHours()) {
    log.info("Outside market hours, skipping research cycle");
    return;
  }

  log.info("Starting Oracle research cycle");
  const startMs = Date.now();

  try {
    const contracts = await scanPredictionMarkets();
    const findings = await detectArbOpportunities(contracts);

    if (findings.length > 0) {
      const stored = await storeFindings(findings);
      log.info(
        `Research cycle complete: ${findings.length} findings, ${stored} stored`,
        { durationMs: Date.now() - startMs },
      );
    } else {
      log.info("Research cycle complete: no findings", {
        contractsScanned: contracts.length,
        durationMs: Date.now() - startMs,
      });
    }
  } catch (err) {
    log.error("Research cycle failed", { error: String(err) });
  }
}

export function startOracleResearch(): void {
  const enabled = process.env.ORACLE_RESEARCH_ENABLED !== "false";
  if (!enabled) {
    log.info("Oracle research disabled (ORACLE_RESEARCH_ENABLED=false)");
    return;
  }

  const intervalMs = parseInt(
    process.env.ORACLE_RESEARCH_INTERVAL_MS || String(DEFAULT_INTERVAL_MS),
    10,
  );

  // First run 60s after boot (let other services warm up)
  setTimeout(() => {
    runResearchCycle().catch((err) =>
      log.warn("Initial research cycle failed (non-fatal)", {
        error: String(err),
      }),
    );
  }, 60_000);

  timer = setInterval(() => {
    runResearchCycle().catch((err) =>
      log.warn("Scheduled research cycle failed (non-fatal)", {
        error: String(err),
      }),
    );
  }, intervalMs);
  timer.unref?.();

  log.info(
    `Oracle research scheduler started (interval: ${intervalMs / 1000 / 60}min)`,
  );
}

export function stopOracleResearch(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
    log.info("Oracle research scheduler stopped");
  }
}

/** Manual trigger for testing / API endpoint */
export async function triggerResearchCycle(): Promise<OracleResearchFinding[]> {
  if (process.env.ORACLE_RESEARCH_ENABLED === "false") {
    throw new Error("Oracle research disabled (ORACLE_RESEARCH_ENABLED=false)");
  }

  const sinceLastRun = Date.now() - lastManualRunAt;
  if (sinceLastRun < MANUAL_TRIGGER_COOLDOWN_MS) {
    const retryMs = MANUAL_TRIGGER_COOLDOWN_MS - sinceLastRun;
    throw new Error(`Cooldown active — retry in ${Math.ceil(retryMs / 1000)}s`);
  }
  lastManualRunAt = Date.now();

  log.info("Manual research cycle triggered");
  const contracts = await scanPredictionMarkets();
  const findings = await detectArbOpportunities(contracts);

  if (findings.length > 0) {
    await storeFindings(findings);
  }

  return findings;
}
