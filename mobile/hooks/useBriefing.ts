// [claude-code 2026-04-15] S19: Time-aware briefing hook — fetches most recent brief, supports type selector
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface BriefItem {
  title: string;
  detail: string;
}

interface TodayBrief {
  id: string;
  type: string;
  label: string;
  content: string;
  createdAt: string;
}

interface BriefingState {
  items: BriefItem[];
  briefType?: string;
  isLoading: boolean;
  error: string | null;
  /** All briefs generated today */
  todayBriefs: TodayBrief[];
  /** Fetch a specific brief type */
  fetchByType: (type: string) => void;
  refresh: () => void;
}

export function useBriefing(): BriefingState {
  const { getAccessToken } = useAuth();
  const [items, setItems] = useState<BriefItem[]>([]);
  const [briefType, setBriefType] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [todayBriefs, setTodayBriefs] = useState<TodayBrief[]>([]);

  const fetchBrief = useCallback(
    async (type?: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const token = await getAccessToken();
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const url = type
          ? `${API_BASE}/api/data/brief?type=${type}`
          : `${API_BASE}/api/data/brief`;

        const res = await fetch(url, { headers });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setItems(data.items ?? []);
        setBriefType(data.briefType);
      } catch {
        setError("Failed to load brief");
      } finally {
        setIsLoading(false);
      }
    },
    [getAccessToken],
  );

  const fetchTodayBriefs = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/api/data/briefs/today`, { headers });
      if (!res.ok) return;
      const data = await res.json();
      setTodayBriefs(data.briefs ?? []);
    } catch {
      // Non-critical — silently fail
    }
  }, [getAccessToken]);

  // On mount: fetch most recent brief (no type param = smart default) + today's list
  useEffect(() => {
    fetchBrief();
    fetchTodayBriefs();
  }, [fetchBrief, fetchTodayBriefs]);

  const fetchByType = useCallback(
    (type: string) => fetchBrief(type),
    [fetchBrief],
  );

  return {
    items,
    briefType,
    isLoading,
    error,
    todayBriefs,
    fetchByType,
    refresh: () => {
      fetchBrief();
      fetchTodayBriefs();
    },
  };
}
