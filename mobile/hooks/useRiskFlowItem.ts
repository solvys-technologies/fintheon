// [claude-code 2026-04-19] S25: single-item RiskFlow FeedItem fetcher for the DetailSheet.
import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";

const API_BASE = import.meta.env.VITE_API_URL || "";

// Subset of FeedItem that the mobile DetailSheet renders — keeps the type surface small.
export interface RiskFlowItem {
  id: string;
  source: string;
  headline: string;
  body?: string | null;
  url?: string | null;
  symbols: string[];
  tags: string[];
  ivScore?: number | null;
  publishedAt: string;
  authorHandle?: string | null;
  sentiment?: "bullish" | "bearish" | "neutral";
  macroLevel?: number | null;
  riskType?: string | null;
  agentNote?: string | null;
  agentNoteGeneratedAt?: string | null;
  video_url?: string | null;
}

export function useRiskFlowItem(itemId: string | null) {
  const { getAccessToken } = useAuth();
  const [item, setItem] = useState<RiskFlowItem | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(itemId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!itemId) {
      setItem(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    let cancelled = false;
    (async () => {
      try {
        const token = await getAccessToken();
        const res = await fetch(
          `${API_BASE}/api/riskflow/items/${encodeURIComponent(itemId)}`,
          {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          },
        );
        if (!res.ok) {
          if (!cancelled) {
            setError(`Item not found (${res.status})`);
            setItem(null);
          }
          return;
        }
        const body = (await res.json()) as { item: RiskFlowItem };
        if (!cancelled) setItem(body.item);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Fetch failed");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [itemId, getAccessToken]);

  return { item, isLoading, error };
}
