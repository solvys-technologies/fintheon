// [claude-code 2026-04-25] S42-T8: Numeric cells (signals, trades, P&L, clock) render
//   in Doto via --font-display for monumental display typography.
// [claude-code 2026-03-11] Track 3: Session status bar — RTH dot, session name, counters, P&L, EST clock
import { useState, useEffect } from "react";
import type { AutopilotStatus } from "./AutopilotDashboard";

const NUM_FONT: React.CSSProperties = { fontFamily: "var(--font-display)" };

interface SessionStatusBarProps {
  status: AutopilotStatus | null;
}

function useEstClock(): string {
  const [time, setTime] = useState(() => formatEST());

  useEffect(() => {
    const id = setInterval(() => setTime(formatEST()), 1000);
    return () => clearInterval(id);
  }, []);

  return time;
}

function formatEST(): string {
  try {
    return new Date().toLocaleTimeString("en-US", {
      timeZone: "America/New_York",
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "--:--:--";
  }
}

function formatCurrency(value: number): string {
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  });
  return value < 0 ? `-${formatted}` : formatted;
}

export function SessionStatusBar({ status }: SessionStatusBarProps) {
  const estTime = useEstClock();
  const isRTH = status?.isRTH ?? false;
  const activeSession = status?.activeSession ?? null;
  const signalsToday = status?.signalsToday ?? 0;
  const tradesToday = status?.tradesToday ?? 0;
  const maxTrades = status?.maxTradesPerDay ?? 0;
  const dailyPnL = status?.dailyPnL ?? 0;

  const sessionLabel = activeSession || (isRTH ? "All RTH" : "Market Closed");
  const pnlCssColor =
    dailyPnL > 0
      ? "var(--fintheon-bullish)"
      : dailyPnL < 0
        ? "var(--fintheon-bearish)"
        : undefined;

  return (
    <div className="bg-[#0a0906] border-b border-[#c79f4a20] px-4 py-2 flex items-center justify-between gap-4 font-mono text-xs">
      {/* RTH Status */}
      <div className="flex items-center gap-1.5">
        <span
          className={`inline-block w-2 h-2 rounded-full ${isRTH ? "bg-green-400" : "bg-red-400"}`}
        />
        <span className="text-[#f0ead6]">RTH</span>
      </div>

      {/* Session Window */}
      <div className="flex items-center gap-1.5">
        <span className="text-[#f0ead680]">Session:</span>
        <span className="text-[#c79f4a] font-medium">{sessionLabel}</span>
      </div>

      {/* Signals Today */}
      <div className="flex items-center gap-1.5">
        <span className="text-[#f0ead680]">Signals:</span>
        <span className="text-[#f0ead6]" style={NUM_FONT}>
          {signalsToday}
        </span>
      </div>

      {/* Trades Today */}
      <div className="flex items-center gap-1.5">
        <span className="text-[#f0ead680]">Trades:</span>
        <span className="text-[#f0ead6]" style={NUM_FONT}>
          {tradesToday}/{maxTrades}
        </span>
      </div>

      {/* Daily P&L */}
      <div className="flex items-center gap-1.5">
        <span className="text-[#f0ead680]">P&L:</span>
        <span
          className="font-bold"
          style={{
            color: pnlCssColor ?? "#f0ead680",
            fontFamily: "var(--font-display)",
          }}
        >
          {formatCurrency(dailyPnL)}
        </span>
      </div>

      {/* EST Clock */}
      <div className="flex items-center gap-1.5">
        <span className="text-[#f0ead680]">EST</span>
        <span className="text-[#f0ead6]" style={NUM_FONT}>
          {estTime}
        </span>
      </div>
    </div>
  );
}
