// [claude-code 2026-05-15] S66-T1: split into legacy useDayPlanWeek (WeekDayEntry[])
//   and new useDayPlanMultiWeek (DayPlan[] with cycling).
// [claude-code 2026-04-26] S45-T2: useDayPlanWeek — Mon–Fri preview pills.
import { useState, useEffect, useRef, useCallback } from "react";
import type { DayPlan, WeekDayEntry } from "../types/day-plan";
import { DAY_PLAN_REFETCH_EVENT } from "./useDayPlan";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";
const POLL_INTERVAL = 5 * 60_000;
const MULTI_REFETCH_EVENT = "fintheon:day-plan-multi-refetch";

async function fetchTodayPlanFallback(): Promise<DayPlan | null> {
  const res = await fetch(`${API_BASE}/api/day-plan/today`);
  if (!res.ok) return null;
  const json = (await res.json()) as { plan?: DayPlan | null };
  return json.plan ?? null;
}

function hasDeskPlanWindows(plan: DayPlan | null | undefined): plan is DayPlan {
  return Boolean(
    plan && Array.isArray(plan.windows) && plan.windows.length > 0,
  );
}

export function useDayPlanWeek() {
  const [data, setData] = useState<WeekDayEntry[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchWeek() {
      try {
        const res = await fetch(`${API_BASE}/api/day-plan/week`);
        if (!res.ok) {
          if (!cancelled) {
            setError(`HTTP ${res.status}`);
            setIsLoading(false);
          }
          return;
        }
        const json = (await res.json()) as
          | WeekDayEntry[]
          | { days?: WeekDayEntry[]; week?: WeekDayEntry[] };
        let days: WeekDayEntry[] = [];
        if (Array.isArray(json)) {
          days = json;
        } else {
          days = (json as any).week ?? (json as any).days ?? [];
        }
        if (!cancelled) {
          setData(days);
          setError(null);
          setIsLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError("Network error");
          setIsLoading(false);
        }
      }
    }

    fetchWeek();
    intervalRef.current = setInterval(fetchWeek, POLL_INTERVAL);

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return { data, isLoading, error };
}

interface DayPlanMultiWeekState {
  allPlans: DayPlan[];
  currentPlanIndex: number;
  totalPlans: number;
  currentPlan: DayPlan | null;
  isLoading: boolean;
  error: string | null;
  goNext: () => void;
  goPrev: () => void;
}

export function useDayPlanMultiWeek(): DayPlanMultiWeekState {
  const [allPlans, setAllPlans] = useState<DayPlan[]>([]);
  const [currentPlanIndex, setCurrentPlanIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const goNext = useCallback(() => {
    setCurrentPlanIndex((i) => Math.min(allPlans.length - 1, i + 1));
  }, [allPlans.length]);

  const goPrev = useCallback(() => {
    setCurrentPlanIndex((i) => Math.max(0, i - 1));
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchMultiWeek() {
      try {
        const res = await fetch(`${API_BASE}/api/day-plan/multi-week`);
        if (!res.ok) {
          const fallbackPlan = await fetchTodayPlanFallback().catch(() => null);
          if (!cancelled) {
            setAllPlans(fallbackPlan ? [fallbackPlan] : []);
            setError(fallbackPlan ? null : `HTTP ${res.status}`);
            setIsLoading(false);
          }
          return;
        }
        const json = (await res.json()) as { weeks: DayPlan[][] };
        const flat = (json.weeks ?? []).flat();
        const fallbackPlan = flat.some(hasDeskPlanWindows)
          ? null
          : await fetchTodayPlanFallback().catch(() => null);
        const plans =
          fallbackPlan && !flat.some(hasDeskPlanWindows)
            ? [fallbackPlan]
            : flat;
        if (!cancelled) {
          setAllPlans(plans);
          setCurrentPlanIndex((prev) => (prev >= plans.length ? 0 : prev));
          setError(null);
          setIsLoading(false);
        }
      } catch {
        const fallbackPlan = await fetchTodayPlanFallback().catch(() => null);
        if (!cancelled) {
          setAllPlans(fallbackPlan ? [fallbackPlan] : []);
          setError(fallbackPlan ? null : "Network error");
          setIsLoading(false);
        }
      }
    }

    fetchMultiWeek();
    window.addEventListener(DAY_PLAN_REFETCH_EVENT, fetchMultiWeek);
    window.addEventListener(MULTI_REFETCH_EVENT, fetchMultiWeek);
    intervalRef.current = setInterval(fetchMultiWeek, POLL_INTERVAL);

    return () => {
      cancelled = true;
      window.removeEventListener(DAY_PLAN_REFETCH_EVENT, fetchMultiWeek);
      window.removeEventListener(MULTI_REFETCH_EVENT, fetchMultiWeek);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return {
    allPlans,
    currentPlanIndex,
    totalPlans: allPlans.length,
    currentPlan: allPlans[currentPlanIndex] ?? null,
    isLoading,
    error,
    goNext,
    goPrev,
  };
}
