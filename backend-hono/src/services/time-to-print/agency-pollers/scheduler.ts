// [claude-code 2026-04-25] S40-P4: agency burst scheduler.
//   - Reads economic_events for next 24h, filters to agency-mapped event_keys
//   - Schedules a one-shot armBLSBurst (or per-agency equivalent) per event
//   - On extraction success → broadcastEconPrint via SSE + persist actual to
//     economic_events.actual + econ_data.beatMiss
//
// Scoring path: skip the OpenRouter call for the 9 ranked econ events. Static
// IV map (CPI=8, NFP=8, FOMC=9, …) is consumed by the catalyst-promoter
// downstream; surprise magnitude rescores async if warranted.

import cron from "node-cron";
import { sql, isDatabaseAvailable } from "../../../config/database.js";
import { getSupabaseClient } from "../../../config/supabase.js";
import { createLogger } from "../../../lib/logger.js";
import { broadcastEconPrint } from "../../riskflow/sse-broadcaster.js";
import { armBLSBurst, BLS_RELEASES } from "./bls.js";
import { armBEABurst, BEA_RELEASES } from "./bea.js";
import { armFRBBurst, FRB_RELEASES } from "./frb.js";
import { armCensusBurst, CENSUS_RELEASES } from "./census.js";
import { armEDGARBurst, EDGAR_RELEASES } from "./edgar.js";
import { armTreasuryBurst, TREASURY_RELEASES } from "./treasury.js";
import { classifyBeatMiss } from "./beat-miss.js";
import type {
  AgencyReleaseDescriptor,
  BurstResult,
  EconEventKey,
} from "./types.js";

const log = createLogger("AgencyBurstScheduler");

interface PendingArm {
  eventId: string;
  eventName: string;
  fires_at: Date;
  release: AgencyReleaseDescriptor;
  forecast: number | null;
  scheduled: NodeJS.Timeout | null;
}

const pending = new Map<string, PendingArm>();
let dailyTask: cron.ScheduledTask | null = null;
let running = false;

function eventKeyFromEcon(name: string): EconEventKey | null {
  const lower = name.toLowerCase();
  if (lower.includes("cpi")) return "cpi";
  if (lower.includes("ppi")) return "ppi";
  if (lower.includes("non-farm") || lower.includes("nonfarm")) return "empsit";
  if (lower.includes("jolts")) return "jolts";
  if (lower.includes("employment cost")) return "eci";
  if (lower.includes("retail sales")) return "retail-sales";
  if (lower.includes("housing starts")) return "housing-starts";
  if (lower.includes("durable goods")) return "durable-goods";
  if (lower.includes("gdp")) return "gdp";
  if (lower.includes("pce") || lower.includes("personal income")) return "pce";
  if (lower.includes("fomc")) return "fomc";
  return null;
}

function descriptorFor(eventKey: EconEventKey): AgencyReleaseDescriptor | null {
  // BLS
  if (eventKey === "cpi") return BLS_RELEASES.cpi;
  if (eventKey === "ppi") return BLS_RELEASES.ppi;
  if (eventKey === "empsit") return BLS_RELEASES.empsit;
  if (eventKey === "jolts") return BLS_RELEASES.jolts;
  if (eventKey === "eci") return BLS_RELEASES.eci;
  // BEA
  if (eventKey === "gdp") return BEA_RELEASES.gdp;
  if (eventKey === "pce") return BEA_RELEASES.pce;
  if (eventKey === "personal-income") return BEA_RELEASES["personal-income"];
  // FRB
  if (eventKey === "fomc") return FRB_RELEASES.fomc;
  // Census
  if (eventKey === "retail-sales") return CENSUS_RELEASES["retail-sales"];
  if (eventKey === "housing-starts") return CENSUS_RELEASES["housing-starts"];
  if (eventKey === "durable-goods") return CENSUS_RELEASES["durable-goods"];
  // EDGAR + Treasury — armed only via specific issuer/auction triggers.
  if (eventKey === "edgar-8k") return EDGAR_RELEASES["edgar-8k"];
  if (eventKey === "treasury-offering")
    return TREASURY_RELEASES["treasury-offering"];
  return null;
}

function dispatchByAgency(opts: {
  release: AgencyReleaseDescriptor;
  scheduledAt: Date;
}): Promise<BurstResult> {
  switch (opts.release.agency) {
    case "bls":
      return armBLSBurst(opts);
    case "bea":
      return armBEABurst(opts);
    case "frb":
      return armFRBBurst(opts);
    case "census":
      return armCensusBurst(opts);
    case "edgar":
      return armEDGARBurst(opts);
    case "treasury":
      return armTreasuryBurst(opts);
    default:
      return armBLSBurst(opts);
  }
}

