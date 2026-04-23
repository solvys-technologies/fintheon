import { useState, useMemo } from "react";
import { CalendarControls } from "./CalendarControls";
import { CalendarNav } from "./CalendarNav";
import { ProjectXCalendar } from "./ProjectXCalendar";
import { SolvysCalendar } from "./SolvysCalendar";
import { EquityCurveDrawer } from "./EquityCurveDrawer";
import { useTradeCalendarData } from "./hooks/useTradeCalendarData";
import type {
  CalendarVariant,
  CalendarGranularity,
  OriginFilter,
  CalendarSelection,
} from "./types";

export type { CalendarSelection } from "./types";

interface TradingCalendarProps {
  onSelectionChange?: (sel: CalendarSelection | null) => void;
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function TradingCalendar({ onSelectionChange }: TradingCalendarProps) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [variant, setVariant] = useState<CalendarVariant>("projectx");
  const [granularity, setGranularity] = useState<CalendarGranularity>("month");
  const [origin, setOrigin] = useState<OriginFilter>("all");
  const [selection, setSelection] = useState<CalendarSelection | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { from, to } = useMemo(() => {
    const f = new Date(year, month, 1);
    const t = new Date(year, month + 1, 0);
    return { from: toIsoDate(f), to: toIsoDate(t) };
  }, [year, month]);

  const { byDay, weekTotals, monthTotal, loading, error } =
    useTradeCalendarData(from, to, origin);

  const handlePrev = () => {
    if (month === 0) {
      setYear((y) => y - 1);
      setMonth(11);
    } else {
      setMonth((m) => m - 1);
    }
    setSelection(null);
  };

  const handleNext = () => {
    if (month === 11) {
      setYear((y) => y + 1);
      setMonth(0);
    } else {
      setMonth((m) => m + 1);
    }
    setSelection(null);
  };

  const handleToday = () => {
    const n = new Date();
    setYear(n.getFullYear());
    setMonth(n.getMonth());
    setSelection(null);
  };

  const handleSelect = (sel: CalendarSelection) => {
    setSelection(sel);
    setDrawerOpen(true);
    onSelectionChange?.(sel);
  };

  const CalendarView =
    variant === "projectx" ? ProjectXCalendar : SolvysCalendar;

  return (
    <div className="flex flex-col gap-1">
      <CalendarControls
        variant={variant}
        granularity={granularity}
        origin={origin}
        onVariantChange={setVariant}
        onGranularityChange={setGranularity}
        onOriginChange={setOrigin}
      />

      <CalendarNav
        year={year}
        month={month}
        onPrev={handlePrev}
        onNext={handleNext}
        onToday={handleToday}
        monthTotal={monthTotal.pnl}
        variant={variant}
      />

      {loading && (
        <div className="text-[10px] text-[var(--fintheon-muted)] text-center py-2">
          Loading trades…
        </div>
      )}

      {error && !loading && (
        <div className="text-[10px] text-[var(--fintheon-muted)] text-center py-2">
          No trade data available
        </div>
      )}

      <CalendarView
        year={year}
        month={month}
        byDay={byDay}
        weekTotals={weekTotals}
        selection={selection}
        onSelect={handleSelect}
      />

      {drawerOpen && (
        <EquityCurveDrawer
          selection={selection}
          byDay={byDay}
          onClose={() => setDrawerOpen(false)}
        />
      )}
    </div>
  );
}
