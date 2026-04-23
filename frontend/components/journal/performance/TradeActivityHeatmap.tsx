// [claude-code 2026-04-23] S30-T1 heatmaps + KPI flip
//
// GitHub-style activity heatmap for ProjectX trade history. Rows = weekday,
// columns = weeks of the selected year, cell color = user's bullishColor
// with opacity scaled by normalized daily intensity (count / qty / notional).

import { useEffect, useMemo, useState } from "react";
import { Activity } from "lucide-react";
import { getIntensityColor } from "../../../lib/trade-colors";
import {
  DEFAULT_FUSE_PALETTE,
  type FusePalette,
} from "../../../lib/fuse-palette";
import {
  HeatmapGrid,
  buildYearColumns,
  type HeatmapColumn,
} from "./HeatmapGrid";

type ActivityMetric = "trades" | "shares" | "notional";

interface TradeRow {
  id: string;
  contract: string;
  entryAt: string;
  qty: number;
  entryPrice: number;
}

interface TradeActivityHeatmapProps {
  palette?: FusePalette;
  includeWeekends?: boolean;
}

const METRIC_LABELS: Record<ActivityMetric, string> = {
  trades: "Trades",
  shares: "Shares",
  notional: "Notional",
};

const CELL = 11;
const CELL_BORDER = "var(--fintheon-accent-10, rgba(199,159,74,0.12))";

function contribution(metric: ActivityMetric, t: TradeRow): number {
  if (metric === "trades") return 1;
  if (metric === "shares") return Math.abs(t.qty ?? 0);
  return Math.abs((t.qty ?? 0) * (t.entryPrice ?? 0));
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
    const by = new Map<string, number>();
    const years = new Set<number>([currentYear]);
    for (const t of trades) {
      if (!t.entryAt) continue;
      const key = t.entryAt.slice(0, 10);
      years.add(Number(key.slice(0, 4)));
      by.set(key, (by.get(key) ?? 0) + contribution(metric, t));
    }
    const yrs: number[] = [];
    for (let y = Math.max(...years); y >= Math.min(...years); y--) yrs.push(y);
    return { byDay: by, activeDays: by.size, availableYears: yrs };
  }, [trades, metric, currentYear]);

  const { columns, maxValue } = useMemo(() => {
    const raw = buildYearColumns(year);
    let max = 0;
    const cols: HeatmapColumn[] = raw.map((col) => ({
      weekStart: col.weekStart,
      cells: col.days.map((dayKey, i) => {
        const value = dayKey ? (byDay.get(dayKey) ?? 0) : 0;
        if (value > max) max = value;
        return {
          key: `${col.weekStart}-${i}`,
          dateKey: dayKey,
          bg: "transparent",
          borderColor: CELL_BORDER,
          title: "",
        };
      }),
    }));
    cols.forEach((col) =>
      col.cells.forEach((cell) => {
        if (!cell.dateKey) return;
        const value = byDay.get(cell.dateKey) ?? 0;
        cell.bg = getIntensityColor(value, palette, { min: 0, max });
        cell.title = `${cell.dateKey} · ${value.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${METRIC_LABELS[metric].toLowerCase()}`;
      }),
    );
    return { columns: cols, maxValue: max };
  }, [byDay, year, palette, metric]);

  const weekdayRows = includeWeekends ? 7 : 5;
  const legendSteps = [0.1, 0.3, 0.55, 0.8, 1];

  return (
    <div className="bg-[var(--fintheon-surface)] border border-[var(--fintheon-accent)]/20 rounded-lg p-3 h-full flex flex-col">
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

      <HeatmapGrid
        columns={columns}
        weekdayRows={weekdayRows}
        cellSize={CELL}
      />

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
                border: `1px solid ${CELL_BORDER}`,
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
