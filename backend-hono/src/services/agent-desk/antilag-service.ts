import { getSupabaseClient } from "../../config/supabase.js";

export type AntilagInstrumentClass =
  | "equity-index"
  | "treasury"
  | "commodity"
  | "currency"
  | "crypto"
  | "unknown";

export interface AntilagBarometerState {
  spiked: boolean;
  range?: number | null;
  atr?: number | null;
}

export interface AntilagEvent {
  id: string;
  userId: string;
  source: "tradingview";
  instrument: string;
  instrumentClass: AntilagInstrumentClass;
  triggeredAt: string;
  triggeredBusinessDate: string;
  timeframe: string;
  atrLookback: number;
  atrMultiple: number;
  nqSpiked: boolean;
  barometerSpikeCount: number;
  barometers: Record<string, AntilagBarometerState>;
  createdAt: string;
}

export interface AntilagSummary {
  activeBusinessDates: string[];
  activeCount: number;
  latestEvent: AntilagEvent | null;
  instruments: string[];
  barometerMix: Array<{ mix: string; count: number }>;
}

interface AntilagPayload {
  source?: string;
  eventType?: string;
  secret?: string;
  instrument?: string;
  timeframe?: string;
  atrLookback?: number;
  atrMultiple?: number;
  triggeredAt?: string;
  nq?: { spiked?: boolean; range?: number; atr?: number };
  nqSpiked?: boolean;
  barometers?: Record<string, AntilagBarometerState>;
  barometerSpikeCount?: number;
}

const BAROMETERS = ["US02Y", "US10Y", "US30Y"] as const;
const memoryEvents: AntilagEvent[] = [];

export function classifyInstrument(instrument: string): AntilagInstrumentClass {
  const normalized = normalizeInstrument(instrument);
  if (["NQ", "MNQ", "ES", "MES", "YM", "MYM", "RTY", "M2K"].includes(normalized))
    return "equity-index";
  if (["ZT", "ZN", "ZB", "UB", "US02Y", "US10Y", "US30Y"].includes(normalized))
    return "treasury";
  if (["CL", "MCL", "GC", "MGC", "SI", "SIL", "NG"].includes(normalized))
    return "commodity";
  if (["6E", "6J", "6B", "6A", "6C", "6S"].includes(normalized))
    return "currency";
  if (["BTC", "ETH"].includes(normalized)) return "crypto";
  return "unknown";
}

