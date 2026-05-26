import { useCallback, useEffect, useState } from "react";
import type { NarrativeHeadlineOption } from "../components/narrative/sensemaking-types";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

export interface NarrativeRiskFlowHeadlinesState {
  headlines: NarrativeHeadlineOption[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useNarrativeRiskFlowHeadlines(): NarrativeRiskFlowHeadlinesState {
  const [headlines, setHeadlines] = useState<NarrativeHeadlineOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestKey, setRequestKey] = useState(0);

  const refetch = useCallback(() => {
    setRequestKey((current) => current + 1);
  }, []);

  useEffect(() => {
    let isCancelled = false;

    async function loadHeadlines() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `${API_BASE}/api/riskflow/feed?limit=120&minMacroLevel=1`,
        );
        const data = response.ok ? await response.json() : { items: [] };
        if (isCancelled) return;
        setHeadlines(mapRiskFlowItems(data.items ?? []));
        if (!response.ok) setError(`RiskFlow feed ${response.status}`);
      } catch (err) {
        if (isCancelled) return;
        setHeadlines([]);
        setError(err instanceof Error ? err.message : "RiskFlow feed failed");
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    }

    loadHeadlines();

    return () => {
      isCancelled = true;
    };
  }, [requestKey]);

  return { headlines, isLoading, error, refetch };
}

function mapRiskFlowItems(
  items: Array<Record<string, unknown>>,
): NarrativeHeadlineOption[] {
  return items
    .map((item) => ({
      id: String(item.id ?? item.tweet_id ?? ""),
      headline: String(item.headline ?? item.title ?? "Untitled headline"),
      summary: String(item.body ?? item.summary ?? item.content ?? ""),
      source: String(item.source ?? "RiskFlow"),
      severity: String(item.severity ?? item.impact ?? "medium"),
      publishedAt: String(
        item.publishedAt ?? item.published_at ?? new Date().toISOString(),
      ),
      ivScore: toOptionalNumber(item.ivScore ?? item.iv_score ?? item.ivImpact),
      macroLevel: toOptionalNumber(item.macroLevel ?? item.macro_level),
      symbols: Array.isArray(item.symbols) ? item.symbols.map(String) : [],
      tags: Array.isArray(item.tags) ? item.tags.map(String) : [],
      narrativeThreads: Array.isArray(item.narrativeThreads)
        ? item.narrativeThreads.map(String)
        : Array.isArray(item.narrative_threads)
          ? item.narrative_threads.map(String)
          : [],
    }))
    .filter((item) => item.id.length > 0);
}

function toOptionalNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
