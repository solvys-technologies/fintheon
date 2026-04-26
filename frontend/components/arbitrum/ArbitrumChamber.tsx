// [claude-code 2026-04-25] Seat probability + confidence numerals now use DigitGroup
//   (solvys-transitions number pop-in) so each seat's percentages cascade in.
// [claude-code 2026-04-24] S35-T3: Arbitrum chamber — 5 seats + round indicator + digest footer.
// Replaces AgentDeskDebatePanel inside Sanctum. /solvys-feels: flat surfaces,
// single Solvys Gold accent, no gradients/glass/emojis/shimmer-for-show.
import { useEffect, useMemo, useState } from "react";
import { useArbitrumLatest } from "../../hooks/useArbitrumLatest";
import { NothingFuse } from "../shared/NothingFuse";
import { DigitGroup } from "../shared/DigitGroup";
import { VerdictCard } from "./VerdictCard";
import { AskAboutThis } from "../chat/AskAboutThis";
import type { ArbitrumSeat, ArbitrumVerdict } from "./types";

interface ArbitrumChamberProps {
  /** Unused here (kept for API parity with the retired AgentDeskDebatePanel). */
  simulationId?: string | null;
  /** Fires when a verdict with phase === "complete" first appears. */
  onSynthesisComplete?: () => void;
  compositeIV?: number;
  regimeShiftProbability?: number;
  confidence?: number;
}

const DEFAULT_ROLES: ReadonlyArray<ArbitrumSeat["role"]> = [
  "Lead",
  "Forecaster",
  "Risk",
  "Quant",
  "Bear",
];

const EMPTY_COPY =
  "No fresh read — chamber convenes at 17:00 ET or on IV ≥ 8.5.";

function seatLetter(role: string): string {
  return role.charAt(0).toUpperCase();
}

function SeatCard({
  seat,
  index,
  visible,
}: {
  seat: ArbitrumSeat;
  index: number;
  visible: boolean;
}) {
  // [claude-code 2026-04-26] Per TP: seat cards are view-only; drop the
  // numeric % / conf% display and the model name (model lives in settings
  // only). Surface the seat role + rationale + a confidence fuse for
  // quick read; dissent stays as a left-border accent.
  const dissented = Boolean(seat.dissented);
  const borderLeft = dissented
    ? "border-l-2 border-l-[var(--fintheon-accent)]/70"
    : "border-l border-l-[var(--fintheon-accent)]/10";

  return (
    <div
      className={`bg-[var(--fintheon-bg)] border border-[var(--fintheon-accent)]/25 ${borderLeft} p-3 flex flex-col min-w-0`}
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
          {seat.role}
        </span>
      </div>

      <div className="mt-3">
        <NothingFuse
          value={seat.confidence}
          color="var(--fintheon-accent)"
          thickness={2}
          segments={10}
        />
      </div>

      <p className="mt-2 text-[11px] text-[var(--fintheon-text)]/75 line-clamp-3">
        {seat.rationale}
      </p>
    </div>
  );
}

function EmptySeat({
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
          {role}
        </span>
      </div>
      <p className="mt-3 text-[11px] text-[var(--fintheon-text)]/30">
        Awaiting seat…
      </p>
    </div>
  );
}

function useStaggeredReveal(count: number, stepMs = 200): boolean[] {
  const [revealed, setRevealed] = useState<boolean[]>(() =>
    Array<boolean>(count).fill(false),
  );

  useEffect(() => {
    if (count <= 0) {
      setRevealed([]);
      return;
    }
    setRevealed(Array<boolean>(count).fill(false));
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
  const { verdict, isLoading, error } = useArbitrumLatest();

  // [claude-code 2026-04-26] Backend ships ArbitrumSeatTranscript ({rounds: [...]})
  // which the flat ArbitrumSeat shape can't read directly — Math.round(undefined * 100)
  // = NaN, which is what TP saw rendered for every seat. Adapter pulls the LATEST
  // round's probability/confidence/rationale into the flat shape the card expects.
  const seats = useMemo<ArbitrumSeat[]>(() => {
    const supplied = verdict?.seats ?? [];
    const flatten = (s: any): ArbitrumSeat => {
      const lastRound =
        Array.isArray(s?.rounds) && s.rounds.length > 0
          ? s.rounds[s.rounds.length - 1]
          : null;
      const probability = Number.isFinite(s?.probability)
        ? s.probability
        : Number.isFinite(lastRound?.probability)
          ? lastRound.probability
          : 0;
      const confidence = Number.isFinite(s?.confidence)
        ? s.confidence
        : Number.isFinite(lastRound?.confidence)
          ? lastRound.confidence
          : 0;
      const rationale =
        typeof s?.rationale === "string" && s.rationale
          ? s.rationale
          : typeof lastRound?.rationale === "string"
            ? lastRound.rationale
            : "";
      return {
        role: s?.role ?? "Lead",
        model: s?.model ?? "—",
        probability,
        confidence,
        rationale,
        dissented: Boolean(s?.dissented),
      };
    };

    if (supplied.length >= 5) return supplied.slice(0, 5).map(flatten);
    const flat = supplied.map(flatten);
    const bySlot = new Map(flat.map((s) => [s.role, s] as const));
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
    <div className="group flex flex-col min-h-0 min-w-0 gap-3">
      {/* Round indicator */}
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
        <div className="flex items-center gap-2">
          <span className="text-[9px] uppercase tracking-wider text-[var(--fintheon-text)]/35">
            {phase}
          </span>
          {hasVerdict && verdict && (
            <AskAboutThis
              surface="arbitrum_verdict"
              label="this verdict"
              payload={{
                verdict_id: verdict.id,
                phase,
                rounds_complete: roundsComplete,
                rounds_total: roundsTotal,
                consensus_probability: verdict.consensus_probability,
                confidence: verdict.confidence,
              }}
            />
          )}
        </div>
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
        <div className="bg-[var(--fintheon-bg)] border border-[var(--fintheon-accent)]/20 p-3 text-xs text-[var(--fintheon-text)]/55">
          {isLoading
            ? "Loading chamber read…"
            : error
              ? `Chamber unreachable (${error})`
              : EMPTY_COPY}
        </div>
      )}
    </div>
  );
}

export default ArbitrumChamber;
