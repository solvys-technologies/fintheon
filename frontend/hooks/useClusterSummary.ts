// [claude-code 2026-04-24] S36 ClusterBeam — fetches + caches cluster summary from the backend.
// Stale-while-revalidate: on re-open of the same cluster we show the cached summary instantly
// while the backend confirms (its own sha1 cache returns in <50ms when warm).
import { useEffect, useRef, useState } from "react";
import { useBackend } from "../lib/backend";
import type {
  ClusterSummaryCardPayload,
  ClusterSummaryResponse,
} from "../lib/services/narrative";

export interface UseClusterSummaryArgs {
  groupId: string | null;
  cards: ClusterSummaryCardPayload[];
  narrativeSlug?: string;
  narrativeTitle?: string;
}

export interface UseClusterSummaryResult {
  summary: ClusterSummaryResponse | null;
  loading: boolean;
  error: string | null;
}

const cache = new Map<string, ClusterSummaryResponse>();

export function useClusterSummary(
  args: UseClusterSummaryArgs,
): UseClusterSummaryResult {
  const backend = useBackend();
  const { groupId, cards, narrativeSlug, narrativeTitle } = args;
  const [summary, setSummary] = useState<ClusterSummaryResponse | null>(
    groupId ? (cache.get(groupId) ?? null) : null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef<string | null>(null);

  useEffect(() => {
    if (!groupId || cards.length === 0) {
      setSummary(null);
      setLoading(false);
      setError(null);
      return;
    }

    const cached = cache.get(groupId);
    if (cached) {
      setSummary(cached);
    }

    if (inFlightRef.current === groupId) return;
    inFlightRef.current = groupId;
    setLoading(!cached);
    setError(null);

    let cancelled = false;
    backend.narrative
      .summarizeCluster({
        groupId,
        narrativeSlug,
        narrativeTitle,
        cards: cards.slice(0, 100),
      })
      .then((response) => {
        if (cancelled) return;
        cache.set(groupId, response);
        setSummary(response);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message ?? "summary failed");
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
        if (inFlightRef.current === groupId) inFlightRef.current = null;
      });

    return () => {
      cancelled = true;
    };
    // `cards` is derived from groupId so groupId is the real dependency key.
  }, [groupId, backend, narrativeSlug, narrativeTitle, cards]);

  return { summary, loading, error };
}
