// [claude-code 2026-04-23] S30-T1 heatmaps + KPI flip
//
// Diverging daily-performance heatmap for a single futures contract.
// Positive days shade toward the user's bullishColor, negative toward
// bearishColor, opacity = min(|pct|, 2%) / 2%. Falls back to mock JSON
// keyed by contract until /api/market/futures-daily ships in T3.

import { useEffect, useMemo, useState } from "react";
import { TrendingUp } from "lucide-react";
import { getDivergingColor } from "../../../lib/trade-colors";
import {
  DEFAULT_FUSE_PALETTE,
  type FusePalette,
} from "../../../lib/fuse-palette";
import futuresDailyMock from "../../../lib/__mocks__/futures-daily.json";
import {
  HeatmapGrid,
  buildYearColumns,
  type HeatmapColumn,
} from "./HeatmapGrid";

const CONTRACTS = ["ES", "NQ", "MES", "MNQ", "CL", "GC", "6E"] as const;
type Contract = (typeof CONTRACTS)[number];

interface FuturesBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  pctChange: number;
}

interface FuturesDailyHeatmapProps {
  palette?: FusePalette;
  defaultContract?: string;
  includeWeekends?: boolean;
}

const CELL = 14;
const CELL_BORDER = "var(--fintheon-accent-10, rgba(199,159,74,0.12))";
const MOCK = futuresDailyMock as Record<string, FuturesBar[]>;

function resolveContract(raw: string | undefined): Contract {
  const upper = (raw ?? "").toUpperCase();
  return (CONTRACTS as readonly string[]).includes(upper)
    ? (upper as Contract)
    : "ES";
}

async function fetchBars(
  contract: Contract,
  year: number,
): Promise<FuturesBar[]> {
  const params = new URLSearchParams({ contract, from: `${year}-01-01` });
  try {
    const res = await fetch(`/api/market/futures-daily?${params}`);
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json?.bars) && json.bars.length > 0) return json.bars;
    }
  } catch {
    /* fall through */
  }
  return MOCK[contract] ?? MOCK.ES ?? [];
}

