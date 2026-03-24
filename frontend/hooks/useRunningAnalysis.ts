// [claude-code 2026-03-24] useRunningAnalysis — polls backend for reactive MiroFish state + rolling window
// [claude-code 2026-03-24] Fix: AbortController cancels in-flight fetches on rollingDays change

import { useState, useEffect, useCallback, useRef } from 'react';
import type { RunningAnalysisSnapshot, RollingWindowData } from '../types/mirofish';

const POLL_INTERVAL = 30_000;
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

interface UseRunningAnalysisOptions {
  enabled?: boolean;
  rollingDays?: 1 | 7 | 14 | 30;
}

interface UseRunningAnalysisReturn {
  runningState: RunningAnalysisSnapshot | null;
  rollingData: RollingWindowData | null;
  isPolling: boolean;
  lastFetchedAt: string | null;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useRunningAnalysis(options: UseRunningAnalysisOptions = {}): UseRunningAnalysisReturn {
  const { enabled = true, rollingDays = 7 } = options;
  const [runningState, setRunningState] = useState<RunningAnalysisSnapshot | null>(null);
  const [rollingData, setRollingData] = useState<RollingWindowData | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    try {
      const [stateRes, rollingRes] = await Promise.allSettled([
        fetch(`${API_BASE}/api/mirofish/running-state`, { signal }).then(r => r.ok ? r.json() : null),
        fetch(`${API_BASE}/api/mirofish/rolling-window?days=${rollingDays}`, { signal }).then(r => r.ok ? r.json() : null),
      ]);

      if (stateRes.status === 'fulfilled' && stateRes.value) {
        setRunningState(stateRes.value);
      }
      if (rollingRes.status === 'fulfilled' && rollingRes.value) {
        setRollingData(rollingRes.value);
      }

      setLastFetchedAt(new Date().toISOString());
      setError(null);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Failed to fetch running analysis');
    }
  }, [rollingDays]);

  useEffect(() => {
    if (!enabled) return;

    const controller = new AbortController();
    setIsPolling(true);
    fetchData(controller.signal);

    const id = setInterval(() => fetchData(controller.signal), POLL_INTERVAL);

    return () => {
      clearInterval(id);
      controller.abort();
      setIsPolling(false);
    };
  }, [enabled, fetchData]);

  const refresh = useCallback(() => fetchData(), [fetchData]);

  return { runningState, rollingData, isPolling, lastFetchedAt, error, refresh };
}
