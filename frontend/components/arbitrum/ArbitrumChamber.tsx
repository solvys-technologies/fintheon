// [claude-code 2026-05-15] S66-T1: added instrument dropdown in chamber header, passes
//   selected instrument to useArbitrumLatest.
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
import { useSettings } from "../../contexts/SettingsContext";
import { FadingRuler } from "../shared/FadingRuler";
import { NothingFuse } from "../shared/NothingFuse";
import { DotMatrixLoader } from "../icon-bank/DotMatrixLoader";
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

const AGENT_ROW_ROLES: ReadonlyArray<ArbitrumSeat["role"]> = [
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

function ConfidencePair({
  caoConfidence,
  chamberConfidence,
}: {
  caoConfidence: number;
  chamberConfidence: number;
}) {
  const rows = [
    { label: "CAO confidence", value: caoConfidence },
    { label: "Chamber confidence", value: chamberConfidence },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 px-1">
      {rows.map((row) => {
        const value = Math.max(0, Math.min(1, row.value));
        return (
          <div key={row.label} className="min-w-0">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-[9px] uppercase tracking-wider text-[var(--fintheon-text)]/45">
                {row.label}
              </span>
              <span className="font-mono text-[10px] text-[var(--fintheon-text)]/65 tabular-nums">
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

export function ArbitrumChamber(props: ArbitrumChamberProps) {
  const { onSynthesisComplete } = props;
  const { selectedInstrument, setSelectedInstrument } = useSettings();
  const { verdict, isLoading, error, refresh } = useArbitrumLatest(selectedInstrument);
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

  const caoSeat = useMemo(
    () => seats.find((seat) => seat.role === "Lead") ?? null,
    [seats],
  );

  const agentRowSeats = useMemo<ArbitrumSeat[]>(() => {
    const byRole = new Map(seats.map((seat) => [seat.role, seat] as const));
    return AGENT_ROW_ROLES.map(
      (role): ArbitrumSeat =>
        byRole.get(role) ?? {
          role,
          model: "—",
          probability: 0,
          confidence: 0,
          rationale: "",
        },
    );
  }, [seats]);

  const revealed = useStaggeredReveal(agentRowSeats.length);

  const openSummaries = useMemo(
    () =>
      openSummaryRoles
        .map((role) => agentRowSeats.find((seat) => seat.role === role))
        .filter((seat): seat is ArbitrumSeat => Boolean(seat?.rationale)),
    [openSummaryRoles, agentRowSeats],
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
  const [phaseNotice, setPhaseNotice] = useState<string | null>(null);

  useEffect(() => {
    setPhaseNotice(phase);
    const id = window.setTimeout(() => setPhaseNotice(null), 2600);
    return () => window.clearTimeout(id);
  }, [phase]);

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
  return (
    <div className="relative flex flex-col min-h-0 min-w-0 gap-2.5">
      {/* Header: title + instrument dropdown + phase badge only */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-[var(--fintheon-text)]/60">
            Arbitrum Chamber
          </span>
          <select
            value={selectedInstrument}
            onChange={(e) => setSelectedInstrument(e.target.value)}
            className="text-[9px] uppercase tracking-wider bg-transparent border border-[var(--fintheon-accent)]/20 rounded px-1.5 py-0.5 text-[var(--fintheon-text)]/60 focus:outline-none focus:border-[var(--fintheon-accent)]/50"
            style={{ fontFamily: "var(--font-data, monospace)" }}
          >
            {["/NQ","/ES","/YM","/RTY","/CL","/GC","/ZB","/ZN","/ZT","/BTC","/ETH","/6E","/6J","/6B","/6A","/6C","/6S"].map((s) => (
              <option key={s} value={s} className="bg-[var(--fintheon-bg)] text-[var(--fintheon-text)]">
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          {phaseNotice ? (
            <span
              key={phaseNotice}
              className="fintheon-status-notice-fade text-[10px] uppercase tracking-wider text-[var(--fintheon-text)]/45"
            >
              {phaseNotice}
            </span>
          ) : null}
          <button
            onClick={() => setSettingsOpen((v) => !v)}
            className="p-1 rounded hover:bg-[var(--fintheon-accent)]/10 transition-colors"
            aria-label="Chamber settings"
            title="Chamber Settings"
          >
            <Settings className="w-3.5 h-3.5 text-[var(--fintheon-accent)]/50 hover:text-[var(--fintheon-accent)] transition-colors" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-0 md:grid-cols-4">
        {agentRowSeats.map((seat, i) => (
          <div
            key={`${verdict?.id ?? "empty"}-${seat.role}-${i}`}
            className="min-w-0"
          >
            {i > 0 && (
              <FadingRuler className="my-1 md:hidden" />
            )}
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
        ))}
      </div>

      {hasVerdict && (
        <ConfidencePair
          caoConfidence={caoSeat?.confidence ?? 0}
          chamberConfidence={verdict?.confidence ?? 0}
        />
      )}

      {/* Consensus sits directly under the seat row; digest follows it. */}
      {hasVerdict && (
        <VerdictCard verdict={verdict as ArbitrumVerdict} compact embedded />
      )}

      {!hasVerdict && (
        <div className="bg-transparent p-3 text-xs text-[var(--fintheon-text)]/55">
          <FadingRuler className="mb-3" />
          {isLoading ? (
            <DotMatrixLoader variant="pyramid" size={24} label="Loading chamber read" />
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
