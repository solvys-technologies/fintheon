// [claude-code 2026-04-19] S25-T7: Ops endpoint surface — last-run + next-run for Aquarium simulation and the four scheduled briefs (MDB/ADB/PMDB/WT). Frontend uses this for the Aquarium last-run timer + brief countdown chip in the Sanctum header. Failure state is inferred from age vs expected cadence.
import { Hono } from "hono";
import { readLatestBrief } from "../../services/supabase-service.js";
import type { BriefType } from "../../services/supabase-service.js";
import { getDispatchSchedulerStatus } from "../../services/cron/dispatch-scheduler.js";
import { getLatestReport } from "../../services/agent-desk/agent-desk-service.js";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("OpsRoutes");

interface BriefStatus {
  type: BriefType;
  description: string;
  lastRunAt: string | null;
  nextRunAt: string | null;
  ageMinutes: number | null;
  countdownMinutes: number | null;
  status: "ok" | "due-soon" | "stale" | "failed" | "unknown";
}

interface AgentDeskStatus {
  lastRunAt: string | null;
  ageMinutes: number | null;
  /** "ok" if within ~6h cadence, "stale" past 12h, "unknown" if no report yet. */
  status: "ok" | "stale" | "unknown";
}

const STALE_BRIEF_GRACE_MINUTES = 60; // missed by >1h ⇒ stale
const AGENT_DESK_FRESH_HOURS = 6; // expected cadence
const AGENT_DESK_STALE_HOURS = 12;

/** Compute the next ET wall-clock occurrence of a cron expression — handles weekday/sunday-only fields. */
function nextOccurrenceFromCron(cron: string, now: Date): Date | null {
  // Supports the dispatch scheduler's restricted cron grammar:
  //   "MM HH * * 1-5"  (weekdays)
  //   "MM HH * * 0"    (Sunday)
  const parts = cron.split(/\s+/);
  if (parts.length !== 5) return null;
  const minute = parseInt(parts[0], 10);
  const hour = parseInt(parts[1], 10);
  const dowField = parts[4];

  const validDows = new Set<number>();
  for (const seg of dowField.split(",")) {
    if (seg.includes("-")) {
      const [lo, hi] = seg.split("-").map(Number);
      for (let d = lo; d <= hi; d++) validDows.add(d);
    } else if (seg !== "*") {
      validDows.add(parseInt(seg, 10));
    } else {
      for (let d = 0; d <= 6; d++) validDows.add(d);
    }
  }

  // ET offset — best-effort without pulling in tz library; America/New_York is UTC-4 or UTC-5 depending on DST.
  // Use Intl to convert the candidate to ET wall clock.
  const candidate = new Date(now.getTime());
  for (let i = 0; i < 14; i++) {
    candidate.setUTCDate(now.getUTCDate() + i);
    candidate.setUTCHours(0, 0, 0, 0);
    // Apply ET wall-clock target via Intl
    const etDateString = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(candidate);
    const [yyyy, mm, dd] = etDateString.split("-").map(Number);
    // Construct ET wall clock at hour:minute then convert back to UTC
    const etCandidate = new Date(
      Date.UTC(yyyy, mm - 1, dd, hour, minute, 0, 0),
    );
    // Adjust for ET offset by reading the parts back
    const etHour = parseInt(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        hour: "numeric",
        hour12: false,
      }).format(etCandidate),
      10,
    );
    const offsetHours = etHour - hour;
    const utcCandidate = new Date(
      etCandidate.getTime() - offsetHours * 3_600_000,
    );

    if (utcCandidate.getTime() <= now.getTime()) continue;

    const etDow = parseInt(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        weekday: "short",
      })
        .format(utcCandidate)
        .replace(/[^A-Za-z]/g, "")
        .slice(0, 3),
      10,
    );
    // weekday short returns "Mon" etc — map manually
    const dowMap: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };
    const dowName = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      weekday: "short",
    }).format(utcCandidate);
    const dowIdx = dowMap[dowName];
    if (dowIdx == null) continue;
    if (!validDows.has(dowIdx)) continue;

    return utcCandidate;
  }
  return null;
}

