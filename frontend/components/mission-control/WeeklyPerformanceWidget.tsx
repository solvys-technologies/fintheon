// [claude-code 2026-04-23] S30-T2: Strategium right panel widget — replaces BlindspotsWidget.
// Shows a per-day readout of the selected instrument for the current week (Mon-Fri).
// Each row expands inline via chevron to reveal IV score, top risk-flow blurb, and
// session metrics. Live price/% for today comes from backend.marketData.getQuote;
// past days are stubbed until T3 lands historical bar wiring.
import { useState, useEffect, useMemo } from "react";
import { CalendarDays, ChevronDown, ChevronRight } from "lucide-react";
import { useBackend } from "../../lib/backend";
import { useSettings } from "../../contexts/SettingsContext";
import { useAuth } from "../../contexts/AuthContext";
import { LockedCard } from "../ui/LockedCard";
import { IS_INTERNAL_BUILD } from "../../lib/internal-build";
import { IVStack, type IVStackDirection } from "../shared/IVStack";

const DEFAULT_INSTRUMENT = "MNQ";

interface DayRow {
  date: string;
  dayLabel: string;
  isoDay: number;
  /** Absolute point change (null = no data). */
  pointDelta: number | null;
  /** Percent change (null = no data). */
  percentChange: number | null;
  ivScore: number | null;
  direction: IVStackDirection;
  /** 1-line summary from top scored_riskflow_items match. */
  summary: string;
  sessionHigh: number | null;
  sessionLow: number | null;
  largestTradePnl: number | null;
  tradeCount: number;
  isToday: boolean;
  isFuture: boolean;
}

function mondayOfWeek(ref = new Date()): Date {
  const d = new Date(ref);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay(); // 0=Sun, 1=Mon
  const offset = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + offset);
  return d;
}

function formatDayLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

function formatIsoDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function resolveDirection(pct: number | null): IVStackDirection {
  if (pct == null) return null;
  if (pct > 0.15) return "Bullish";
  if (pct < -0.15) return "Bearish";
  return "Neutral";
}

function buildWeek(todayIso: string): DayRow[] {
  const monday = mondayOfWeek();
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const iso = formatIsoDate(d);
    return {
      date: iso,
      dayLabel: formatDayLabel(d),
      isoDay: d.getDay(),
      pointDelta: null,
      percentChange: null,
      ivScore: null,
      direction: null,
      summary: "",
      sessionHigh: null,
      sessionLow: null,
      largestTradePnl: null,
      tradeCount: 0,
      isToday: iso === todayIso,
      isFuture: iso > todayIso,
    };
  });
}

