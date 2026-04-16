// [claude-code 2026-04-16] Rewrite: direct fetch() bypassing ApiClient, same pattern as useIVScore
import { create } from "zustand";
import { useEffect } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "";

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
  const _set = useVixStore((s) => s._set);

  useEffect(() => {
    let mounted = true;

    const poll = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/market/vix`);
        if (!res.ok) return;
        const data = await res.json();
        if (!mounted) return;
        _set({
          value: data.level ?? data.value ?? 0,
          change: data.change ?? 0,
          changePercent: data.percentChange ?? data.changePercent ?? 0,
          isStale: false,
          lastUpdated: new Date(),
        });
      } catch {
        if (mounted) _set({ isStale: true });
      }
    };

    poll();
    const id = setInterval(poll, 30_000);

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
  }, [_set]);

  return useVixStore();
}
