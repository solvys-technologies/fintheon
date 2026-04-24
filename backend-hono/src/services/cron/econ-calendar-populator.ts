// [claude-code 2026-04-24] S34-T3: Econ calendar populator.
// - Sunday 22:00 America/New_York: weekly pull of ForexFactory ff_calendar_thisweek.json
// - Hourly weekdays 9–17 ET: refresh today's slice to capture actuals as they print
// Upserts to economic_events keyed on event_key (sha256 of name|date|time|country).
// Restores the data flow that broke with Notion severance on 2026-04-16 —
// econ-enricher.ts will see a populated table again.

import cron from "node-cron";
import { createHash } from "node:crypto";
import { upsertEconEvent, type EconEventRecord } from "../supabase-service.js";
import {
  categorizeEvent,
  ffCurrencyToCountry,
  ECON_DEFAULT_COUNTRIES,
  type EconCountryCode,
} from "../econ-calendar-service.js";
import { injectEconPrintToFeed } from "../riskflow/econ-bridge.js";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("EconCalendarPopulator");

const FF_WEEKLY_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";
const FETCH_TIMEOUT_MS = 20_000;
const USER_AGENT = "fintheon-econ-populator/1.0 (+https://fintheon.fly.dev)";

interface FFEntry {
  title?: string;
  country?: string; // currency code (USD, EUR, …)
  date?: string; // ISO e.g. 2026-04-24T08:30:00-04:00
  impact?: string; // "High" | "Medium" | "Low" | "Holiday" | ""
  forecast?: string;
  previous?: string;
  actual?: string;
}

function eventKey(parts: {
  name: string;
  date: string;
  time: string;
  country: string;
}): string {
  return createHash("sha256")
    .update(
      `${parts.name.trim()}|${parts.date}|${parts.time}|${parts.country}`,
      "utf8",
    )
    .digest("hex");
}

function normalizeImpact(
  impact?: string,
): "low" | "medium" | "high" | undefined {
  const v = (impact ?? "").toLowerCase();
  if (v === "high") return "high";
  if (v === "medium") return "medium";
  if (v === "low") return "low";
  return undefined;
}

function splitDateTime(iso?: string): { date: string; time: string } | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  // ET-local date + time string — the FF feed is published in ET; keep that framing.
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => fmt.find((p) => p.type === t)?.value ?? "";
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  const hh = get("hour");
  const mm = get("minute");
  // en-CA hour can come back as "24" at midnight; normalize.
  const time = `${hh === "24" ? "00" : hh}:${mm}`;
  return { date, time };
}

async function fetchForexFactory(): Promise<FFEntry[] | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(FF_WEEKLY_URL, {
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    });
    if (!res.ok) {
      log.warn("ForexFactory fetch non-OK", { status: res.status });
      return null;
    }
    const json = (await res.json()) as unknown;
    if (!Array.isArray(json)) {
      log.warn("ForexFactory payload not an array");
      return null;
    }
    return json as FFEntry[];
  } catch (err) {
    log.error("ForexFactory fetch failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

interface RunOptions {
  todayOnly?: boolean;
  countries?: readonly EconCountryCode[];
}

interface RunResult {
  fetched: number;
  upserted: number;
  actualsBridged: number;
  skippedCountry: number;
  skippedDate: number;
}

export async function runEconCalendarPopulator(
  opts: RunOptions = {},
): Promise<RunResult> {
  const countries = new Set(opts.countries ?? ECON_DEFAULT_COUNTRIES);
  const todayET = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const result: RunResult = {
    fetched: 0,
    upserted: 0,
    actualsBridged: 0,
    skippedCountry: 0,
    skippedDate: 0,
  };

  const rows = await fetchForexFactory();
  if (!rows) return result;
  result.fetched = rows.length;

  for (const row of rows) {
    const country = ffCurrencyToCountry(row.country);
    if (!country || !countries.has(country)) {
      result.skippedCountry++;
      continue;
    }
    const dt = splitDateTime(row.date);
    if (!dt) {
      result.skippedDate++;
      continue;
    }
    if (opts.todayOnly && dt.date !== todayET) {
      result.skippedDate++;
      continue;
    }

    const name = (row.title ?? "").trim();
    if (!name) continue;

    const key = eventKey({ name, date: dt.date, time: dt.time, country });
    const record: Omit<EconEventRecord, "id" | "created_at" | "updated_at"> & {
      event_key: string;
    } = {
      name,
      date: dt.date,
      time: dt.time,
      country,
      category: categorizeEvent(name),
      forecast: row.forecast?.trim() || undefined,
      previous: row.previous?.trim() || undefined,
      actual: row.actual?.trim() || undefined,
      impact: normalizeImpact(row.impact),
      event_key: key,
    };

    const written = await upsertEconEvent(record);
    if (!written) continue;
    result.upserted++;

    // If an actual landed in this refresh, bridge it into the RiskFlow feed.
    // Only do this during today-only refresh runs to avoid spamming the feed
    // with stale historical actuals on the weekly pull.
    if (opts.todayOnly && record.actual) {
      const actualNum = parseFloat(record.actual);
      if (!Number.isNaN(actualNum)) {
        try {
          await injectEconPrintToFeed({
            eventName: name,
            actual: actualNum,
            forecast: record.forecast ? parseFloat(record.forecast) : undefined,
            previous: record.previous ? parseFloat(record.previous) : undefined,
            date: dt.date,
          });
          result.actualsBridged++;
        } catch (err) {
          log.warn("Bridge inject failed", {
            name,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }
  }

  log.info("Populator run complete", { ...result });
  return result;
}

// ── Scheduler ───────────────────────────────────────────────────────────────

let tasks: cron.ScheduledTask[] = [];
let running = false;

export function startEconCalendarPopulator(): void {
  if (running) return;
  if (process.env.ECON_POPULATOR_ENABLED === "false") {
    log.info("Disabled via ECON_POPULATOR_ENABLED=false");
    return;
  }

  // Weekly: Sunday 22:00 ET — full thisweek.json pull.
  tasks.push(
    cron.schedule(
      "0 22 * * 0",
      () => {
        runEconCalendarPopulator({ todayOnly: false }).catch((err) =>
          log.error("Weekly tick failed", { error: String(err) }),
        );
      },
      { timezone: "America/New_York" },
    ),
  );

  // Hourly on the hour, weekdays 9–17 ET — refresh today's actuals.
  tasks.push(
    cron.schedule(
      "0 9-17 * * 1-5",
      () => {
        runEconCalendarPopulator({ todayOnly: true }).catch((err) =>
          log.error("Hourly tick failed", { error: String(err) }),
        );
      },
      { timezone: "America/New_York" },
    ),
  );

  running = true;
  log.info(
    "Started econ-calendar-populator (Sun 22:00 ET weekly + hourly 9–17 ET weekdays)",
  );

  // Kick once at boot so a fresh backend has calendar data within ~30s.
  runEconCalendarPopulator({ todayOnly: false }).catch((err) =>
    log.warn("Boot-time populator run failed (will retry on schedule)", {
      error: String(err),
    }),
  );
}

export function stopEconCalendarPopulator(): void {
  if (!running) return;
  for (const t of tasks) t.stop();
  tasks = [];
  running = false;
  log.info("Stopped econ-calendar-populator");
}

export function isEconCalendarPopulatorRunning(): boolean {
  return running;
}
