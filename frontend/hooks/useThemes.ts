// [claude-code 2026-05-16] S68-T1: Theme data hook — fetches from /api/themes
import { useState, useEffect, useCallback, useRef } from "react";

export type ThemeStatus = "Active" | "Decaying" | "Resolved";

export interface ThemeTrajectoryPoint {
  timestamp: string;
  ipv: number;
}

export interface Theme {
  id: string;
  name: string;
  ipv: number;
  status: ThemeStatus;
  catalystIds: string[];
  createdAt: string;
  updatedAt: string;
  trajectory: ThemeTrajectoryPoint[];
}

export interface ThemeListResponse {
  themes: Theme[];
  count: number;
}

const API_BASE =
  (import.meta as any).env?.VITE_API_URL || "http://localhost:8080";

export function useThemes() {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchThemes = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/themes`, {
        credentials: "include",
      });
      if (!res.ok) {
        setError(`Failed to fetch themes: ${res.status}`);
        return;
      }
      const data: ThemeListResponse = await res.json();
      setThemes(data.themes);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch themes");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchThemes();
    intervalRef.current = setInterval(fetchThemes, 30_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchThemes]);

  return { themes, isLoading, error, refresh: fetchThemes };
}
