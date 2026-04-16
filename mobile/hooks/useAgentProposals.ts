// [claude-code 2026-04-15] Agent trading proposals hook — fetches from autopilot endpoint
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";

const API_BASE = import.meta.env.VITE_API_URL || "";
const POLL_INTERVAL = 120_000;

export interface TradingProposal {
  id: string;
  strategyName: string;
  instrument: string;
  direction: "long" | "short" | "flat";
  entryPrice?: number;
  stopLoss?: number;
  takeProfit?: number[];
  positionSize: number;
  riskRewardRatio: number;
  confidence: number;
  rationale: string;
  timeframe: string;
  setupType: string;
  createdAt: string;
}

export function useAgentProposals() {
  const { getAccessToken } = useAuth();
  const [proposals, setProposals] = useState<TradingProposal[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProposals = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/api/autopilot/proposals`, {
        headers,
      });
      if (!res.ok) return;
      const json = await res.json();
      setProposals(json.proposals || []);
      setIsLoading(false);
    } catch {
      // retry next poll
    }
  }, [getAccessToken]);

  useEffect(() => {
    fetchProposals();
    const id = setInterval(fetchProposals, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [fetchProposals]);

  return { proposals, isLoading };
}
