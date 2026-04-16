// [claude-code 2026-03-11] Systemic risk background poller
// Runs every 120s, evaluates systemic risk, caches result, injects alerts

import {
  assessSystemicRisk,
  setCachedAssessment,
  recordHeadlineSignal,
} from "./risk-detector.js";
import { startFredPolling, stopFredPolling } from "./fred-service.js";
import { restoreActiveChains, getChainState } from "./causal-chain-engine.js";
import { fetchVIX } from "../vix-service.js";
import { classifyEventType } from "../iv-scoring/index.js";

const POLL_INTERVAL_MS = 120_000; // 2 minutes

let _intervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Run a single systemic risk assessment cycle.
 */
async function runAssessment(): Promise<void> {
  try {
    // Get VIX data
    const vixData = await fetchVIX();

    // Pull recent events from DB (last 6 hours)
    let recentEvents: {
      eventType: string;
      timestamp: Date;
      baseScore: number;
    }[] = [];
    try {
      const { sql, isDatabaseAvailable } =
        await import("../../config/database.js");
      if (isDatabaseAvailable() && sql) {
        const rows = await sql`
          SELECT headline, iv_score, published_at, tags
          FROM news_feed_items
          WHERE published_at > NOW() - INTERVAL '6 hours'
          ORDER BY published_at DESC
          LIMIT 50
        `;

        recentEvents = rows.map((row: any) => {
          const parsed = {
            raw: row.headline,
            eventType: null,
            isBreaking: false,
          };
          const eventType = classifyEventType(parsed as any);

          // Also record as headline signal for the rhyming engine
          const systemicTypes = [
            "creditSpreadWidening",
            "yieldCurveSignal",
            "liquidityStress",
            "bankStress",
            "leverageWarning",
            "majorCrisis",
            "blackSwan",
          ];
          if (systemicTypes.includes(eventType)) {
            recordHeadlineSignal(eventType, row.headline, "moderate");
          }

          return {
            eventType,
            timestamp: new Date(row.published_at),
            baseScore: Number(row.iv_score) || 3,
          };
        });
      }
    } catch (err) {
      console.warn(
        "[SystemicPoller] DB fetch failed, running with empty events:",
        err,
      );
    }

    // Run assessment
    const assessment = await assessSystemicRisk(recentEvents, vixData.level);
    setCachedAssessment(assessment);

    // Persist chain state to DB
    try {
      const { sql, isDatabaseAvailable } =
        await import("../../config/database.js");
      if (isDatabaseAvailable() && sql) {
        const chainState = JSON.stringify(getChainState());
        await sql`
          INSERT INTO systemic_risk_state (state_type, state_data, updated_at)
          VALUES ('causal_chains', ${chainState}::jsonb, NOW())
          ON CONFLICT (state_type)
          DO UPDATE SET state_data = ${chainState}::jsonb, updated_at = NOW()
        `.catch(() => {
          // Table may not exist yet — silent fail
        });
      }
    } catch {
      // DB persistence is best-effort
    }

    if (assessment.systemicScore > 1) {
      console.log(
        `[SystemicPoller] Score: ${assessment.systemicScore}/10, ` +
          `chains: ${assessment.activeChains.length}, ` +
          `rhymes: ${assessment.rhymeMatches.length}, ` +
          `credit signals: ${assessment.creditSignalCount}, ` +
          `IV overlay: +${assessment.ivScoreOverlay}`,
      );
    }
  } catch (err) {
    console.error("[SystemicPoller] Assessment failed:", err);
  }
}

/**
 * Start the systemic risk polling system.
 * Also starts FRED polling.
 */
export function startSystemicRiskPolling(fredApiKey?: string): void {
  if (_intervalId) return;

  console.log("[SystemicPoller] Starting systemic risk monitoring...");

  // Start FRED polling (6-hour interval)
  startFredPolling(fredApiKey);

  // Restore chain state from DB
  restoreChainStateFromDB().catch(() => {
    // Silent fail — fresh start is fine
  });

  // Immediate first assessment
  runAssessment();

  // Schedule recurring assessments
  _intervalId = setInterval(runAssessment, POLL_INTERVAL_MS);

  console.log(`[SystemicPoller] Polling every ${POLL_INTERVAL_MS / 1000}s`);
}

/**
 * Stop systemic risk polling.
 */
export function stopSystemicRiskPolling(): void {
  if (_intervalId) {
    clearInterval(_intervalId);
    _intervalId = null;
  }
  stopFredPolling();
  console.log("[SystemicPoller] Stopped");
}

/**
 * Restore causal chain state from DB on startup.
 */
async function restoreChainStateFromDB(): Promise<void> {
  try {
    const { sql, isDatabaseAvailable } =
      await import("../../config/database.js");
    if (!isDatabaseAvailable() || !sql) return;

    const rows = await sql`
      SELECT state_data FROM systemic_risk_state
      WHERE state_type = 'causal_chains'
      LIMIT 1
    `.catch(() => []);

    if (rows.length > 0 && rows[0].state_data) {
      const chains = rows[0].state_data;
      if (Array.isArray(chains) && chains.length > 0) {
        restoreActiveChains(chains);
      }
    }
  } catch {
    // Silent — fresh start is fine
  }
}
