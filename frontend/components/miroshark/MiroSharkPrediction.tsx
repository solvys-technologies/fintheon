// [claude-code 2026-03-16] Individual MiroShark prediction card with animated border
interface MiroSharkPredictionProps {
  label: string;
  probability: number;
  projectedScore: number;
  isTop?: boolean;
}

export function MiroSharkPrediction({
  label,
  probability,
  projectedScore,
  isTop = false,
}: MiroSharkPredictionProps) {
  const scoreColor =
    projectedScore >= 7
      ? "#EF4444"
      : projectedScore >= 5
        ? "#F59E0B"
        : "#34D399";

  return (
    <div
      className="relative rounded-lg p-3 border transition-all duration-300"
      style={{
        backgroundColor: "rgba(10, 10, 0, 0.7)",
        borderColor: isTop
          ? "rgba(212, 175, 55, 0.4)"
          : "rgba(255, 255, 255, 0.06)",
        animation: isTop
          ? "miroshark-pulse 2s ease-in-out infinite"
          : undefined,
      }}
    >
      {/* AI badge */}
      <div className="absolute top-2 right-2 flex items-center gap-1">
        <span
          className="text-[8px] font-bold px-1.5 py-0.5 rounded-full"
          style={{
            backgroundColor: "rgba(212, 175, 55, 0.15)",
            color: "var(--fintheon-accent)",
          }}
        >
          AI
        </span>
      </div>

      <h4 className="text-[11px] font-medium text-gray-200 pr-8 mb-2">
        {label}
      </h4>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500">Prob</span>
          <span className="text-xs font-bold text-[var(--fintheon-text)]">
            {(probability * 100).toFixed(0)}%
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500">IV</span>
          <span className="text-xs font-bold" style={{ color: scoreColor }}>
            {projectedScore.toFixed(1)}
          </span>
        </div>
      </div>

      {/* Probability bar */}
      <div className="mt-2 h-1 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${probability * 100}%`,
            backgroundColor: "var(--fintheon-accent)",
            opacity: 0.6,
          }}
        />
      </div>
    </div>
  );
}
