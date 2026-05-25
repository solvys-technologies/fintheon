// [claude-code 2026-04-18] Drop YM from the mobile cards per TP — desktop keeps the full
//   five-instrument grid; mobile drops the Dow row to keep cards above the fold.
// [claude-code 2026-04-15] Instrument outlook hook — 120s polling, 5 instruments from ArbitrumChamber
import { useState, useEffect, useRef, useCallback } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "";
const POLL_INTERVAL = 120_000;
const MOBILE_INSTRUMENT_BLOCKLIST = new Set(["YM", "/YM"]);

export interface InstrumentOutlook {
  symbol: string;
  name: string;
  ivScore: number;
  lean: "bullish" | "bearish" | "neutral";
  range: [number, number];
  conviction: "low" | "moderate" | "elevated";
  drivers: string[];
  scoredItemCount: number;
}

interface OutlookResponse {
  instruments: InstrumentOutlook[];
  fetchedAt: string;
  source: string;
  ageMinutes: number;
}

export function useInstrumentOutlook() {
  const [instruments, setInstruments] = useState<InstrumentOutlook[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchOutlook = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/predictions/outlook`);
      if (!res.ok) return;
      const json: OutlookResponse = await res.json();
      const filtered = (json.instruments || []).filter(
        (i) => !MOBILE_INSTRUMENT_BLOCKLIST.has(i.symbol),
      );
      setInstruments(filtered);
      setIsLoading(false);
    } catch {
      // retry next poll
    }
  }, []);

  useEffect(() => {
    fetchOutlook();
    intervalRef.current = setInterval(fetchOutlook, POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchOutlook]);

  return { instruments, isLoading };
}