function formatPoints(v: number | null): string {
  if (v == null) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}`;
}

function formatPct(v: number | null): string {
  if (v == null) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}

function deltaColor(v: number | null): string {
  if (v == null || v === 0) return "var(--fintheon-muted)";
  return v > 0 ? "var(--fintheon-bullish)" : "var(--fintheon-bearish)";
}

export function WeeklyPerformanceWidget() {
  const { tier } = useAuth();
  const backend = useBackend();
  const { selectedSymbol } = useSettings();
  const isLocked = !IS_INTERNAL_BUILD && tier === "free";

  const instrument = selectedSymbol?.symbol || DEFAULT_INSTRUMENT;
  const todayIso = useMemo(() => formatIsoDate(new Date()), []);
  const [rows, setRows] = useState<DayRow[]>(() => buildWeek(todayIso));
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  useEffect(() => {
    setRows(buildWeek(todayIso));
  }, [todayIso, instrument]);

  // Hydrate TODAY's row from the live quote; past days stay stubbed until T3
  // wires historical bars.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const quote = await backend.marketData.getQuote(instrument);
        if (cancelled) return;
        setRows((prev) =>
          prev.map((r) =>
            r.isToday
              ? {
                  ...r,
                  pointDelta: quote.change ?? null,
                  percentChange: quote.changePercent ?? null,
                  direction: resolveDirection(quote.changePercent ?? null),
                  sessionHigh: quote.price ?? null,
                  sessionLow: quote.price ?? null,
                }
              : r,
          ),
        );
      } catch {
        // keep stub row
      }
    };
    load();
    const interval = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [backend, instrument]);

  const content = (
    <div className="p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-[var(--fintheon-accent)]" />
          <h3 className="text-sm font-semibold text-[var(--fintheon-accent)]">
            Weekly Performance
          </h3>
        </div>
        <span className="text-[9px] font-mono text-[var(--fintheon-accent)]/70 uppercase tracking-wider">
          {instrument}
        </span>
      </div>
      <div className="flex flex-col">
        {rows.map((row) => {
          const isOpen = expandedDate === row.date;
          return (
            <div
              key={row.date}
              className="border-b border-[var(--fintheon-accent)]/10 last:border-b-0"
            >
              <button
                type="button"
                onClick={() =>
                  setExpandedDate((cur) => (cur === row.date ? null : row.date))
                }
                className={`w-full grid grid-cols-[42px_1fr_60px_20px] items-center gap-2 py-1.5 px-1 text-left hover:bg-[var(--fintheon-accent)]/5 transition-colors ${
                  row.isToday ? "bg-[var(--fintheon-accent)]/[0.04]" : ""
                }`}
              >
                <span
                  className={`text-[10px] font-mono tracking-wider ${
                    row.isToday
                      ? "text-[var(--fintheon-accent)]"
                      : "text-[var(--fintheon-text)]"
                  }`}
                >
                  {row.dayLabel}
                </span>
                <span
                  className="text-[11px] font-mono tabular-nums"
                  style={{ color: deltaColor(row.pointDelta) }}
                >
                  {row.isFuture ? "—" : formatPoints(row.pointDelta)}
                </span>
                <span
                  className="text-[10px] font-mono tabular-nums text-right"
                  style={{ color: deltaColor(row.percentChange) }}
                >
                  {row.isFuture ? "" : formatPct(row.percentChange)}
                </span>
                {isOpen ? (
                  <ChevronDown className="w-3 h-3 text-[var(--fintheon-accent)]/60 justify-self-end" />
                ) : (
                  <ChevronRight className="w-3 h-3 text-[var(--fintheon-accent)]/60 justify-self-end" />
                )}
              </button>
              {isOpen && <ExpandedRow row={row} />}
            </div>
          );
        })}
      </div>
    </div>
  );

  return <LockedCard locked={isLocked}>{content}</LockedCard>;
}

function ExpandedRow({ row }: { row: DayRow }) {
  const summary =
    row.summary ||
    (row.isFuture
      ? "No data — session hasn't started."
      : "No scored risk-flow item logged for this session.");

  return (
    <div className="px-2 pb-2 pt-1 flex items-start gap-2">
      <IVStack
        score={row.ivScore}
        direction={row.direction}
        width={32}
        fontSize={12}
        chevronSize={12}
      />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] leading-tight text-[var(--fintheon-text)] mb-1.5">
          {summary}
        </p>
        <dl className="grid grid-cols-3 gap-x-2 gap-y-0.5 text-[9px]">
          <MetricCell
            label="Range"
            value={
              row.sessionHigh != null && row.sessionLow != null
                ? `${row.sessionLow.toFixed(2)}–${row.sessionHigh.toFixed(2)}`
                : "—"
            }
          />
          <MetricCell
            label="Top P&L"
            value={
              row.largestTradePnl != null
                ? `${row.largestTradePnl >= 0 ? "+" : ""}$${row.largestTradePnl.toFixed(0)}`
                : "—"
            }
          />
          <MetricCell label="Trades" value={String(row.tradeCount)} />
        </dl>
      </div>
    </div>
  );
}

function MetricCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-[var(--fintheon-muted)] uppercase tracking-wider">
        {label}
      </dt>
      <dd className="font-mono tabular-nums text-[var(--fintheon-text)]">
        {value}
      </dd>
    </div>
  );
}
