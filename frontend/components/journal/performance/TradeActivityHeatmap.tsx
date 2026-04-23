// [claude-code 2026-04-23] S30-T1 heatmaps + KPI flip
//
// GitHub-style activity heatmap for ProjectX trade history. Rows = weekday,
// columns = weeks of the selected year, cell color = user's bullishColor
// with opacity scaled by normalized daily intensity (count / qty / notional).

import { useEffect, useMemo, useState } from "react";
import { Activity } from "@/components/shared/iso-icons";
import { getIntensityColor } from "../../../lib/trade-colors";
import {
  DEFAULT_FUSE_PALETTE,
  type FusePalette,
} from "../../../lib/fuse-palette";

type ActivityMetric = "trades" | "shares" | "notional";

interface TradeRow {
  id: string;
  contract: string;
  entryAt: string;
  side: string;
  qty: number;
  entryPrice: number;
  exitPrice: number | null;
  realizedPnL: number;
  origin: string;
}

interface TradeActivityHeatmapProps {
  palette?: FusePalette;
  /** Include Sat/Sun rows if the user trades weekends. */
  includeWeekends?: boolean;
}

const METRIC_LABELS: Record<ActivityMetric, string> = {
  trades: "Trades",
  shares: "Shares",
  notional: "Notional",
};

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const CELL = 11;
const GAP = 2;

function toDateKey(iso: string): string {
  return iso.slice(0, 10);
}

function mondayIndex(date: Date): number {
  // 0 = Mon … 6 = Sun (JS getDay: 0=Sun)
  const d = date.getUTCDay();
  return d === 0 ? 6 : d - 1;
}

function isoMondayKey(date: Date): string {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() - mondayIndex(d));
  return d.toISOString().slice(0, 10);
}

function yearsInRange(min: number, max: number): number[] {
  const out: number[] = [];
  for (let y = max; y >= min; y--) out.push(y);
  return out;
}

