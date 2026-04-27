// [claude-code 2026-04-27] S46.4: ForexFactory dropped per TP. TradingView is
// the single source of truth — its actuals/forecasts ship faster than FF on
// non-US releases, the `importance` field is cleaner than FF's "Low/Medium/
// High" string, and dropping FF removes a second source of upsert collisions
// that depend on event_key sha256 hashing for de-dupe. Idempotent dedupe is
// now enforced by a UNIQUE INDEX on economic_events.event_key (migration
// 20260427000000_econ_events_unique_event_key.sql).
// [claude-code 2026-04-26] Added TradingView Economic Calendar
// (https://economic-calendar.tradingview.com/events) as a parallel feed
// alongside ForexFactory. TradingView ships actuals faster than FF on
// non-US releases (TR/EU/JP/UK), and its `importance` field maps cleanly to
// our low/medium/high. Both feeds upsert through the same idempotent
// economic_events keying (event_key = sha256 of name|date|time|country) so
// duplicates collapse for free; whichever feed lands first wins, and the
// other refreshes the actual when it arrives. Headers are set verbatim per
// the TV reference docs (origin/referer/user-agent required) — without them
// the endpoint returns 403.
// [claude-code 2026-04-24] S34-T9: populator honors econ_watch_filters (T1) — skip upserts for (country, category) combos that TP has disabled in the Refinement Engine.
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
import { getActiveFilters } from "../econ-watch-filters/econ-watch-filters-service.js";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("EconCalendarPopulator");

// [claude-code 2026-04-27] FF_WEEKLY_URL + USER_AGENT retained as dead-code
// constants so a future rollback diff stays small if TP wants FF back. The
// fetchForexFactory function is unwired from runEconCalendarPopulator below.
const FF_WEEKLY_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";
const FETCH_TIMEOUT_MS = 20_000;
const USER_AGENT = "fintheon-econ-populator/1.0 (+https://fintheon.fly.dev)";

// TradingView Economic Calendar — public endpoint, but spoof a real browser
// in the headers exactly as the reference docs specify. The endpoint 403s on
// any deviation from this exact set.
const TV_CALENDAR_URL = "https://economic-calendar.tradingview.com/events";
const TV_BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36";

interface TVEvent {
  id?: string;
  title?: string;
  country?: string; // ISO2: "US", "EU", "TR", "GB", "JP", …
  indicator?: string;
  ticker?: string;
  actual?: number | null;
  previous?: number | null;
  forecast?: number | null;
  unit?: string | null;
  scale?: string | null;
  importance?: -1 | 0 | 1; // -1=low, 0=medium, 1=high
  date?: string; // ISO 8601 UTC
}

// TradingView uses ISO2 country codes; "GB" maps to our internal "UK".
const TV_COUNTRY_TO_INTERNAL: Record<string, EconCountryCode> = {
  US: "US",
  EU: "EU",
  GB: "UK",
  UK: "UK",
  JP: "JP",
  NZ: "NZ",
  AU: "AU",
  CA: "CA",
};

function tvImpactToImpact(
  importance: TVEvent["importance"],
): "low" | "medium" | "high" | undefined {
  if (importance === 1) return "high";
  if (importance === 0) return "medium";
  if (importance === -1) return "low";
  return undefined;
}

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

async function fetchTradingViewCalendar(opts: {
  fromIso: string;
  toIso: string;
  countries: readonly string[];
}): Promise<TVEvent[] | null> {
  const params = new URLSearchParams({
    from: opts.fromIso,
    to: opts.toIso,
    countries: opts.countries.join(","),
  });
  const url = `${TV_CALENDAR_URL}?${params.toString()}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Accept-Language": "en-US,en;q=0.9",
        Origin: "https://www.tradingview.com",
        Referer: "https://www.tradingview.com/",
        "User-Agent": TV_BROWSER_UA,
      },
    });
    if (!res.ok) {
      log.warn("TradingView calendar fetch non-OK", { status: res.status });
      return null;
    }
    const json = (await res.json()) as { status?: string; result?: TVEvent[] };
    if (json.status !== "ok" || !Array.isArray(json.result)) {
      log.warn("TradingView calendar returned non-ok payload", {
        status: json.status,
      });
      return null;
    }
    return json.result;
  } catch (err) {
    log.error("TradingView calendar fetch failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function tvEventToFFShape(tv: TVEvent): FFEntry | null {
  if (!tv.title || !tv.country || !tv.date) return null;
  const internalCountry = TV_COUNTRY_TO_INTERNAL[tv.country.toUpperCase()];
  if (!internalCountry) return null;
  return {
    title: tv.title,
    // FF code expected currency string; we set the country-mapped currency so
    // the existing `ffCurrencyToCountry` round-trip resolves cleanly. Reverse
    // lookup by value from the existing FF map keeps a single mapping source.
    country:
      Object.entries({
        USD: "US",
        EUR: "EU",
        GBP: "UK",
        JPY: "JP",
        NZD: "NZ",
        AUD: "AU",
        CAD: "CA",
      } as const).find(([, v]) => v === internalCountry)?.[0] ?? "USD",
    date: tv.date,
    impact:
      tv.importance === 1
        ? "High"
        : tv.importance === 0
          ? "Medium"
          : tv.importance === -1
            ? "Low"
            : "",
    forecast:
      tv.forecast === null || tv.forecast === undefined
        ? undefined
        : String(tv.forecast),
    previous:
      tv.previous === null || tv.previous === undefined
        ? undefined
        : String(tv.previous),
    actual:
      tv.actual === null || tv.actual === undefined
        ? undefined
        : String(tv.actual),
  };
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
  skippedFilter: number;
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
    skippedFilter: 0,
  };

  // [claude-code 2026-04-27] S46.4: TradingView is the single source of truth.
  // ForexFactory dropped per TP — its weekly JSON had stale actuals on
  // non-US releases and the schema-by-currency caused upsert collisions.
  // Idempotent dedupe via UNIQUE INDEX on economic_events.event_key.
  const tvFromIso = new Date().toISOString();
  const tvToIso = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const tvCountries = Array.from(countries).map((c) => (c === "UK" ? "GB" : c));
  const tvRows = await fetchTradingViewCalendar({
    fromIso: tvFromIso,
    toIso: tvToIso,
    countries: tvCountries,
  });

  const rows: FFEntry[] = [];
  if (tvRows) {
    for (const tv of tvRows) {
      const mapped = tvEventToFFShape(tv);
      if (mapped) rows.push(mapped);
    }
  }
  if (rows.length === 0) return result;
  result.fetched = rows.length;

  // [S34-T9] T1 watch-filters: build an active-set once per run. If the service
  // throws (fresh DB without table), fall back to implicit-all so populator
  // still runs standalone.
  let activeFilterKey: Set<string> | null = null;
  try {
    const filters = await getActiveFilters();
    if (filters.length > 0) {
      activeFilterKey = new Set(
        filters.map((f) => `${f.country}:${f.category}`),
      );
    }
  } catch (err) {
    log.warn("getActiveFilters failed — falling back to implicit-all", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

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

    const category = categorizeEvent(name);
    if (activeFilterKey && !activeFilterKey.has(`${country}:${category}`)) {
      result.skippedFilter++;
      continue;
    }

    const key = eventKey({ name, date: dt.date, time: dt.time, country });
    const record: Omit<EconEventRecord, "id" | "created_at" | "updated_at"> & {
      event_key: string;
    } = {
      name,
      date: dt.date,
      time: dt.time,
      country,
      category,
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