async function fetchSummary(date: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/market/daily-summary?date=${date}`);
    if (!res.ok) return null;
    const json = await res.json();
    const raw = json?.summary ?? json?.text ?? null;
    if (typeof raw !== "string") return null;
    return raw.length > 160 ? `${raw.slice(0, 157)}…` : raw;
  } catch {
    return null;
  }
}

export function FuturesDailyHeatmap({
  palette = DEFAULT_FUSE_PALETTE,
  defaultContract,
  includeWeekends = false,
}: FuturesDailyHeatmapProps) {
  const currentYear = new Date().getUTCFullYear();
  const [contract, setContract] = useState<Contract>(
    resolveContract(defaultContract),
  );
  const [bars, setBars] = useState<FuturesBar[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [summaryCache, setSummaryCache] = useState<
    Record<string, string | null>
  >({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchBars(contract, currentYear).then((b) => {
      if (cancelled) return;
      setBars(b);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [contract, currentYear]);

  useEffect(() => {
    if (!selectedDate || summaryCache[selectedDate] !== undefined) return;
    let cancelled = false;
    fetchSummary(selectedDate).then((text) => {
      if (!cancelled)
        setSummaryCache((prev) => ({ ...prev, [selectedDate]: text }));
    });
    return () => {
      cancelled = true;
    };
  }, [selectedDate, summaryCache]);

  const { byDay, stats } = useMemo(() => {
    const byDay = new Map<string, FuturesBar>();
    let up = 0;
    let down = 0;
    let totalAbs = 0;
    for (const bar of bars) {
      byDay.set(bar.date.slice(0, 10), bar);
      if (bar.pctChange > 0) up++;
      else if (bar.pctChange < 0) down++;
      totalAbs += Math.abs(bar.pctChange);
    }
    const avgAbs = bars.length > 0 ? totalAbs / bars.length : 0;
    return { byDay, stats: { count: bars.length, up, down, avgAbs } };
  }, [bars]);

  const columns: HeatmapColumn[] = useMemo(() => {
    return buildYearColumns(currentYear).map((col) => ({
      weekStart: col.weekStart,
      cells: col.days.map((dayKey, i) => {
        const bar = dayKey ? byDay.get(dayKey) : null;
        const isSelected = selectedDate === dayKey;
        const bg =
          bar != null
            ? getDivergingColor(bar.pctChange / 100, palette, 0.02)
            : "transparent";
        const title = bar
          ? `${bar.date} · ${contract} ${bar.open}→${bar.close} · ${bar.pctChange >= 0 ? "+" : ""}${bar.pctChange}%`
          : dayKey
            ? `${dayKey} · no session`
            : "";
        return {
          key: `${col.weekStart}-${i}`,
          dateKey: dayKey,
          bg,
          borderColor: isSelected ? "var(--fintheon-accent)" : CELL_BORDER,
          title,
          disabled: !bar,
          onClick: bar ? () => setSelectedDate(dayKey) : undefined,
        };
      }),
    }));
  }, [byDay, currentYear, palette, selectedDate, contract]);

  const weekdayRows = includeWeekends ? 7 : 5;
  const selectedBar = selectedDate ? byDay.get(selectedDate) : null;
  const selectedSummary = selectedDate ? summaryCache[selectedDate] : null;

  return (
    <div className="bg-[var(--fintheon-surface)] border border-[var(--fintheon-accent)]/20 rounded-lg p-3 h-full flex flex-col">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-start gap-2">
          <TrendingUp className="w-3.5 h-3.5 text-[var(--fintheon-accent)] mt-0.5" />
          <div>
            <div className="text-[11px] font-semibold text-[var(--fintheon-text)]">
              {contract} daily performance
            </div>
            <div className="text-[9px] text-[var(--fintheon-muted)] leading-tight">
              {currentYear} YTD · intensity = daily % change (open to close)
            </div>
          </div>
        </div>
        <select
          value={contract}
          onChange={(e) => {
            setContract(resolveContract(e.target.value));
            setSelectedDate(null);
          }}
          className="text-[9px] bg-transparent border border-[var(--fintheon-accent)]/20 rounded px-1.5 py-0.5 text-[var(--fintheon-text)]"
        >
          {CONTRACTS.map((c) => (
            <option key={c} value={c} className="bg-[var(--fintheon-bg)]">
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="text-[9px] text-[var(--fintheon-muted)] mb-1.5">
        {loading
          ? "Loading…"
          : `${stats.count} trading days YTD · ${stats.up} up · ${stats.down} down · avg ±${stats.avgAbs.toFixed(2)}%`}
      </div>

      <HeatmapGrid
        columns={columns}
        weekdayRows={weekdayRows}
        cellSize={CELL}
      />

      {selectedBar && (
        <div className="mt-2 border-t border-[var(--fintheon-accent)]/15 pt-2 text-[10px] text-[var(--fintheon-text)]">
          <div className="flex items-center justify-between">
            <span>
              <span className="text-[var(--fintheon-muted)]">
                {selectedBar.date}
              </span>{" "}
              · {contract} {selectedBar.open}→{selectedBar.close}
            </span>
            <span
              style={{
                color:
                  selectedBar.pctChange >= 0
                    ? (palette.bullishColor ?? "#c79f4a")
                    : (palette.bearishColor ?? "#b4443a"),
              }}
            >
              {selectedBar.pctChange >= 0 ? "+" : ""}
              {selectedBar.pctChange}%
            </span>
          </div>
          <div className="text-[9px] text-[var(--fintheon-muted)] mt-1 leading-snug">
            {selectedSummary === undefined
              ? "Loading summary…"
              : (selectedSummary ?? "No market summary on file.")}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mt-2 text-[8px] text-[var(--fintheon-muted)]">
        <span>−2%</span>
        <div className="flex" style={{ gap: "1px" }}>
          {[-1, -0.75, -0.5, -0.25, 0.25, 0.5, 0.75, 1].map((step) => (
            <span
              key={step}
              style={{
                width: `${CELL - 4}px`,
                height: `${CELL - 4}px`,
                background: getDivergingColor(step * 0.02, palette, 0.02),
                display: "inline-block",
                borderRadius: "1px",
              }}
            />
          ))}
        </div>
        <span>+2%</span>
      </div>
    </div>
  );
}
