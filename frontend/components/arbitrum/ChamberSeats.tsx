// [claude-code 2026-04-29] S52-T3: extracted from ArbitrumChamber to keep file under 300-line
//   limit. SeatCard + EmptySeat + shared helpers (seatLetter, ROLE_DISPLAY_NAMES).
// [claude-code 2026-05-03] S57: compact seat tiles; rationale copy removed from chamber row.
// [claude-code 2026-05-03] Agent tiles can open floating full-summary popups.
// [claude-code 2026-05-03] Solvys cleanup: side-mounted vertical score fuses.
import { NothingFuse } from "../shared/NothingFuse";
import { DigitGroup } from "../shared/DigitGroup";
import type { ArbitrumSeat } from "./types";

export const ROLE_DISPLAY_NAMES: Record<ArbitrumSeat["role"], string> = {
  Lead: "Harper",
  Forecaster: "Oracle",
  "Future PM": "Feucht",
  Quant: "Consul",
  Skeptic: "Herald",
};

export function seatLetter(role: string): string {
  const display = ROLE_DISPLAY_NAMES[role as ArbitrumSeat["role"]] ?? role;
  return display.charAt(0).toUpperCase();
}

export function SeatCard({
  seat,
  index,
  visible,
  isSummaryOpen,
  onOpenSummary,
}: {
  seat: ArbitrumSeat;
  index: number;
  visible: boolean;
  isSummaryOpen?: boolean;
  onOpenSummary?: () => void;
}) {
  const score = Math.max(0, Math.min(10, seat.probability * 10));
  const dissented = Boolean(seat.dissented);
  const canOpenSummary = Boolean(seat.rationale.trim() && onOpenSummary);

  return (
    <button
      type="button"
      disabled={!canOpenSummary}
      onClick={onOpenSummary}
      className={`bg-transparent px-2 py-2 flex min-w-0 text-left transition-colors ${
        canOpenSummary
          ? "cursor-pointer hover:bg-[var(--fintheon-accent)]/6"
          : "cursor-default"
      } ${isSummaryOpen ? "bg-[var(--fintheon-accent)]/8" : ""}`}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(4px)",
        transition: `opacity 260ms ease-out ${index * 200}ms, transform 260ms ease-out ${index * 200}ms`,
      }}
      title={canOpenSummary ? "Read full seat summary" : undefined}
    >
      <div className="h-[72px] shrink-0 pr-2">
        <NothingFuse
          value={score / 10}
          score={score}
          color="var(--fintheon-accent)"
          orientation="vertical"
          thickness={5}
          segments={10}
          animateIn
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex h-4 w-4 items-center justify-center text-[9px] text-[var(--fintheon-accent)]"
            aria-hidden
          >
            {seatLetter(seat.role)}
          </span>
          <span
            className={`text-[11px] uppercase tracking-wider ${dissented ? "text-[var(--fintheon-accent)]" : "text-[var(--fintheon-text)]/80"}`}
          >
            {ROLE_DISPLAY_NAMES[seat.role] ?? seat.role}
          </span>
        </div>

        <div className="mt-2 flex items-baseline gap-2">
          <DigitGroup
            value={score.toFixed(1)}
            className="text-[var(--fintheon-accent)] leading-none"
            style={{
              fontFamily: "Doto, ui-monospace, monospace",
              fontSize: 22,
            }}
          />
          <span className="text-[10px] uppercase tracking-wider text-[var(--fintheon-text)]/50">
            score
          </span>
        </div>

        <div className="mt-2">
          <NothingFuse
            value={seat.confidence}
            color="var(--fintheon-accent)"
            thickness={2}
            segments={10}
          />
        </div>
      </div>
    </button>
  );
}

export function EmptySeat({
  role,
  index,
  visible,
}: {
  role: ArbitrumSeat["role"];
  index: number;
  visible: boolean;
}) {
  return (
    <div
      className="bg-transparent px-2 py-2 flex flex-col min-w-0"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(4px)",
        transition: `opacity 260ms ease-out ${index * 200}ms, transform 260ms ease-out ${index * 200}ms`,
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="inline-flex items-center justify-center w-4 h-4 text-[9px] text-[var(--fintheon-accent)]/60"
          aria-hidden
        >
          {seatLetter(role)}
        </span>
        <span className="text-[11px] uppercase tracking-wider text-[var(--fintheon-text)]/45">
          {ROLE_DISPLAY_NAMES[role] ?? role}
        </span>
      </div>
      <p className="mt-2 text-[10px] text-[var(--fintheon-text)]/30">
        Awaiting seat…
      </p>
    </div>
  );
}
