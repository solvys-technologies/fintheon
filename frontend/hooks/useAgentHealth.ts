// [claude-code 2026-05-05] S59-T3: useAgentHealth hook — fetches per-agent health data every 60s.
import { useState, useEffect, useCallback, useRef } from "react";

export interface AgentHealthEntry {
  agentId: string;
  role: string;
  soulLoaded: boolean;
  soulVersion: number | null;
  nativeHomeIntact: boolean;
  reflectScore: number | null;
  reflectLastRun: string | null;
  memoryCount: number;
  gepaLastRun: string | null;
  gepaOpenPrs: number;
  personaHealth: "green" | "amber" | "red";
}

export interface AgentHealthResponse {
  timestamp: string;
  agents: AgentHealthEntry[];
}

interface UseAgentHealthState {
  data: AgentHealthEntry[] | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: string | null;
  refresh: () => Promise<void>;
}

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";
const POLL_INTERVAL = 60_000;

export function useAgentHealth(): UseAgentHealthState {
  const [data, setData] = useState<AgentHealthEntry[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/apparatus/agent-health`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: AgentHealthResponse = await res.json();
      if (mountedRef.current) {
        setData(json.agents);
        setLastUpdated(json.timestamp);
        setError(null);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : "fetch failed");
      }
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchData();
    const interval = setInterval(fetchData, POLL_INTERVAL);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [fetchData]);

  return { data, isLoading, error, lastUpdated, refresh: fetchData };
}
