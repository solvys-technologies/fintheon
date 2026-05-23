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

interface ContextStats {
  messageCount: number;
  estimatedTokens: number;
  connectorCount: number;
  activeSkillLabel?: string | null;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "now";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatTokens(tokens: number): string {
  if (tokens <= 0) return "CTX";
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`;
  return String(tokens);
}

export function UsageRing({
  stats,
  draftText = "",
  queuedCount = 0,
}: {
  stats?: ContextStats;
  draftText?: string;
  queuedCount?: number;
}) {
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

  if (data && !data.alive && !stats) return null;

  const pct = data?.pct ?? 0;
  const draftTokens = Math.ceil(draftText.length / 4);
  const estimatedTokens = (stats?.estimatedTokens ?? 0) + draftTokens;
  const radius = 11;
  const stroke = 2.5;
  const circumference = 2 * Math.PI * radius;
  const filled = (pct / 100) * circumference;
  const gap = circumference - filled;

  // Color: gold when low, amber when mid, red when high
  const ringColor =
    pct >= 90 ? "#EF4444" : pct >= 70 ? "#F59E0B" : "var(--fintheon-accent)";
  const label = formatTokens(estimatedTokens);
  const dailyUsage = data
    ? `${data.requestCount}/${data.dailyCap} requests · resets in ${formatCountdown(countdown)}`
    : "Daily usage unavailable";

  return (
    <div
      className="relative flex items-center justify-center cursor-default group"
      style={{ width: estimatedTokens > 0 ? "38px" : "30px", height: "30px" }}
      title={`${estimatedTokens} estimated context tokens · ${stats?.messageCount ?? 0} messages · ${stats?.connectorCount ?? 0} connectors · ${queuedCount} queued`}
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
        {data && pct > 0 && (
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
        className="absolute text-[8px] font-medium leading-none tabular-nums"
        style={{ color: ringColor }}
      >
        {label}
      </span>

      {/* Hover tooltip */}
      <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-[10px] text-zinc-300 shadow-xl">
          <div className="font-medium text-[var(--fintheon-accent)]">
            {estimatedTokens} est. context tokens
          </div>
          <div className="text-zinc-500 mt-0.5">
            {stats?.messageCount ?? 0} messages · {stats?.connectorCount ?? 0} connectors
          </div>
          <div className="text-zinc-500 mt-0.5">
            {queuedCount} queued · {stats?.activeSkillLabel ?? "no skill"}
          </div>
          <div className="text-zinc-600 mt-0.5">
            {dailyUsage}
          </div>
        </div>
      </div>
    </div>
  );
}
