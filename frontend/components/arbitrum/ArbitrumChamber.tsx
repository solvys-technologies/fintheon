// [claude-code 2026-04-29] S52-T3: added question/category display in chamber header;
//   extracted SeatCard/EmptySeat → ChamberSeats.tsx to stay under 300-line limit.
// [claude-code 2026-04-29] S51: removed unused compositeIV/regimeShiftProbability/confidence
//   props — stale API from retired AgentDeskDebatePanel. Both Sanctum surfaces consume
//   useArbitrumLatest (single source of truth). Frosted-glass empty/loading/error states.
// [claude-code 2026-04-25] Seat probability + confidence numerals now use DigitGroup
//   (solvys-transitions number pop-in) so each seat's percentages cascade in.
// [claude-code 2026-04-24] S35-T3: Arbitrum chamber — 5 seats + round indicator + digest footer.
// Replaces AgentDeskDebatePanel inside Sanctum. /solvys-feels: flat surfaces,
// single Solvys Gold accent, no gradients/glass/emojis/shimmer-for-show.
import { useEffect, useMemo, useState } from "react";
import { useArbitrumLatest } from "../../hooks/useArbitrumLatest";
import { NothingFuse } from "../shared/NothingFuse";
import { SolvysLoader } from "../shared/SolvysLoader";
import { VerdictCard } from "./VerdictCard";
import { SeatCard, EmptySeat } from "./ChamberSeats";
import type { ArbitrumSeat, ArbitrumVerdict } from "./types";

interface ArbitrumChamberProps {
  /** Unused here (kept for API parity with the retired AgentDeskDebatePanel). */
  simulationId?: string | null;
  /** Fires when a verdict with phase === "complete" first appears. */
  onSynthesisComplete?: () => void;
}

const DEFAULT_ROLES: ReadonlyArray<ArbitrumSeat["role"]> = [
  "Lead",
  "Forecaster",
  "Future PM",
  "Quant",
  "Skeptic",
];

const EMPTY_COPY =
  "No fresh read — chamber convenes at 17:00 ET or on IV ≥ 8.5.";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
  );
}

function useStaggeredReveal(count: number, stepMs = 200): boolean[] {
  const [revealed, setRevealed] = useState<boolean[]>(() =>
    Array<boolean>(count).fill(prefersReducedMotion()),
  );

  useEffect(() => {
    if (count <= 0) {
      setRevealed([]);
      return;
    }
    const reduced = prefersReducedMotion();
    setRevealed(Array<boolean>(count).fill(reduced));
    if (reduced) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i < count; i++) {
      timers.push(
        setTimeout(() => {
          setRevealed((prev) => {
            if (prev[i]) return prev;
            const next = prev.slice();
            next[i] = true;
            return next;
          });
        }, i * stepMs),
      );
    }
    return () => timers.forEach(clearTimeout);
  }, [count, stepMs]);

  return revealed;
}

export function ArbitrumChamber(props: ArbitrumChamberProps) {
  const { onSynthesisComplete } = props;
  const { verdict, isLoading, error, refresh } = useArbitrumLatest();

  const seats = useMemo<ArbitrumSeat[]>(() => {
    const supplied = verdict?.seats ?? [];
    if (supplied.length >= 5) return supplied.slice(0, 5);
    const bySlot = new Map(supplied.map((s) => [s.role, s] as const));
    return DEFAULT_ROLES.map(
      (role): ArbitrumSeat =>
        bySlot.get(role) ?? {
          role,
          model: "—",
          probability: 0,
          confidence: 0,
          rationale: "",
        },
    );
  }, [verdict]);

  const revealed = useStaggeredReveal(seats.length);

  const roundsTotal = verdict?.rounds_total ?? 3;
  const roundsComplete =
    verdict?.rounds_complete ?? (verdict ? roundsTotal : 0);
  const roundsValue = roundsTotal > 0 ? roundsComplete / roundsTotal : 0;
  const phase = verdict?.phase ?? (verdict ? "complete" : "convening");

  // Fire onSynthesisComplete once per verdict id when phase === "complete".
  const [firedFor, setFiredFor] = useState<string | null>(null);
  useEffect(() => {
    if (!verdict || phase !== "complete") return;
    if (firedFor === verdict.id) return;
    setFiredFor(verdict.id);
    onSynthesisComplete?.();
  }, [verdict, phase, firedFor, onSynthesisComplete]);

  const hasVerdict = Boolean(verdict);
  const hasRealSeats = (verdict?.seats?.length ?? 0) > 0;

  return (
    <div className="flex flex-col min-h-0 min-w-0 gap-3">
      {/* Round indicator + question metadata */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-[var(--fintheon-text)]/60">
              Arbitrum Chamber
            </span>
            <span className="text-[10px] uppercase tracking-wider text-[var(--fintheon-text)]/35">
              ·
            </span>
            <span className="text-[10px] uppercase tracking-wider text-[var(--fintheon-text)]/60">
              Round {roundsComplete} of {roundsTotal}
            </span>
          </div>
          <span className="text-[9px] uppercase tracking-wider text-[var(--fintheon-text)]/35">
            {phase}
          </span>
        </div>
        {verdict?.question && (
          <div className="flex items-center gap-2 text-[10px]">
            <span className="text-[var(--fintheon-text)]/70 line-clamp-1">
              {verdict.question}
            </span>
            {verdict.category && (
              <span className="uppercase tracking-wider text-[var(--fintheon-accent)]/60 shrink-0">
                {verdict.category}
              </span>
            )}
          </div>
        )}
      </div>
      <NothingFuse
        value={roundsValue}
        color="var(--fintheon-accent)"
        thickness={3}
        segments={roundsTotal > 0 ? roundsTotal : 3}
      />

      {/* Seat row — 5 on desktop, 2+2+1 on narrow */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2">
        {seats.map((seat, i) =>
          hasRealSeats ? (
            <SeatCard
              key={`${seat.role}-${i}`}
              seat={seat}
              index={i}
              visible={revealed[i] ?? false}
            />
          ) : (
            <EmptySeat
              key={`${seat.role}-${i}`}
              role={seat.role}
              index={i}
              visible={revealed[i] ?? false}
            />
          ),
        )}
      </div>

      {/* Digest footer / empty state */}
      {hasVerdict ? (
        <VerdictCard verdict={verdict as ArbitrumVerdict} compact />
      ) : (
        <div className="bg-[var(--fintheon-bg)]/60 backdrop-blur-[2px] border border-[var(--fintheon-accent)]/20 p-3 text-xs text-[var(--fintheon-text)]/55">
          {isLoading ? (
            <SolvysLoader text="Loading chamber read" size={12} />
          ) : error ? (
            <div className="flex flex-col gap-1.5">
              <span>Chamber unreachable ({error})</span>
              <button
                onClick={() => void refresh()}
                disabled={isLoading}
                className="self-start px-2 py-0.5 text-[10px] uppercase tracking-wider border border-[var(--fintheon-accent)]/30 text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10 disabled:opacity-40 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : (
            EMPTY_COPY
          )}
        </div>
      )}
    </div>
  );
}

export default ArbitrumChamber;
