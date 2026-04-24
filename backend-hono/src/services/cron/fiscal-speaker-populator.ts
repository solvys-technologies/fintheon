// [claude-code 2026-04-24] S34-T7: Fiscal speaker populator.
// Scrapes Trump / Bessent / Fed speaker schedules 3x/day and upserts them
// into economic_events with category='Speaker', country='US'. Sits alongside
// T3's econ-calendar-populator (ForexFactory) — different source, same table.

import cron from "node-cron";
import { createHash } from "node:crypto";
import { upsertEconEvent, type EconEventRecord } from "../supabase-service.js";
import { getSupabaseClient } from "../../config/supabase.js";
import { createLogger } from "../../lib/logger.js";
import { scrapeFedSpeeches } from "../fiscal-sources/fed-speeches.js";
import { scrapeBessentSpeeches } from "../fiscal-sources/bessent-speeches.js";
import { scrapeTrumpSchedule } from "../fiscal-sources/trump-schedule.js";
import type {
  ScrapedFiscalEvent,
  FiscalSource,
} from "../fiscal-sources/types.js";

const log = createLogger("FiscalSpeakerPopulator");

// ── Filter gate ─────────────────────────────────────────────────────────────

interface FilterGateState {
  active: boolean;
  checkedAt: number;
}

const FILTER_CACHE_TTL_MS = 30_000;
let filterCache: FilterGateState | null = null;

async function isSpeakerGateOpen(): Promise<boolean> {
  const now = Date.now();
  if (filterCache && now - filterCache.checkedAt < FILTER_CACHE_TTL_MS) {
    return filterCache.active;
  }
  const sb = getSupabaseClient();
  if (!sb) {
    filterCache = { active: true, checkedAt: now };
    return true;
  }
  try {
    const { data, error } = await sb
      .from("econ_watch_filters")
      .select("active")
      .eq("country", "US")
      .eq("category", "Speaker")
      .maybeSingle();
    if (error) {
      // Table missing (T1 migration not pushed yet) or any other read error —
      // fail open so T7 ships before T1.
      filterCache = { active: true, checkedAt: now };
      return true;
    }
    const active = data?.active !== false;
    filterCache = { active, checkedAt: now };
    return active;
  } catch {
    filterCache = { active: true, checkedAt: now };
    return true;
  }
}

// ── Mapping ─────────────────────────────────────────────────────────────────

function eventName(e: ScrapedFiscalEvent): string {
  // em-dash, per brief — same glyph used in T3 categorization examples.
  return `${e.speaker} — ${e.venue}`.trim();
}

function eventKeyFor(name: string, date: string, time: string): string {
  return createHash("sha256")
    .update(`${name.trim()}|${date}|${time}|US`, "utf8")
    .digest("hex");
}

// ── Stats ───────────────────────────────────────────────────────────────────

export interface FiscalSpeakerStats {
  lastRun: string | null;
  running: boolean;
  fetched: number;
  upserted: number;
  skippedFilter: number;
  skippedInvalid: number;
  perSource: Record<FiscalSource, number>;
  errors: Partial<Record<"fed" | "bessent" | "trump", string>>;
}

function zeroPerSource(): Record<FiscalSource, number> {
  return {
    "fed-rss": 0,
    "fed-html": 0,
    "treasury-rss": 0,
    "whitehouse-rss": 0,
    "truth-rss": 0,
  };
}

let stats: FiscalSpeakerStats = {
  lastRun: null,
  running: false,
  fetched: 0,
  upserted: 0,
  skippedFilter: 0,
  skippedInvalid: 0,
  perSource: zeroPerSource(),
  errors: {},
};

export function getFiscalSpeakerStats(): FiscalSpeakerStats {
  return { ...stats, perSource: { ...stats.perSource } };
}

// ── Run ─────────────────────────────────────────────────────────────────────

export interface FiscalSpeakerRunResult {
  fetched: number;
  upserted: number;
  skippedFilter: number;
  skippedInvalid: number;
  perSource: Record<FiscalSource, number>;
}

