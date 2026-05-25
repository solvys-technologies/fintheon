// [claude-code 2026-05-01] S56 Track A: fetch /api/arbitrum/health on demand
import { useCallback, useState } from "react";
import type { ArbitrumHealth } from "../components/arbitrum/types";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

interface ArbitrumHealthState {
  health: ArbitrumHealth | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useArbitrumHealth(): ArbitrumHealthState {
  const [health, setHealth] = useState<ArbitrumHealth | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/arbitrum/health`);
      if (!res.ok) {
        setError(`HTTP ${res.status}`);
        return;
      }
      const data = (await res.json()) as ArbitrumHealth;
      setHealth(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "fetch failed");
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { health, isLoading, error, refresh };
}
