// [claude-code 2026-04-25] S40-P6: Time-To-Print widget — replaces PsychAssist
// in the Strategium slot at T-5min before a scheduled CPI/NFP/FOMC/megacap-
// earnings event, fades back at T+30s.
//
// Layouts:
//   header (h-7):   [🇺🇸 US]  CPI (Core, MoM)  Forecast: 0.3%   04:32
//                   on print → Actual: 0.4% [BEAT]
//   floating (340): 2-row card with same data
//
// Color rules — Solvys Gold accent (#c79f4a) for beat / inline; muted red
// (#c97777) for miss; never green. Pulse on countdown digits at 00:00 until
// actual or 60s timeout. Multi-event collision shows highest-rank only with
// `+N more` chip.
//
// MainLayout integration is owned by peers per the s35-unified safe-zones —
// drop this component into the existing PsychAssist slot when that work
// lands. Self-contained: imports nothing from MainLayout.

import { useEffect, useRef, useState } from "react";
import { CountryFlag } from "../primitives/CountryFlag";
import type {
  TimeToPrintEvent,
  TimeToPrintUpcoming,
} from "../../hooks/useTimeToPrint";

export type TimeToPrintDockTarget = "header" | "floating";

interface TimeToPrintDockableProps {
  event: TimeToPrintEvent;
  target: TimeToPrintDockTarget;
  secondsRemaining: number;
  upcomingCount: number;
  upcoming?: TimeToPrintUpcoming[];
  onShowMore?: () => void;
}

const HEADER_HEIGHT_PX = 28; // h-7