export function TradeActivityHeatmap({
  palette = DEFAULT_FUSE_PALETTE,
  includeWeekends = false,
}: TradeActivityHeatmapProps) {
  const currentYear = new Date().getUTCFullYear();
  const [year, setYear] = useState<number>(currentYear);
  const [metric, setMetric] = useState<ActivityMetric>("trades");
  const [trades, setTrades] = useState<TradeRow[]>([]);
  const [source, setSource] = useState<string>("projectx");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({
      from: `${year}-01-01`,
      to: `${year}-12-31`,
      limit: "2000",
    });
    fetch(`/api/projectx/trades?${params}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (cancelled) return;
        setTrades(json.trades ?? []);
        setSource(json.source ?? "projectx");
      })
      .catch(() => {
        if (!cancelled) setTrades([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [year]);

  const { byDay, activeDays, availableYears } = useMemo(() => {
    const byDay = new Map<string, number>();
    const years = new Set<number>([currentYear]);
    for (const t of trades) {
      if (!t.entryAt) continue;
      const key = toDateKey(t.entryAt);
      years.add(Number(key.slice(0, 4)));
      const contribution =
        metric === "trades"
          ? 1
          : metric === "shares"
            ? Math.abs(t.qty ?? 0)
            : Math.abs((t.qty ?? 0) * (t.entryPrice ?? 0));
      byDay.set(key, (byDay.get(key) ?? 0) + contribution);
    }
    return {
      byDay,
      activeDays: byDay.size,
      availableYears: yearsInRange(Math.min(...years), Math.max(...years)),
    };
  }, [trades, metric, currentYear]);

  const { columns, maxValue } = useMemo(() => {
    const firstOfYear = new Date(Date.UTC(year, 0, 1));
    const lastOfYear = new Date(Date.UTC(year, 11, 31));
    const startMonday = new Date(firstOfYear);
    startMonday.setUTCDate(startMonday.getUTCDate() - mondayIndex(firstOfYear));

    const cols: { weekStart: string; days: (string | null)[] }[] = [];
    let cursor = new Date(startMonday);
    let max = 0;
    while (cursor <= lastOfYear) {
      const weekStart = cursor.toISOString().slice(0, 10);
      const days: (string | null)[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(cursor);
        d.setUTCDate(d.getUTCDate() + i);
        if (d.getUTCFullYear() === year) {
          const key = d.toISOString().slice(0, 10);
          days.push(key);
          const v = byDay.get(key);
          if (v && v > max) max = v;
        } else {
          days.push(null);
        }
      }
      cols.push({ weekStart, days });
      cursor.setUTCDate(cursor.getUTCDate() + 7);
    }
    return { columns: cols, maxValue: max };
  }, [byDay, year]);

  const weekdayRows = includeWeekends ? 7 : 5;
  const rows = WEEKDAY_LABELS.slice(0, weekdayRows);

  const legendSteps = [0.1, 0.3, 0.55, 0.8, 1];

  return (
    <div className="bg-[var(--fintheon-surface)] border border-[var(--fintheon-accent)]/20 rounded-lg p-3 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-start gap-2">
          <Activity className="w-3.5 h-3.5 text-[var(--fintheon-accent)] mt-0.5" />
          <div>
            <div className="text-[11px] font-semibold text-[var(--fintheon-text)]">
              Trade activity
            </div>
            <div className="text-[9px] text-[var(--fintheon-muted)] leading-tight">
              {source} · {activeDays} active day{activeDays === 1 ? "" : "s"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="text-[9px] bg-transparent border border-[var(--fintheon-accent)]/20 rounded px-1.5 py-0.5 text-[var(--fintheon-text)]"
          >
            {availableYears.map((y) => (
              <option key={y} value={y} className="bg-[var(--fintheon-bg)]">
                {y}
              </option>
            ))}
          </select>
          <div className="flex rounded border border-[var(--fintheon-accent)]/20 overflow-hidden">
            {(Object.keys(METRIC_LABELS) as ActivityMetric[]).map((m) => (
              <button
                key={m}
                onClick={() => setMetric(m)}
                className={`px-2 py-0.5 text-[9px] transition-colors ${
                  metric === m
                    ? "bg-[var(--fintheon-accent)]/20 text-[var(--fintheon-accent)]"
                    : "text-[var(--fintheon-muted)] hover:text-[var(--fintheon-text)]"
                }`}
              >
                {METRIC_LABELS[m]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-x-auto">
        <div className="flex gap-1">
          {/* Weekday labels */}
          <div
            className="flex flex-col text-[8px] text-[var(--fintheon-muted)] pr-1"
            style={{ gap: `${GAP}px`, paddingTop: "2px" }}
          >
            {rows.map((r, i) => (
              <div
                key={r}
                style={{
                  height: `${CELL}px`,
                  lineHeight: `${CELL}px`,
                  visibility: i % 2 === 0 ? "visible" : "hidden",
                }}
              >
                {r}
              </div>
            ))}
          </div>
          {/* Week columns */}
          <div className="flex" style={{ gap: `${GAP}px` }}>
            {columns.map((col) => (
              <div
                key={col.weekStart}
                className="flex flex-col"
                style={{ gap: `${GAP}px` }}
              >
                {col.days.slice(0, weekdayRows).map((dayKey, rowIdx) => {
                  const value = dayKey ? (byDay.get(dayKey) ?? 0) : 0;
                  const bg = dayKey
                    ? getIntensityColor(value, palette, {
                        min: 0,
                        max: maxValue,
                      })
                    : "transparent";
                  const title = dayKey
                    ? `${dayKey} · ${value.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${METRIC_LABELS[metric].toLowerCase()}`
                    : "";
                  return (
                    <div
                      key={`${col.weekStart}-${rowIdx}`}
                      title={title}
                      style={{
                        width: `${CELL}px`,
                        height: `${CELL}px`,
                        background: bg,
                        border: dayKey
                          ? `1px solid var(--fintheon-accent-10, rgba(199,159,74,0.12))`
                          : "none",
                        borderRadius: "1px",
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer legend */}
      <div className="flex items-center justify-between mt-2 text-[8px] text-[var(--fintheon-muted)]">
        <div>
          {loading
            ? "Loading…"
            : maxValue > 0
              ? `Max ${maxValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
              : "No activity"}
        </div>
        <div className="flex items-center gap-1">
          <span>Less</span>
          {legendSteps.map((step) => (
            <span
              key={step}
              style={{
                width: `${CELL}px`,
                height: `${CELL}px`,
                background: getIntensityColor(step, palette, {
                  min: 0,
                  max: 1,
                }),
                border: `1px solid var(--fintheon-accent-10, rgba(199,159,74,0.12))`,
                borderRadius: "1px",
                display: "inline-block",
              }}
            />
          ))}
          <span>More</span>
        </div>
      </div>
    </div>
  );
}
