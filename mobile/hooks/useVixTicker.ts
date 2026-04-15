// [claude-code 2026-04-15] T3: VIX ticker with Zustand store + 30s polling
import { create } from "zustand";
import { useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { getMobileBackend } from "../lib/backend";

interface VixState {
  value: number;
  change: number;
  changePercent: number;
  isStale: boolean;
  lastUpdated: Date | null;
  _set: (v: Partial<Omit<VixState, "_set">>) => void;
}

export const useVixStore = create<VixState>((set) => ({
  value: 0,
  change: 0,
  changePercent: 0,
  isStale: true,
  lastUpdated: null,
  _set: (v) => set(v),
}));

export function useVixTicker() {
  const { getAccessToken } = useAuth();
  const _set = useVixStore((s) => s._set);

  useEffect(() => {
    const backend = getMobileBackend(getAccessToken);
    let mounted = true;

    const poll = async () => {
      try {
        const data = await backend.marketData.getVix();
        if (!mounted) return;
        _set({
          value: data.value,
          change: data.change,
          changePercent: data.changePercent,
          isStale: false,
          lastUpdated: new Date(),
        });
      } catch {
        if (mounted) _set({ isStale: true });
      }
    };

    poll();
    const id = setInterval(poll, 30_000);

    // Mark stale after 90s without update
    const staleCheck = setInterval(() => {
      const { lastUpdated } = useVixStore.getState();
      if (lastUpdated && Date.now() - lastUpdated.getTime() > 90_000) {
        _set({ isStale: true });
      }
    }, 10_000);

    return () => {
      mounted = false;
      clearInterval(id);
      clearInterval(staleCheck);
    };
  }, [getAccessToken, _set]);

  return useVixStore();
}