function formatCountdown(secs: number): string {
  if (secs <= 0) return "00:00";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function chipClassesFor(beatMiss: TimeToPrintEvent["event"]["beatMiss"]): string {
  if (beatMiss === "beat") {
    return "bg-[var(--fintheon-accent)]/15 text-[var(--fintheon-accent)] border-[var(--fintheon-accent)]/30";
  }
  if (beatMiss === "miss") {
    return "bg-[#7a3a3a]/15 text-[#c97777] border-[#c97777]/30";
  }
  return "bg-[var(--fintheon-text)]/10 text-[var(--fintheon-text)]/70 border-[var(--fintheon-text)]/20";
}

function chipLabelFor(beatMiss: TimeToPrintEvent["event"]["beatMiss"]): string {
  if (beatMiss === "beat") return "BEAT";
  if (beatMiss === "miss") return "MISS";
  return "INLINE";
}

function formatRowCountdown(firesAt: string): string {
  const remaining = Math.max(
    0,
    Math.floor((new Date(firesAt).getTime() - Date.now()) / 1000),
  );
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

interface UpcomingDropdownProps {
  upcoming: TimeToPrintUpcoming[];
  open: boolean;
  onClose: () => void;
}

function UpcomingDropdown({ upcoming, open, onClose }: UpcomingDropdownProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (!open) {
      setMounted(false);
      return;
    }
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, [open]);
  if (!open) return null;
  return (
    <div
      className="t-dropdown absolute top-full right-0 mt-1 z-50 origin-top-right rounded-sm border border-[var(--fintheon-accent)]/20 bg-[var(--fintheon-bg)]/95 shadow-sm"
      data-open={mounted}
      role="menu"
      onMouseLeave={onClose}
      style={{ minWidth: 280 }}
    >
      {upcoming.map((u) => (
        <div
          key={u.id}
          className="flex items-center gap-2 h-6 px-2 text-[11px] border-b border-[var(--fintheon-text)]/5 last:border-b-0"
        >
          <CountryFlag country={u.country} size={10} />
          <span className="truncate text-[var(--fintheon-text)]/90 font-mono">
            {u.name}
          </span>
          <span className="flex-1" />
          {u.forecast && (
            <span className="text-[var(--fintheon-text)]/50">
              fc: {u.forecast}
            </span>
          )}
          <span
            className="font-mono tabular-nums text-[var(--fintheon-text)]/80"
            data-doto
          >
            {formatRowCountdown(u.fires_at)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function TimeToPrintDockable({
  event,
  target,
  secondsRemaining,
  upcomingCount,
  upcoming,
  onShowMore,
}: TimeToPrintDockableProps) {
  const [mountedOpen, setMountedOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const handleShowMore = () => {
    setDropdownOpen((v) => !v);
    onShowMore?.();
  };

  // [feedback_t_panel_slide_first_paint_raf] Mounting with data-open="true"
  // skips the entry transition. Drive data-open via rAF so the slide tween
  // runs from the closed resting state.
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMountedOpen(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const isLive = event.state === "live" && !event.event.actual;
  const printed = event.state === "printed" && event.event.actual;
  const showPulse = isLive && secondsRemaining === 0;

  if (target === "header") {
    return (
      <div
        ref={panelRef}
        className="t-panel-slide flex items-center gap-2 px-3 text-[12px]"
        data-open={mountedOpen}
        style={{ height: HEADER_HEIGHT_PX }}
        role="status"
        aria-live="polite"
      >
        <CountryFlag country={event.event.country} size={12} />
        <span className="text-[var(--fintheon-text)]/90 font-mono">
          {event.event.name}
        </span>
        <span className="flex-1" />
        {!printed ? (
          <>
            {event.event.forecast != null && (
              <span className="text-[var(--fintheon-text)]/60">
                Forecast:{" "}
                <span className="text-[var(--fintheon-text)]">
                  {event.event.forecast}
                </span>
              </span>
            )}
            <span
              className={`font-mono tabular-nums tracking-tight ${showPulse ? "ttp-pulse" : ""}`}
              data-doto
            >
              {formatCountdown(secondsRemaining)}
            </span>
          </>
        ) : (
          <>
            <span className="text-[var(--fintheon-text)]/60">
              Actual:{" "}
              <span className="text-[var(--fintheon-text)]">
                {event.event.actual}
              </span>
            </span>
            <span
              className={`px-1.5 py-px rounded-sm border text-[10px] font-mono uppercase tracking-wide ${chipClassesFor(event.event.beatMiss)}`}
            >
              {chipLabelFor(event.event.beatMiss)}
            </span>
          </>
        )}
        {upcomingCount > 0 && (
          <div className="relative">
            <button
              type="button"
              onClick={handleShowMore}
              className="ml-1 px-1.5 py-px rounded-sm border border-[var(--fintheon-accent)]/30 text-[10px] text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10 transition-colors"
              aria-label={`Show ${upcomingCount} more upcoming events`}
              aria-expanded={dropdownOpen}
            >
              +{upcomingCount} more
            </button>
            <UpcomingDropdown
              upcoming={upcoming ?? []}
              open={dropdownOpen}
              onClose={() => setDropdownOpen(false)}
            />
          </div>
        )}
      </div>
    );
  }

  // Floating mode — 340px card with 2 rows.
  return (
    <div
      ref={panelRef}
      className="t-panel-slide flex flex-col gap-1 px-3 py-2 rounded-sm border border-[var(--fintheon-accent)]/20 bg-[var(--fintheon-bg)]/95"
      data-open={mountedOpen}
      style={{ width: 340 }}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 text-[12px]">
        <CountryFlag country={event.event.country} size={14} />
        <span className="text-[var(--fintheon-text)] font-mono">
          {event.event.name}
        </span>
        {upcomingCount > 0 && (
          <div className="relative ml-auto">
            <button
              type="button"
              onClick={handleShowMore}
              className="px-1.5 py-px rounded-sm border border-[var(--fintheon-accent)]/30 text-[10px] text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10 transition-colors"
              aria-expanded={dropdownOpen}
            >
              +{upcomingCount} more
            </button>
            <UpcomingDropdown
              upcoming={upcoming ?? []}
              open={dropdownOpen}
              onClose={() => setDropdownOpen(false)}
            />
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 text-[11px]">
        {!printed ? (
          <>
            <span className="text-[var(--fintheon-text)]/60">
              Forecast:{" "}
              <span className="text-[var(--fintheon-text)]">
                {event.event.forecast ?? "—"}
              </span>
            </span>
            <span className="flex-1" />
            <span
              className={`font-mono tabular-nums text-[14px] ${showPulse ? "ttp-pulse" : ""}`}
              data-doto
            >
              {formatCountdown(secondsRemaining)}
            </span>
          </>
        ) : (
          <>
            <span className="text-[var(--fintheon-text)]/60">
              Actual:{" "}
              <span className="text-[var(--fintheon-text)]">
                {event.event.actual}
              </span>
            </span>
            <span className="flex-1" />
            <span
              className={`px-1.5 py-px rounded-sm border text-[10px] font-mono uppercase tracking-wide ${chipClassesFor(event.event.beatMiss)}`}
            >
              {chipLabelFor(event.event.beatMiss)}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
