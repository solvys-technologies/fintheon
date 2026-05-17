// [claude-code 2026-05-16] S67: added 60s polling for timeline auto-refresh.
import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";

const API_BASE = import.meta.env.VITE_API_URL || "";
const POLL_MS = 60_000;

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
  createdAt?: string;
}

export function useCatalysts() {
  const { getAccessToken } = useAuth();
  const [catalysts, setCatalysts] = useState<Catalyst[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchCatalysts = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/api/narrative/catalysts?days=7`, {
        headers,
      });
      if (!mountedRef.current) return;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      if (!mountedRef.current) return;
      setCatalysts(data.catalysts ?? []);
      setError(null);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    mountedRef.current = true;
    void fetchCatalysts();
    const id = setInterval(() => void fetchCatalysts(), POLL_MS);
    return () => {
      mountedRef.current = false;
      clearInterval(id);
    };
  }, [fetchCatalysts]);

  return { catalysts, isLoading, error, refresh: fetchCatalysts };
}
