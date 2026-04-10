// [claude-code 2026-03-30] Daily usage ring — circular indicator with countdown to reset
import { useState, useEffect } from "react";
import { API_BASE_URL } from "./constants";

interface UsageData {
  requestCount: number;
  dailyCap: number;
  pct: number;
  alive: boolean;
  resetsInMs: number;
  refreshHourET: number;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "now";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function UsageRing() {
  const [data, setData] = useState<UsageData | null>(null);
  const [countdown, setCountdown] = useState(0);

  // Fetch usage every 30s
  useEffect(() => {
    let cancelled = false;
    const fetchUsage = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/ai/usage`);
        if (!res.ok) return;
        const d: UsageData = await res.json();
        if (!cancelled) {
          setData(d);
          setCountdown(d.resetsInMs);
        }
      } catch {
        // Backend not available — hide ring
      }
    };
    fetchUsage();
    const interval = setInterval(fetchUsage, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Tick countdown every 60s
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 60_000));
    }, 60_000);
    return () => clearInterval(timer);
  }, [countdown > 0]);

  if (!data || !data.alive) return null;

  const pct = data.pct;
  const radius = 11;
  const stroke = 2.5;
  const circumference = 2 * Math.PI * radius;
  const filled = (pct / 100) * circumference;
  const gap = circumference - filled;

  // Color: gold when low, amber when mid, red when high
  const ringColor =
    pct >= 90 ? "#EF4444" : pct >= 70 ? "#F59E0B" : "var(--fintheon-accent)";

  return (
    <div
      className="relative flex items-center justify-center cursor-default group"
      style={{ width: "30px", height: "30px" }}
      title={`${data.requestCount}/${data.dailyCap} today \u00b7 Resets in ${formatCountdown(countdown)}`}
    >
      {/* SVG ring */}
      <svg
        width="30"
        height="30"
        viewBox="0 0 28 28"
        className="rotate-[-90deg]"
      >
        {/* Background track */}
        <circle
          cx="14"
          cy="14"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-zinc-800"
        />
        {/* Filled arc */}
        {pct > 0 && (
          <circle
            cx="14"
            cy="14"
            r={radius}
            fill="none"
            stroke={ringColor}
            strokeWidth={stroke}
            strokeDasharray={`${filled} ${gap}`}
            strokeLinecap="round"
            className="transition-all duration-700"
          />
        )}
      </svg>
      {/* Center text */}
      <span
        className="absolute text-[8px] font-medium leading-none"
        style={{ color: ringColor }}
      >
        {pct}
      </span>

      {/* Hover tooltip */}
      <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-[10px] text-zinc-300 shadow-xl">
          <div className="font-medium text-[var(--fintheon-accent)]">
            {data.requestCount}/{data.dailyCap} requests
          </div>
          <div className="text-zinc-500 mt-0.5">
            Resets in {formatCountdown(countdown)}
          </div>
        </div>
      </div>
    </div>
  );
}
