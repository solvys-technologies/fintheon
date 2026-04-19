// [claude-code 2026-04-19] S25: single-catalyst fetcher for DetailSheet catalyst view.
import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";

const API_BASE = import.meta.env.VITE_API_URL || "";

export interface CatalystDetail {
  id: string;
  title: string;
  description: string;
  date: string;
  sentiment: "bullish" | "bearish";
  severity: "low" | "medium" | "high";
  sourceUrl?: string | null;
  imageUrl?: string | null;
  ivScore?: number | null;
  narrativeThreads: string[];
  narrative: string | null;
  tags: string[];
  category: string;
  status: string;
  agentNote?: string | null;
  riskflowItemId: string;
}

export function useCatalystById(catalystId: string | null) {
  const { getAccessToken } = useAuth();
  const [catalyst, setCatalyst] = useState<CatalystDetail | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(catalystId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!catalystId) {
      setCatalyst(null);
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
          `${API_BASE}/api/narrative/catalysts/${encodeURIComponent(catalystId)}`,
          {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          },
        );
        if (!res.ok) {
          if (!cancelled) {
            setError(`Catalyst not found (${res.status})`);
            setCatalyst(null);
          }
          return;
        }
        const body = (await res.json()) as { catalyst: CatalystDetail };
        if (!cancelled) setCatalyst(body.catalyst);
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
  }, [catalystId, getAccessToken]);

  return { catalyst, isLoading, error };
}
