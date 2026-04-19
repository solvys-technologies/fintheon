// [claude-code 2026-04-15] S16-T4: Blended VIX Score card — visible on Aquarium Page 0
import type { IVScoreResponse } from "../../types/market-data";

interface BlendedVIXCardProps {
  data: IVScoreResponse | null;
  isLoading: boolean;
}

function getScoreColor(score: number): string {
  if (score >= 8) return "text-red-500";
  if (score >= 6) return "text-orange-400";
  if (score >= 4) return "text-yellow-400";
  return "text-emerald-400";
}

function getEnvironmentLabel(score: number): string {
  if (score >= 8) return "Shit Show";
  if (score >= 6) return "Tipping Point";
  if (score >= 4) return "Gathering Storm";
  if (score >= 2) return "Light Winds";
  return "Calm Seas";
}

function getBarColor(value: number): string {
  if (value > 7) return "bg-red-500";
  if (value > 5) return "bg-orange-400";
  if (value > 3) return "bg-yellow-400";
  return "bg-emerald-400";
}

export function BlendedVIXCard({ data, isLoading }: BlendedVIXCardProps) {
  if (isLoading || !data) {
    return (
      <div className="bg-[var(--fintheon-surface)] border border-[var(--fintheon-border)]/20 rounded-lg p-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500">Blended IV Score</span>
          <span className="text-sm font-bold text-gray-600">--</span>
        </div>
      </div>
    );
  }

  const envLabel = getEnvironmentLabel(data.score);
  const scoreColor = getScoreColor(data.score);
  const pts = data.points;

  const components = [
    {
      label: "VIX",
      value: data.vixComponent,
      weight: "70%",
      detail: `(${data.vix.level.toFixed(1)})`,
    },
    {
      label: "Headlines",
      value: data.headlineComponent,
      weight: "20%",
      detail: `(${data.eventCount} events)`,
    },
    {
      label: "MiroShark",
      value: data.mirosharkComponent,
      weight: "10%",
      detail: null,
    },
  ];

  return (
    <div className="bg-[var(--fintheon-surface)] border border-[var(--fintheon-border)]/20 rounded-lg p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">
          Blended IV Score
        </span>
        <div className="flex items-center gap-1.5">
          <span
            className={`text-base font-bold ${scoreColor}`}
            style={{
              fontFamily: "Doto, ui-monospace, monospace",
              letterSpacing: "0.02em",
            }}
          >
            {data.score.toFixed(1)}
          </span>
          <span className={`text-[9px] font-medium ${scoreColor}`}>
            {envLabel}
          </span>
        </div>
      </div>

      {/* Component bars */}
      <div className="space-y-1.5 mb-2">
        {components.map((c) => (
          <div key={c.label} className="flex items-center gap-2">
            <span className="text-[9px] text-gray-500 w-[52px] shrink-0">
              {c.label}
            </span>
            <div className="flex-1 h-[4px] bg-zinc-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${getBarColor(c.value)}`}
                style={{ width: `${Math.min(100, (c.value / 10) * 100)}%` }}
              />
            </div>
            <span className="text-[9px] text-gray-300 w-6 text-right shrink-0">
              {c.value.toFixed(1)}
            </span>
            <span className="text-[8px] text-gray-600 w-6 text-right shrink-0">
              {c.weight}
            </span>
            {c.detail && (
              <span className="text-[8px] text-gray-600 shrink-0">
                {c.detail}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Implied range */}
      {pts && (
        <div className="flex items-center gap-2 text-[9px] text-gray-400 mb-1.5 pt-1.5 border-t border-zinc-800">
          <span className="text-[var(--fintheon-accent)] font-medium">
            ±{pts.scaledPoints} pts
          </span>
          <span className="text-gray-600">|</span>
          <span>${pts.scaledDollarRisk}/contract</span>
        </div>
      )}

      {/* Rationale (first 2 lines) */}
      {data.rationale.length > 0 && (
        <div className="space-y-0.5">
          {data.rationale.slice(0, 2).map((line, i) => (
            <p key={i} className="text-[9px] text-gray-500 leading-tight">
              {line}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
