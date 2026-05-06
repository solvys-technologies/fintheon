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
// [claude-code 2026-05-01] S56 Track A: gear icon opens ArbitrumSettingsPanel overlay.
// [claude-code 2026-05-03] S57: compact chamber stack with consensus below seats.
// [claude-code 2026-05-03] Arbitrum-only floating full agent summaries, capped at two.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Settings } from "lucide-react";
import { useArbitrumLatest } from "../../hooks/useArbitrumLatest";
import { FadingRuler } from "../shared/FadingRuler";
import { NothingFuse } from "../shared/NothingFuse";
import { SolvysLoader } from "../shared/SolvysLoader";
import { VerdictCard } from "./VerdictCard";
import { SeatCard, EmptySeat } from "./ChamberSeats";
import { ArbitrumSettingsPanel } from "./ArbitrumSettingsPanel";
import { ChamberAgentSummaryPopup } from "./ChamberAgentSummaryPopup";
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

function cleanDigestText(text: string): string {
  return text
    .replace(
      /\s*,?\s*conf\s+\d+(?:\.\d+)?%?(?:\s*(?:\/|out of)\s*\d+(?:\.\d+)?%?)?/gi,
      "",
    )
    .replace(/\s{2,}/g, " ")
    .trim();
}

function renderRichDigest(text: string) {
  const cleaned = cleanDigestText(text);
  const parts = cleaned
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean);

  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      const inner = part.slice(2, -2);
      return (
        <strong key={i} className="font-semibold text-[var(--fintheon-accent)]">
          {inner}
        </strong>
      );
    }
    const lines = part.split(/\n+/).filter(Boolean);
    return (
      <span key={i}>
        {lines.map((line, j) => (
          <span key={j}>
            {j > 0 && <br />}
            {line}
          </span>
        ))}
      </span>
    );
  });
}

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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [openSummaryRoles, setOpenSummaryRoles] = useState<
    ArbitrumSeat["role"][]
  >([]);

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

  const openSummaries = useMemo(
    () =>
      openSummaryRoles
        .map((role) => seats.find((seat) => seat.role === role))
        .filter((seat): seat is ArbitrumSeat => Boolean(seat?.rationale)),
    [openSummaryRoles, seats],
  );

  const openAgentSummary = useCallback((role: ArbitrumSeat["role"]) => {
    setOpenSummaryRoles((prev) => {
      const next = [...prev.filter((item) => item !== role), role];
      return next.slice(-2);
    });
  }, []);

  const closeAgentSummary = useCallback((role: ArbitrumSeat["role"]) => {
    setOpenSummaryRoles((prev) => prev.filter((item) => item !== role));
  }, []);

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

  useEffect(() => {
    setOpenSummaryRoles([]);
  }, [verdict?.id]);

  const hasVerdict = Boolean(verdict);
  const hasRealSeats = (verdict?.seats?.length ?? 0) > 0;
  const chamberSummary = verdict?.digest_text
    ? cleanDigestText(verdict.digest_text)
    : "";

  return (
    <div className="relative flex flex-col min-h-0 min-w-0 gap-2.5">
      {/* Header: title + phase badge only */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] uppercase tracking-wider text-[var(--fintheon-text)]/60">
          Arbitrum Chamber
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSettingsOpen((v) => !v)}
            className="p-1 rounded hover:bg-[var(--fintheon-accent)]/10 transition-colors"
            aria-label="Chamber settings"
            title="Chamber Settings"
          >
            <Settings className="w-3.5 h-3.5 text-[var(--fintheon-accent)]/50 hover:text-[var(--fintheon-accent)] transition-colors" />
          </button>
          <span className="text-[9px] uppercase tracking-wider text-[var(--fintheon-text)]/35">
            {phase}
          </span>
        </div>
      </div>
      <div className="flex flex-col md:flex-row md:items-stretch">
        {seats.map((seat, i) => (
          <div key={`${seat.role}-${i}`} className="contents">
            {i > 0 && (
              <>
                <FadingRuler className="my-1 md:hidden" />
                <FadingRuler
                  orientation="vertical"
                  className="mx-1 hidden md:block"
                />
              </>
            )}
            <div className="flex-1 min-w-0">
              {hasRealSeats ? (
                <SeatCard
                  seat={seat}
                  index={i}
                  visible={revealed[i] ?? false}
                  isSummaryOpen={openSummaryRoles.includes(seat.role)}
                  onOpenSummary={() => openAgentSummary(seat.role)}
                />
              ) : (
                <EmptySeat
                  role={seat.role}
                  index={i}
                  visible={revealed[i] ?? false}
                />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Consensus sits directly under the seat row; digest follows it. */}
      {hasVerdict && (
        <VerdictCard verdict={verdict as ArbitrumVerdict} compact embedded />
      )}

      {chamberSummary && (
        <div className="text-[11px] text-[var(--fintheon-text)]/62 leading-relaxed px-1">
          {renderRichDigest(verdict!.digest_text)}
        </div>
      )}

      {!hasVerdict && (
        <div className="bg-transparent p-3 text-xs text-[var(--fintheon-text)]/55">
          <FadingRuler className="mb-3" />
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

      {settingsOpen && (
        <ArbitrumSettingsPanel onClose={() => setSettingsOpen(false)} />
      )}

      {openSummaries.map((seat, index) => (
        <ChamberAgentSummaryPopup
          key={seat.role}
          seat={seat}
          index={index}
          zIndex={70 + index}
          onActivate={() => openAgentSummary(seat.role)}
          onClose={() => closeAgentSummary(seat.role)}
        />
      ))}
    </div>
  );
}

export default ArbitrumChamber;
