// [claude-code 2026-05-18] Risk signal session drift presentation helpers.
import { useEffect, useState } from "react";
import type { RiskSignal } from "./risk-signal-card-utils";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

export interface RiskSignalDrift {
  label: string;
  loading: boolean;
}

export function useRiskSignalDrift(signals: RiskSignal[]) {
  const [driftData, setDriftData] = useState<Record<string, RiskSignalDrift>>(
    {},
  );

  useEffect(() => {
    const missing = signals.filter((signal) => !driftData[signal.id]);
    if (missing.length === 0) return;

    setDriftData((prev) => {
      const next = { ...prev };
      for (const signal of missing) next[signal.id] = { label: "", loading: true };
      return next;
    });

    for (const signal of missing) {
      fetch(`${API_BASE}/api/riskflow/risk-signals/estimated-drift?signalId=${signal.id}`)
        .then((res) => res.json())
        .then((data) => {
          setDriftData((prev) => ({
            ...prev,
            [signal.id]: {
              label: String(data.label ?? data.drift ?? "1 session"),
              loading: false,
            },
          }));
        })
        .catch(() => {
          setDriftData((prev) => ({
            ...prev,
            [signal.id]: { label: "1 session", loading: false },
          }));
        });
    }
  }, [signals, driftData]);

  return driftData;
}

export function inferSignalDirection(signal: RiskSignal): "BULLISH" | "BEARISH" {
  const text = `${signal.title} ${signal.summary} ${signal.analysis}`.toLowerCase();
  const bullish = ["bullish", "upside", "rally", "bid", "relief", "de-escalat"];
  const bearish = ["bearish", "downside", "risk-off", "sell", "pressure", "escalat"];
  const bullishHits = bullish.filter((word) => text.includes(word)).length;
  const bearishHits = bearish.filter((word) => text.includes(word)).length;
  if (bullishHits > bearishHits) return "BULLISH";
  return "BEARISH";
}

export function formatDriftLabel(value?: string): string {
  const label = value?.trim() || "1 session";
  return label.replace(/\b\w/g, (letter) => letter.toUpperCase());
}
