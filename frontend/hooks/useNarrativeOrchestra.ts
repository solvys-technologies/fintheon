import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NarrativeProjection } from "../../backend-hono/src/services/narrative-orchestra/types";

const API_BASE =
  (import.meta as any).env?.VITE_API_URL || "http://localhost:8080";

const EMPTY_PROJECTION: NarrativeProjection = {
  hypotheses: [],
  generatedAt: new Date().toISOString(),
  source: "fallback",
  fallbackReason: "Narrative Orchestra has not returned a projection yet.",
};

interface UseNarrativeOrchestraOptions {
  refreshMs?: number;
}

export function useNarrativeOrchestra({
  refreshMs = 30_000,
}: UseNarrativeOrchestraOptions = {}) {
  const [projection, setProjection] =
    useState<NarrativeProjection>(EMPTY_PROJECTION);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchProjection = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsRefreshing(true);
    try {
      const res = await fetch(`${API_BASE}/api/narrative/orchestra`, {
        credentials: "include",
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Narrative Orchestra ${res.status}`);
      const next = (await res.json()) as NarrativeProjection;
      setProjection(normalizeProjection(next));
      setError(null);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setProjection((current) => ({
        ...current,
        source: "fallback",
        fallbackReason:
          err instanceof Error
            ? err.message
            : "Narrative Orchestra unavailable.",
      }));
      setError(err instanceof Error ? err.message : "Projection unavailable");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchProjection();
    const interval = setInterval(fetchProjection, refreshMs);
    return () => {
      clearInterval(interval);
      abortRef.current?.abort();
    };
  }, [fetchProjection, refreshMs]);

  return useMemo(
    () => ({
      projection,
      hypotheses: projection.hypotheses,
      isLoading,
      isRefreshing,
      error,
      refresh: fetchProjection,
    }),
    [projection, isLoading, isRefreshing, error, fetchProjection],
  );
}

function normalizeProjection(input: NarrativeProjection): NarrativeProjection {
  return {
    hypotheses: Array.isArray(input.hypotheses) ? input.hypotheses : [],
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    source: input.source === "lounge" ? "lounge" : "fallback",
    fallbackReason: input.fallbackReason ?? null,
  };
}
