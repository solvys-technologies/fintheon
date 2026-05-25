// [claude-code 2026-05-05] S59-T4: removed first-letter initials, added
//   dual-role fine-print descriptors under each agent name.
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

const ROLE_DESCRIPTORS: Record<ArbitrumSeat["role"], string> = {
  Lead: "CAO · Executive Synthesis",
  Forecaster: "Prediction Markets · Probabilistic Models",
  "Future PM": "Futures Execution · Risk Management",
  Quant: "Mega-Cap Fundamentals · Earnings",
  Skeptic: "Social Sentiment · Headline Risk",
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
  const descriptor = ROLE_DESCRIPTORS[seat.role] ?? "";

  return (
    <button
      type="button"
      disabled={!canOpenSummary}
      onClick={onOpenSummary}
      className={`flex w-full min-w-0 bg-transparent px-1.5 py-2 text-left transition-colors ${
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
      <div className="mr-1.5 h-[64px] w-[4px] shrink-0">
        <NothingFuse
          value={score / 10}
          score={score}
          color="var(--fintheon-accent)"
          orientation="vertical"
          thickness={4}
          segments={10}
          animateIn
        />
      </div>
      <div className="min-w-0 flex-1">
        <span
          className={`text-[10px] uppercase tracking-wider leading-tight ${dissented ? "text-[var(--fintheon-accent)]" : "text-[var(--fintheon-text)]/80"}`}
        >
          {ROLE_DISPLAY_NAMES[seat.role] ?? seat.role}
        </span>
        <p className="mt-0.5 line-clamp-2 text-[6.5px] leading-tight text-[var(--fintheon-text)]/35">
          {descriptor}
        </p>

        <div className="mt-2 flex items-baseline gap-1.5">
          <DigitGroup
            value={score.toFixed(1)}
            className="text-[var(--fintheon-accent)] leading-none"
            style={{
              fontFamily: "Doto, ui-monospace, monospace",
              fontSize: 18,
            }}
          />
          <span className="text-[8px] uppercase tracking-wider text-[var(--fintheon-text)]/50">
            score
          </span>
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
  const descriptor = ROLE_DESCRIPTORS[role] ?? "";
  return (
    <div
      className="bg-transparent px-2 py-2 flex flex-col min-w-0"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(4px)",
        transition: `opacity 260ms ease-out ${index * 200}ms, transform 260ms ease-out ${index * 200}ms`,
      }}
    >
      <span className="text-[11px] uppercase tracking-wider text-[var(--fintheon-text)]/45">
        {ROLE_DISPLAY_NAMES[role] ?? role}
      </span>
      <p className="text-[7px] text-[var(--fintheon-text)]/25 leading-tight mt-0.5">
        {descriptor}
      </p>
      <p className="mt-2 text-[10px] text-[var(--fintheon-text)]/30">
        Awaiting seat…
      </p>
    </div>
  );
}