export async function runFiscalSpeakerPopulator(): Promise<FiscalSpeakerRunResult> {
  const perSource = zeroPerSource();
  const result: FiscalSpeakerRunResult = {
    fetched: 0,
    upserted: 0,
    skippedFilter: 0,
    skippedInvalid: 0,
    perSource,
  };
  const errors: FiscalSpeakerStats["errors"] = {};

  const [fed, bessent, trump] = await Promise.all([
    scrapeFedSpeeches(),
    scrapeBessentSpeeches(),
    scrapeTrumpSchedule(),
  ]);
  if (fed.errored) errors.fed = "scrape errored";
  if (bessent.errored) errors.bessent = "scrape errored";
  if (trump.errored) errors.trump = "scrape errored";

  const events = [...fed.events, ...bessent.events, ...trump.events];
  result.fetched = events.length;

  if (events.length === 0) {
    stats = {
      lastRun: new Date().toISOString(),
      running: false,
      fetched: 0,
      upserted: 0,
      skippedFilter: 0,
      skippedInvalid: 0,
      perSource,
      errors,
    };
    return result;
  }

  const gateOpen = await isSpeakerGateOpen();
  if (!gateOpen) {
    result.skippedFilter = events.length;
    stats = {
      lastRun: new Date().toISOString(),
      running: false,
      fetched: events.length,
      upserted: 0,
      skippedFilter: events.length,
      skippedInvalid: 0,
      perSource,
      errors,
    };
    log.info("Gate closed (US/Speaker filter inactive) — skipping writes", {
      fetched: events.length,
    });
    return result;
  }

  for (const e of events) {
    if (!e.date || !e.venue) {
      result.skippedInvalid++;
      continue;
    }
    const name = eventName(e);
    const key = eventKeyFor(name, e.date, e.time);
    const record: Omit<EconEventRecord, "id" | "created_at" | "updated_at"> & {
      event_key: string;
    } = {
      name,
      date: e.date,
      time: e.time,
      country: "US",
      category: "Speaker",
      importance: "medium",
      detail: e.detail,
      event_key: key,
    };
    const written = await upsertEconEvent(record);
    if (!written) continue;
    result.upserted++;
    perSource[e.source]++;
  }

  stats = {
    lastRun: new Date().toISOString(),
    running: false,
    fetched: result.fetched,
    upserted: result.upserted,
    skippedFilter: result.skippedFilter,
    skippedInvalid: result.skippedInvalid,
    perSource,
    errors,
  };
  log.info("Fiscal speaker populator run complete", {
    fetched: result.fetched,
    upserted: result.upserted,
    perSource,
  });
  return result;
}

// ── Scheduler ───────────────────────────────────────────────────────────────

let tasks: cron.ScheduledTask[] = [];
let running = false;

function fireOnce(): void {
  if (stats.running) return;
  stats.running = true;
  runFiscalSpeakerPopulator()
    .catch((err) =>
      log.error("Tick failed", {
        error: err instanceof Error ? err.message : String(err),
      }),
    )
    .finally(() => {
      stats.running = false;
    });
}

export function startFiscalSpeakerPopulator(): void {
  if (running) return;
  if (process.env.FISCAL_SPEAKER_POPULATOR_ENABLED === "false") {
    log.info("Disabled via FISCAL_SPEAKER_POPULATOR_ENABLED=false");
    return;
  }
  // 06:00 / 12:00 / 18:00 America/New_York, Mon–Fri.
  tasks.push(
    cron.schedule("0 6,12,18 * * 1-5", fireOnce, {
      timezone: "America/New_York",
    }),
  );
  running = true;
  log.info(
    "Started fiscal-speaker-populator (06/12/18 ET weekdays, +boot kick)",
  );
  fireOnce();
}

export function stopFiscalSpeakerPopulator(): void {
  if (!running) return;
  for (const t of tasks) t.stop();
  tasks = [];
  running = false;
  log.info("Stopped fiscal-speaker-populator");
}

export function isFiscalSpeakerPopulatorRunning(): boolean {
  return running;
}
