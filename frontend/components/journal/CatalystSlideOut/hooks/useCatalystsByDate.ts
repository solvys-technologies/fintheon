import { useState, useEffect } from "react";
import type { CalendarSelection } from "../../TradingCalendar/types.js";

export type { CalendarSelection };

export interface CatalystItem {
  id: string;
  headline: string;
  source: string;
  url: string | null;
  publishedAt: string | null;
  urgency: "immediate" | "high" | "normal";
  symbols: string[];
  tags: string[];
  sentiment: string;
  score: number;
}

interface UseCatalystsByDateResult {
  catalysts: CatalystItem[];
  isLoading: boolean;
  error: string | null;
}

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

export function useCatalystsByDate(
  selection: CalendarSelection | null,
): UseCatalystsByDateResult {
  const [catalysts, setCatalysts] = useState<CatalystItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selection) {
      setCatalysts([]);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const fromIso = selection.from.toISOString();
    const toIso = selection.to.toISOString();

    setIsLoading(true);
    setError(null);

    fetch(
      `${API_BASE}/api/catalysts/by-date?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`,
      { signal: controller.signal },
    )
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: { catalysts: CatalystItem[] }) => {
        setCatalysts(data.catalysts ?? []);
        setIsLoading(false);
      })
      .catch((err: Error) => {
        if (err.name === "AbortError") return;
        setError(err.message);
        setCatalysts([]);
        setIsLoading(false);
      });

    return () => controller.abort();
  }, [selection?.from.getTime(), selection?.to.getTime(), selection?.kind]);

  return { catalysts, isLoading, error };
}