function ageMinutesFrom(
  iso: string | null | undefined,
  now: Date,
): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((now.getTime() - t) / 60_000));
}

export function createOpsRoutes() {
  const app = new Hono();

  // GET /api/ops/schedule-status — last/next-run for Aquarium + briefs
  app.get("/schedule-status", async (c) => {
    const now = new Date();

    // Briefs ────────────────────────────────────────────────
    const schedulerStatus = getDispatchSchedulerStatus();
    const briefs: BriefStatus[] = await Promise.all(
      schedulerStatus.jobs.map(async (j) => {
        let lastRunAt: string | null = null;
        try {
          const latest = await readLatestBrief(j.briefType);
          lastRunAt = latest?.created_at ?? null;
        } catch (err) {
          log.warn(`readLatestBrief(${j.briefType}) failed`, err);
        }
        const nextRunDate = nextOccurrenceFromCron(j.cron, now);
        const nextRunAt = nextRunDate ? nextRunDate.toISOString() : null;
        const ageMin = ageMinutesFrom(lastRunAt, now);
        const countdownMin = nextRunDate
          ? Math.max(
              0,
              Math.floor((nextRunDate.getTime() - now.getTime()) / 60_000),
            )
          : null;

        let status: BriefStatus["status"] = "unknown";
        if (!schedulerStatus.active) {
          status = "failed";
        } else if (lastRunAt == null) {
          // Never run yet — "due-soon" if next run is within 6h, "unknown" otherwise
          status =
            countdownMin != null && countdownMin < 360 ? "due-soon" : "unknown";
        } else {
          // Has run before; consider stale if more than (cadence + grace) since last run
          // We don't compute cadence per-job; treat ≥ 26h as stale (briefs are daily/weekly)
          const cadenceLimitMin =
            j.briefType === "WT" ? 7 * 24 * 60 + 60 : 26 * 60;
          if (
            ageMin != null &&
            ageMin > cadenceLimitMin + STALE_BRIEF_GRACE_MINUTES
          ) {
            status = "stale";
          } else if (countdownMin != null && countdownMin < 30) {
            status = "due-soon";
          } else {
            status = "ok";
          }
        }

        return {
          type: j.briefType,
          description: j.description,
          lastRunAt,
          nextRunAt,
          ageMinutes: ageMin,
          countdownMinutes: countdownMin,
          status,
        };
      }),
    );

    // Aquarium / MiroShark ──────────────────────────────────
    let agentDeskLastRunAt: string | null = null;
    try {
      const report = (await getLatestReport()) as Record<
        string,
        unknown
      > | null;
      const generatedAt =
        (report?.generatedAt as string | undefined) ??
        (report?.generated_at as string | undefined) ??
        (report?.created_at as string | undefined) ??
        null;
      agentDeskLastRunAt = generatedAt ?? null;
    } catch (err) {
      log.warn("getLatestReport failed", err);
    }
    const agentDeskAgeMin = ageMinutesFrom(agentDeskLastRunAt, now);
    const agentDeskStatus: AgentDeskStatus = {
      lastRunAt: agentDeskLastRunAt,
      ageMinutes: agentDeskAgeMin,
      status:
        agentDeskAgeMin == null
          ? "unknown"
          : agentDeskAgeMin < AGENT_DESK_FRESH_HOURS * 60
            ? "ok"
            : agentDeskAgeMin < AGENT_DESK_STALE_HOURS * 60
              ? "ok"
              : "stale",
    };

    return c.json({
      generatedAt: now.toISOString(),
      schedulerActive: schedulerStatus.active,
      agentDesk: agentDeskStatus,
      briefs,
    });
  });

  return app;
}
