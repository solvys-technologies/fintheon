// [claude-code 2026-04-16] T7: Data hook for NarrativeFlow catalyst cards
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";

const API_BASE = import.meta.env.VITE_API_URL || "";

export interface Catalyst {
  id: string;
  title: string;
  description: string;
  date: string;
  sentiment: "bullish" | "bearish";
  severity: "high" | "medium" | "low";
  status: string;
  tags: string[];
  category: string;
  narrative: string | null;
  narrativeThreads: string[];
}

export function useCatalysts() {
  const { getAccessToken } = useAuth();
  const [catalysts, setCatalysts] = useState<Catalyst[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCatalysts = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const token = await getAccessToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/api/narrative/catalysts?days=7`, {
        headers,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      setCatalysts(data.catalysts ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
      setCatalysts([]);
    } finally {
      setIsLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    fetchCatalysts();
  }, [fetchCatalysts]);

  return { catalysts, isLoading, error, refresh: fetchCatalysts };
}
