// [Codex 2026-05-27] Extracted confidence fuses from ArbitrumChamber.
import { NothingFuse } from "../shared/NothingFuse";

interface ArbitrumConfidencePairProps {
  caoConfidence: number;
  chamberConfidence: number;
}

export function ArbitrumConfidencePair({
  caoConfidence,
  chamberConfidence,
}: ArbitrumConfidencePairProps) {
  const rows = [
    { label: "CAO confidence", value: caoConfidence },
    { label: "Chamber confidence", value: chamberConfidence },
  ];

  return (
    <div className="grid grid-cols-1 gap-2 px-1 sm:grid-cols-2">
      {rows.map((row) => {
        const value = Math.max(0, Math.min(1, row.value));
        return (
          <div key={row.label} className="min-w-0">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-[9px] uppercase tracking-wider text-[var(--fintheon-text)]/45">
                {row.label}
              </span>
              <span className="font-mono text-[10px] tabular-nums text-[var(--fintheon-text)]/65">
                {(value * 100).toFixed(0)}%
              </span>
            </div>
            <NothingFuse
              value={value}
              color="var(--fintheon-accent)"
              thickness={3}
              segments={10}
              animateIn
            />
          </div>
        );
      })}
    </div>
  );
}
