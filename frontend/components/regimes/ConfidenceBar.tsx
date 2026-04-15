// [claude-code 2026-04-15] T2: ConfidenceBar — rounded bar with optional breakdown segments
export function ConfidenceBar({
  value,
  breakdown,
}: {
  value: number;
  breakdown?: { iv: number; prediction: number; cot: number; volume: number };
}) {
  const color =
    value >= 70
      ? "bg-emerald-500"
      : value >= 50
        ? "bg-yellow-500"
        : "bg-red-500";

  const textColor =
    value >= 70
      ? "text-emerald-400"
      : value >= 50
        ? "text-yellow-500"
        : "text-red-400";

  return (
    <div
      className="flex items-center gap-2"
      title={
        breakdown
          ? `IV: ${breakdown.iv}% | Pred: ${breakdown.prediction}% | COT: ${breakdown.cot}% | Vol: ${breakdown.volume}%`
          : undefined
      }
    >
      <div className="flex-1 space-y-0.5">
        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={`h-full ${color} rounded-full transition-all`}
            style={{ width: `${value}%` }}
          />
        </div>
        {breakdown && (
          <div className="h-0.5 rounded-full overflow-hidden flex">
            <div
              className="bg-[var(--fintheon-accent)]"
              style={{ width: `${breakdown.iv}%` }}
            />
            <div
              className="bg-blue-400"
              style={{ width: `${breakdown.prediction}%` }}
            />
            <div
              className="bg-emerald-400"
              style={{ width: `${breakdown.cot}%` }}
            />
            <div
              className="bg-orange-400"
              style={{ width: `${breakdown.volume}%` }}
            />
          </div>
        )}
      </div>
      <span className={`text-[10px] font-semibold ${textColor}`}>{value}%</span>
    </div>
  );
}
