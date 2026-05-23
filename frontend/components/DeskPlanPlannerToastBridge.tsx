// [codex 2026-05-23] Prompts desk managers to queue weekly plans when empty.
import { useEffect } from "react";
import { useToast } from "../contexts/ToastContext";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";
const STORAGE_PREFIX = "fintheon:weekly-plan-toast:";

interface WeekResponse {
  week?: Array<{ windowCount?: number }>;
}

function todayEt(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function DeskPlanPlannerToastBridge() {
  const { addToast } = useToast();

  useEffect(() => {
    let cancelled = false;
    const id = window.setTimeout(async () => {
      const key = `${STORAGE_PREFIX}${todayEt()}`;
      if (sessionStorage.getItem(key)) return;
      try {
        const res = await fetch(`${API_BASE}/api/day-plan/week`);
        if (!res.ok) return;
        const data = (await res.json()) as WeekResponse;
        const windows = (data.week ?? []).reduce(
          (sum, day) => sum + (day.windowCount ?? 0),
          0,
        );
        if (cancelled || windows > 0) return;
        sessionStorage.setItem(key, "1");
        addToast(
          "Weekly desk plan empty",
          "reminder",
          "Open Econ Calendar, queue catalysts, then send the week to CAO chat.",
          "general",
          "bottom-left",
          {
            label: "Open calendar",
            onClick: () =>
              window.dispatchEvent(
                new CustomEvent("fintheon:navigate-tab", {
                  detail: { tab: "econ" },
                }),
              ),
          },
          undefined,
          18000,
        );
      } catch {
        /* offline tolerant */
      }
    }, 3500);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [addToast]);

  return null;
}
