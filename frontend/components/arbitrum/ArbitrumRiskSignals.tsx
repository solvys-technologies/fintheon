import { AlertTriangle } from "lucide-react";
import { useArbitrumLatest } from "../../hooks/useArbitrumLatest";
import { NothingFuse } from "../shared/NothingFuse";
import { ROLE_DISPLAY_NAMES } from "./ChamberSeats";

function scoreColor(score: number): string {
  if (score >= 7) return "var(--fintheon-bearish)";
  if (score >= 5) return "var(--fintheon-accent)";
  return "var(--fintheon-muted)";
}

export function ArbitrumRiskSignals() {
  const { verdict, isLoading, error } = useArbitrumLatest();
  const seats = [...(verdict?.seats ?? [])].sort(
    (a, b) => b.probability * b.confidence - a.probability * a.confidence,
  );

  if (isLoading) {
    return (
      <div className="py-4 text-[9px] uppercase tracking-[0.18em] text-[var(--fintheon-muted)]/35">
        Loading risk signals...
      </div>
    );
  }

  if (error || seats.length === 0) {
    return (
      <div className="py-4 text-[9px] text-[var(--fintheon-muted)]/40">
        No Arbitrum risk signals available.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 py-1">
      {verdict?.dissent && (
        <div className="border border-[var(--fintheon-bearish)]/35 bg-[var(--fintheon-bearish)]/8 px-3 py-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-3 w-3 text-[var(--fintheon-bearish)]" />
            <span className="text-[9px] uppercase tracking-[0.18em] text-[var(--fintheon-bearish)]">
              Dissent {Math.abs(verdict.dissent.magnitude_pp).toFixed(0)}pp
            </span>
          </div>
          {verdict.dissent.rationale && (
            <p className="mt-1 text-[10px] leading-snug text-[var(--fintheon-text)]/62 line-clamp-2">
              {verdict.dissent.rationale}
            </p>
          )}
        </div>
      )}

      {seats.slice(0, 4).map((seat) => {
        const score = Math.max(0, Math.min(10, seat.probability * 10));
        const color = scoreColor(score);
        return (
          <div
            key={seat.role}
            className="border border-[var(--fintheon-accent)]/18 bg-[var(--fintheon-bg)]/55 px-3 py-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--fintheon-text)]/75">
                {ROLE_DISPLAY_NAMES[seat.role] ?? seat.role}
              </span>
              <span
                className="text-[10px] font-bold tabular-nums"
                style={{
                  color,
                  fontFamily: "Doto, ui-monospace, monospace",
                }}
              >
                {score.toFixed(1)}
              </span>
            </div>
            <div className="mt-1.5">
              <NothingFuse
                value={seat.probability}
                color={color}
                thickness={3}
                segments={10}
              />
            </div>
            <p className="mt-1.5 text-[10px] leading-snug text-[var(--fintheon-muted)]/55 line-clamp-2">
              {seat.rationale || "No rationale published for this seat."}
            </p>
          </div>
        );
      })}
    </div>
  );
}
