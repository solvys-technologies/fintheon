// [claude-code 2026-04-15] MiroShark latest briefing hook — 120s polling
import { useState, useEffect, useRef, useCallback } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "";
const POLL_INTERVAL = 120_000;
const CACHE_KEY = "fintheon:miroshark-latest";

interface MirosharkBriefing {
  summary: string;
  keyFindings: string[];
  riskAlerts: string[];
  agentConsensus: string;
  harperAnalysis?: string;
  generatedAt: string;
}

interface MirosharkLatest {
  simulationId: string;
  nextSessionScore: number;
  confidence: number;
  regimeShiftProbability: number;
  briefing?: MirosharkBriefing;
  timestamp: string;
}

export function useMirosharkLatest() {
  const [data, setData] = useState<MirosharkLatest | null>(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState(!data);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLatest = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/miroshark/latest`);
      if (!res.ok) return;
      const json = await res.json();
      setData(json);
      setIsLoading(false);
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(json));
      } catch {
        // storage full
      }
    } catch {
      // retry next poll
    }
  }, []);

  useEffect(() => {
    fetchLatest();
    intervalRef.current = setInterval(fetchLatest, POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchLatest]);

  return { data, isLoading };
}