export function normalizeInstrument(value: string): string {
  return value.replace(/^\//, "").trim().toUpperCase();
}

export function activeBusinessDates(now = new Date()): string[] {
  const dates: string[] = [];
  let cursor = dateInNewYork(now);
  while (dates.length < 5) {
    if (isBusinessDate(cursor)) dates.push(cursor);
    cursor = addIsoDays(cursor, -1);
  }
  return dates;
}

export async function recordTradingViewAntilagAlert(opts: {
  userId: string;
  payload: AntilagPayload;
}): Promise<{ recorded: boolean; event?: AntilagEvent; reason?: string }> {
  const parsed = parsePayload(opts.userId, opts.payload);
  if ("reason" in parsed) return { recorded: false, reason: parsed.reason };

  const event = parsed.event;
  const sb = getSupabaseClient();
  if (!sb) {
    memoryEvents.unshift(event);
    return { recorded: true, event };
  }

  const { error } = await sb.from("agent_desk_antilag_events").insert({
    id: event.id,
    user_id: event.userId,
    source: event.source,
    instrument: event.instrument,
    instrument_class: event.instrumentClass,
    triggered_at: event.triggeredAt,
    triggered_business_date: event.triggeredBusinessDate,
    timeframe: event.timeframe,
    atr_lookback: event.atrLookback,
    atr_multiple: event.atrMultiple,
    nq_spiked: event.nqSpiked,
    barometer_spike_count: event.barometerSpikeCount,
    barometers: event.barometers,
    raw_payload: sanitizePayload(opts.payload),
  });
  if (error) return { recorded: false, reason: error.message };
  return { recorded: true, event };
}

export async function listAntilagTimes(opts: {
  instrument?: string;
  now?: Date;
} = {}): Promise<AntilagEvent[]> {
  const activeDates = activeBusinessDates(opts.now);
  const instrument = opts.instrument ? normalizeInstrument(opts.instrument) : null;
  const sb = getSupabaseClient();
  if (!sb) return filterMemoryEvents(activeDates, instrument);

  let query = sb
    .from("agent_desk_antilag_events")
    .select("*")
    .in("triggered_business_date", activeDates)
    .order("triggered_at", { ascending: false })
    .limit(100);
  if (instrument) query = query.eq("instrument", instrument);

  const { data, error } = await query;
  if (error) return [];
  return (data ?? []).map(rowToEvent);
}

export async function getAntilagSummary(now = new Date()): Promise<AntilagSummary> {
  const dates = activeBusinessDates(now);
  const events = await listAntilagTimes({ now });
  const instruments = [...new Set(events.map((event) => event.instrument))].sort();
  const mixCounts = new Map<string, number>();
  for (const event of events) {
    const mix = BAROMETERS.filter((key) => event.barometers[key]?.spiked).join("+");
    mixCounts.set(mix || "none", (mixCounts.get(mix || "none") ?? 0) + 1);
  }
  return {
    activeBusinessDates: dates,
    activeCount: events.length,
    latestEvent: events[0] ?? null,
    instruments,
    barometerMix: [...mixCounts.entries()]
      .map(([mix, count]) => ({ mix, count }))
      .sort((a, b) => b.count - a.count),
  };
}

function parsePayload(
  userId: string,
  payload: AntilagPayload,
): { event: AntilagEvent } | { reason: string } {
  const instrument = normalizeInstrument(payload.instrument ?? "");
  if (instrument !== "NQ") return { reason: "Only NQ Antilag alerts are auto-recorded" };

  const nqSpiked = Boolean(payload.nq?.spiked ?? payload.nqSpiked);
  if (!nqSpiked) return { reason: "NQ spike is required" };

  const barometers = normalizeBarometers(payload.barometers ?? {});
  const count = BAROMETERS.filter((key) => barometers[key].spiked).length;
  if (count < 2) return { reason: "At least 2 of 3 barometers must spike" };

  const triggeredAt = parseTriggeredAt(payload.triggeredAt);
  const atrLookback = Math.max(1, Number(payload.atrLookback ?? 14));
  const atrMultiple = Math.max(0, Number(payload.atrMultiple ?? 2));

  return {
    event: {
      id: crypto.randomUUID(),
      userId: userId || "system",
      source: "tradingview",
      instrument,
      instrumentClass: classifyInstrument(instrument),
      triggeredAt: triggeredAt.toISOString(),
      triggeredBusinessDate: dateInNewYork(triggeredAt),
      timeframe: String(payload.timeframe ?? "1"),
      atrLookback,
      atrMultiple,
      nqSpiked,
      barometerSpikeCount: count,
      barometers,
      createdAt: new Date().toISOString(),
    },
  };
}

function normalizeBarometers(input: Record<string, AntilagBarometerState>) {
  return Object.fromEntries(
    BAROMETERS.map((key) => [key, { ...input[key], spiked: Boolean(input[key]?.spiked) }]),
  ) as Record<string, AntilagBarometerState>;
}

function parseTriggeredAt(value?: string): Date {
  const date = value ? new Date(value) : new Date();
  return Number.isFinite(date.getTime()) ? date : new Date();
}

function sanitizePayload(payload: AntilagPayload): Record<string, unknown> {
  const { secret: _secret, ...rest } = payload;
  return rest as Record<string, unknown>;
}

function filterMemoryEvents(activeDates: string[], instrument: string | null) {
  return memoryEvents.filter((event) => {
    if (!activeDates.includes(event.triggeredBusinessDate)) return false;
    return !instrument || event.instrument === instrument;
  });
}

function rowToEvent(row: Record<string, unknown>): AntilagEvent {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    source: "tradingview",
    instrument: String(row.instrument),
    instrumentClass: String(row.instrument_class) as AntilagInstrumentClass,
    triggeredAt: String(row.triggered_at),
    triggeredBusinessDate: String(row.triggered_business_date),
    timeframe: String(row.timeframe),
    atrLookback: Number(row.atr_lookback),
    atrMultiple: Number(row.atr_multiple),
    nqSpiked: Boolean(row.nq_spiked),
    barometerSpikeCount: Number(row.barometer_spike_count),
    barometers: row.barometers as Record<string, AntilagBarometerState>,
    createdAt: String(row.created_at),
  };
}

function dateInNewYork(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function isBusinessDate(dateIso: string): boolean {
  const day = new Date(`${dateIso}T12:00:00Z`).getUTCDay();
  return day !== 0 && day !== 6;
}

function addIsoDays(dateIso: string, days: number): string {
  const date = new Date(`${dateIso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

