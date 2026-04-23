import { useState, useEffect, useMemo } from "react";
import type {
  CalendarTrade,
  ByDay,
  WeekTotal,
  DayAggregate,
  OriginFilter,
} from "../types";

interface CalendarDataResult {
  byDay: ByDay;
  weekTotals: WeekTotal[];
  monthTotal: { pnl: number; count: number; wins: number; losses: number };
  loading: boolean;
  error: string | null;
}

function getWeekNumber(date: Date): number {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function useTradeCalendarData(
  from: string,
  to: string,
  origin: OriginFilter,
): CalendarDataResult {
  const [rawTrades, setRawTrades] = useState<CalendarTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ from, to, limit: "500" });
    if (origin !== "all") params.set("origin", origin);

    fetch(`/api/projectx/trades?${params}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) setRawTrades(json.trades ?? []);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message ?? "Failed to load trades");
          setRawTrades([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [from, to, origin]);

  const result = useMemo<CalendarDataResult>(() => {
    const byDay: ByDay = {};
    const byWeek: Record<number, WeekTotal> = {};
    let monthPnl = 0,
      monthCount = 0,
      monthWins = 0,
      monthLosses = 0;

    for (const trade of rawTrades) {
      const dateStr = trade.entryAt?.slice(0, 10) ?? trade.date;
      if (!dateStr) continue;

      if (!byDay[dateStr]) {
        byDay[dateStr] = {
          date: dateStr,
          pnl: 0,
          count: 0,
          wins: 0,
          losses: 0,
          trades: [],
        };
      }
      const day = byDay[dateStr] as DayAggregate;
      day.pnl += trade.realizedPnl;
      day.count += 1;
      trade.isWin ? day.wins++ : day.losses++;
      day.trades.push(trade);

      const weekNum = getWeekNumber(new Date(dateStr));
      if (!byWeek[weekNum]) {
        byWeek[weekNum] = {
          weekNumber: weekNum,
          pnl: 0,
          count: 0,
          wins: 0,
          losses: 0,
        };
      }
      const wk = byWeek[weekNum] as WeekTotal;
      wk.pnl += trade.realizedPnl;
      wk.count += 1;
      trade.isWin ? wk.wins++ : wk.losses++;

      monthPnl += trade.realizedPnl;
      monthCount += 1;
      trade.isWin ? monthWins++ : monthLosses++;
    }

    const weekTotals = Object.values(byWeek).sort(
      (a, b) => a.weekNumber - b.weekNumber,
    );

    return {
      byDay,
      weekTotals,
      monthTotal: {
        pnl: monthPnl,
        count: monthCount,
        wins: monthWins,
        losses: monthLosses,
      },
      loading,
      error,
    };
  }, [rawTrades, loading, error]);

  return result;
}
