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

interface BudgetData {
  usedUsd: number;
  capUsd: number;
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

function formatUsd(value: number): string {
  if (!Number.isFinite(value)) return "$0.00";
  return `$${value.toFixed(value >= 10 ? 0 : 2)}`;
}

function clampRatio(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function TooltipMetric({
  label,
  value,
  ratio,
}: {
  label: string;
  value: string;
  ratio: number;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-4">
        <span className="text-zinc-500">{label}</span>
        <span className="font-mono text-zinc-300">{value}</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full rounded-full bg-[var(--fintheon-accent)] transition-all duration-500"
          style={{ width: `${Math.round(clampRatio(ratio) * 100)}%` }}
        />
      </div>
    </div>
  );
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
  const [budget, setBudget] = useState<BudgetData | null>(null);
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
      try {
        const diagnostics = await fetch(`${API_BASE_URL}/api/diagnostics`);
        if (!diagnostics.ok) return;
        const body = await diagnostics.json();
        const status = body?.budget_status;
        if (!cancelled && status) {
          setBudget({
            usedUsd: Number(status.used_usd ?? 0),
            capUsd: Number(status.cap_usd ?? 0),
          });
        }
      } catch {
        // Diagnostics are optional for the hover budget readout.
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
  const compactionTokens = 120_000;
  const contextRatio = clampRatio(estimatedTokens / compactionTokens);
  const budgetRatio = budget?.capUsd
    ? clampRatio(budget.usedUsd / budget.capUsd)
    : 0;
  const shouldShow =
    contextRatio >= 0.8 || pct >= 70 || budgetRatio >= 0.7 || queuedCount > 3;

  if (!shouldShow) return null;

  const radius = 11;
  const stroke = 2.5;
  const circumference = 2 * Math.PI * radius;
  const filled = (pct / 100) * circumference;
  const gap = circumference - filled;

  // Color: gold when low, amber when mid, red when high
  const ringColor =
    pct >= 90 ? "#EF4444" : pct >= 70 ? "#F59E0B" : "var(--fintheon-accent)";
  const label = formatTokens(estimatedTokens);
  const remainingUsd = budget
    ? Math.max(0, budget.capUsd - budget.usedUsd)
    : null;
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
        <div className="w-64 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-[10px] text-zinc-300 shadow-xl">
          <div className="font-medium text-[var(--fintheon-accent)]">
            Session context
          </div>
          <div className="mt-2 space-y-2">
            <TooltipMetric
              label="Tokens"
              value={`${estimatedTokens.toLocaleString()} / ${compactionTokens.toLocaleString()}`}
              ratio={contextRatio}
            />
            <TooltipMetric
              label="Messages"
              value={`${stats?.messageCount ?? 0}`}
              ratio={(stats?.messageCount ?? 0) / 120}
            />
            <TooltipMetric
              label="Connectors"
              value={`${stats?.connectorCount ?? 0}`}
              ratio={(stats?.connectorCount ?? 0) / 12}
            />
            <TooltipMetric
              label="Queue"
              value={`${queuedCount} queued`}
              ratio={queuedCount / 8}
            />
            <TooltipMetric
              label="Daily"
              value={data ? `${data.requestCount}/${data.dailyCap}` : "offline"}
              ratio={pct / 100}
            />
            {budget ? (
              <TooltipMetric
                label="Balance"
                value={`${formatUsd(remainingUsd ?? 0)} left`}
                ratio={
                  remainingUsd == null || budget.capUsd <= 0
                    ? 0
                    : remainingUsd / budget.capUsd
                }
              />
            ) : null}
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 border-t border-zinc-800 pt-1.5 text-zinc-500">
            <span>Cost</span>
            <span className="font-mono text-zinc-300">
              {budget
                ? `${formatUsd(budget.usedUsd)} / ${formatUsd(budget.capUsd)}`
                : "unavailable"}
            </span>
          </div>
          <div className="mt-1 text-zinc-600">
            {dailyUsage} · {stats?.activeSkillLabel ?? "no skill"}
          </div>
        </div>
      </div>
    </div>
  );
}