async function armOne(arm: PendingArm): Promise<void> {
  log.info("Arming agency burst", {
    event: arm.eventName,
    fires_at: arm.fires_at.toISOString(),
    release: arm.release.eventKey,
  });

  const result = await dispatchByAgency({
    release: arm.release,
    scheduledAt: arm.fires_at,
  });

  if (!result.ok || !result.extraction) {
    log.warn("Burst failed to extract", {
      event: arm.eventName,
      reason: result.reason,
    });
    return;
  }

  const { actual, previous } = result.extraction;
  const forecast = arm.forecast;

  let beatMiss: "beat" | "miss" | "inline" | null = null;
  let surprisePercent: number | null = null;
  if (actual != null && forecast != null) {
    const cls = classifyBeatMiss(actual, forecast, arm.release.eventKey);
    beatMiss = cls.beatMiss;
    surprisePercent = cls.surprisePercent;
  }

  // Persist back to economic_events.
  const sb = getSupabaseClient();
  if (sb) {
    await sb
      .from("economic_events")
      .update({
        actual: actual?.toString() ?? null,
        econ_data: {
          actual,
          forecast,
          previous,
          beatMiss,
          surprisePercent,
          source: "agency-burst",
          printedAt: result.printedAt,
        },
      })
      .eq("id", arm.eventId)
      .then((res) => {
        if (res.error) {
          log.warn("economic_events update failed", {
            error: res.error.message,
          });
        }
      });
  }

  if (actual != null) {
    broadcastEconPrint({
      eventId: arm.eventId,
      eventName: arm.eventName,
      actual,
      forecast,
      previous,
      surprisePercent,
      beatMiss: beatMiss ?? "inline",
      printedAt: result.printedAt,
    });
  }

  pending.delete(arm.eventId);
}

async function loadAndArm(): Promise<void> {
  if (!isDatabaseAvailable() || !sql) return;
  const horizon = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const today = new Date();
  try {
    const rows = (await sql`
      SELECT id, name, date, time, forecast, country, event_key
      FROM economic_events
      WHERE date >= ${today.toISOString().slice(0, 10)}
        AND date <= ${horizon.toISOString().slice(0, 10)}
        AND country = 'US'
        AND actual IS NULL
    `) as unknown as Array<{
      id: string;
      name: string;
      date: string;
      time: string | null;
      forecast: string | null;
      event_key: string | null;
    }>;

    for (const row of rows) {
      if (pending.has(row.id)) continue;
      const eventKey = eventKeyFromEcon(row.event_key ?? row.name);
      if (!eventKey) continue;
      const release = descriptorFor(eventKey);
      if (!release) continue;

      // Reconstruct fires_at (date + time string). Best-effort ET conversion.
      const dateIso = row.date;
      const time = row.time ?? "08:30";
      const fires_at = new Date(`${dateIso}T${time}:00-04:00`);
      if (fires_at.getTime() < Date.now()) continue;

      const armOffsetMs = fires_at.getTime() - Date.now() - 30_000;
      const arm: PendingArm = {
        eventId: row.id,
        eventName: row.name,
        fires_at,
        release,
        forecast: row.forecast ? parseFloat(row.forecast) : null,
        scheduled: null,
      };
      arm.scheduled = setTimeout(
        () => {
          void armOne(arm).catch((err) =>
            log.warn("armOne threw (swallowed)", { error: String(err) }),
          );
        },
        Math.max(0, armOffsetMs),
      );
      pending.set(row.id, arm);
      log.info("Scheduled burst arm", {
        event: row.name,
        fires_at: fires_at.toISOString(),
        armInMs: armOffsetMs,
      });
    }
  } catch (err) {
    log.warn("loadAndArm threw (swallowed)", { error: String(err) });
  }
}

export function startAgencyBurstScheduler(): void {
  if (running) return;
  if (process.env.AGENCY_BURST_ENABLED === "false") {
    log.info("Disabled via AGENCY_BURST_ENABLED=false");
    return;
  }
  running = true;
  void loadAndArm();
  // Re-scan every 30 minutes to pick up newly-published economic_events rows.
  dailyTask = cron.schedule(
    "*/30 * * * *",
    () => {
      loadAndArm().catch((err) =>
        log.warn("Periodic loadAndArm threw (swallowed)", {
          error: String(err),
        }),
      );
    },
    { timezone: "America/New_York" },
  );
  log.info("Started — refreshes every 30 min");
}

export function stopAgencyBurstScheduler(): void {
  if (!running) return;
  running = false;
  for (const arm of pending.values()) {
    if (arm.scheduled) clearTimeout(arm.scheduled);
  }
  pending.clear();
  dailyTask?.stop();
  dailyTask = null;
}
