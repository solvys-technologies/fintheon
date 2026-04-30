// [claude-code 2026-04-29] S52-T3: extracted from ArbitrumChamber to keep file under 300-line
//   limit. SeatCard + EmptySeat + shared helpers (seatLetter, ROLE_DISPLAY_NAMES).
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
}: {
  seat: ArbitrumSeat;
  index: number;
  visible: boolean;
}) {
  const score = Math.max(0, Math.min(10, seat.probability * 10));
  const dissented = Boolean(seat.dissented);

  return (
    <div
      className={`bg-[var(--fintheon-bg)] border p-3 flex flex-col min-w-0 ${dissented ? "border-[var(--fintheon-accent)]/50" : "border-[var(--fintheon-accent)]/25"}`}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(4px)",
        transition: `opacity 260ms ease-out ${index * 200}ms, transform 260ms ease-out ${index * 200}ms`,
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="inline-flex items-center justify-center w-5 h-5 text-[10px] border border-[var(--fintheon-accent)]/50 text-[var(--fintheon-accent)]"
          aria-hidden
        >
          {seatLetter(seat.role)}
        </span>
        <span className="text-[11px] uppercase tracking-wider text-[var(--fintheon-text)]/80">
          {ROLE_DISPLAY_NAMES[seat.role] ?? seat.role}
        </span>
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <DigitGroup
          value={score.toFixed(1)}
          className="text-[var(--fintheon-accent)] leading-none"
          style={{
            fontFamily: "Doto, ui-monospace, monospace",
            fontSize: 26,
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

      <p className="mt-2 text-[11px] text-[var(--fintheon-text)]/75 line-clamp-2">
        {seat.rationale}
      </p>
    </div>
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
      className="bg-[var(--fintheon-bg)] border border-[var(--fintheon-accent)]/15 p-3 flex flex-col min-w-0"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(4px)",
        transition: `opacity 260ms ease-out ${index * 200}ms, transform 260ms ease-out ${index * 200}ms`,
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="inline-flex items-center justify-center w-5 h-5 text-[10px] border border-[var(--fintheon-accent)]/30 text-[var(--fintheon-accent)]/60"
          aria-hidden
        >
          {seatLetter(role)}
        </span>
        <span className="text-[11px] uppercase tracking-wider text-[var(--fintheon-text)]/45">
          {ROLE_DISPLAY_NAMES[role] ?? role}
        </span>
      </div>
      <p className="mt-3 text-[11px] text-[var(--fintheon-text)]/30">
        Awaiting seat…
      </p>
    </div>
  );
}
