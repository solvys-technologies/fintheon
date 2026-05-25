// [claude-code 2026-05-01] S56 Track A: fetch + update seat overrides
import { useCallback, useState } from "react";
import type { SeatOverride } from "../components/arbitrum/types";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

interface SeatOverridesState {
  overrides: SeatOverride[];
  isLoading: boolean;
  error: string | null;
  load: () => Promise<void>;
  save: (
    overrides: Array<{
      seat_id: string;
      override_prompt?: string;
      context_sources?: string[];
      category_filter?: string;
    }>,
  ) => Promise<boolean>;
  reset: (seatIds: string[]) => Promise<boolean>;
}

export function useArbitrumSeatOverrides(): SeatOverridesState {
  const [overrides, setOverrides] = useState<SeatOverride[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getToken = useCallback(async (): Promise<string | null> => {
    try {
      if (typeof window !== "undefined" && (window as any).supabase?.auth) {
        const { data } = await (window as any).supabase.auth.getSession();
        return data?.session?.access_token ?? null;
      }
    } catch {
      /* fall through */
    }
    try {
      const stored = localStorage.getItem("sb-fintheon-auth-token");
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed?.access_token ?? null;
      }
    } catch {
      /* fall through */
    }
    return null;
  }, []);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/arbitrum/seats/overrides`);
      if (!res.ok) {
        setError(`HTTP ${res.status}`);
        return;
      }
      const data = (await res.json()) as { overrides: SeatOverride[] };
      setOverrides(data.overrides ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "fetch failed");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const save = useCallback(
    async (
      patches: Array<{
        seat_id: string;
        override_prompt?: string;
        context_sources?: string[];
        category_filter?: string;
      }>,
    ): Promise<boolean> => {
      const token = await getToken();
      if (!token) {
        setError("Not authenticated");
        return false;
      }
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/api/arbitrum/seats/overrides`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ overrides: patches }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          setError((body as { error?: string })?.error ?? `HTTP ${res.status}`);
          return false;
        }
        await load();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "save failed");
        return false;
      }
    },
    [getToken, load],
  );

  const reset = useCallback(
    async (seatIds: string[]): Promise<boolean> => {
      return save(
        seatIds.map((sid) => ({
          seat_id: sid,
          override_prompt: "",
          context_sources: [],
          category_filter: "all",
        })),
      );
    },
    [save],
  );

  return { overrides, isLoading, error, load, save, reset };
}
