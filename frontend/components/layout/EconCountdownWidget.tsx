// [claude-code 2026-04-30] S55: Econ Countdown widget for the heading toolbar.
// Shares the same slot as PsychAssist. Fades in when an econ event is approaching
// (T-minus active event), fades out when dismissed or the event passes.
//
// States:
//   idle — no active event, invisible (PsychAssist shows instead)
//   countdown — T-minus, shows event preview + forecast + countdown
//   printed — actual received, shows value + dismiss X
//   dismissed — fades out, PsychAssist fades back in

import { useEffect, useState, useRef, useCallback } from "react";
import { X, Clock } from "lucide-react";
import {
  useEconWatchHealth,
  type ActiveWatchEvent,
} from "../../hooks/useEconWatchHealth";

interface EconCountdownWidgetProps {
  visible: boolean;
  onDismiss: () => void;
}

function formatCountryCode(country: string | null): string {
  if (!country) return "";
  const normalized = country.toUpperCase();
  const known = [
    "US",
    "EU",
    "UK",
    "JP",
    "CN",
    "DE",
    "FR",
    "CA",
    "AU",
    "CH",
    "NZ",
  ];
  return (
    known.find((code) => normalized.includes(code)) ?? normalized.slice(0, 3)
  );
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "00:00";
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function EconCountdownWidget({
  visible,
  onDismiss,
}: EconCountdownWidgetProps) {
  const { events } = useEconWatchHealth();
  const [fadeState, setFadeState] = useState<"out" | "in" | "visible">("out");
  const [dismissed, setDismissed] = useState(false);
  const [currentEvent, setCurrentEvent] = useState<ActiveWatchEvent | null>(
    null,
  );
  const [countdownMs, setCountdownMs] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const findClosestUpcoming = useCallback(() => {
    const now = Date.now();
    let closest: ActiveWatchEvent | null = null;
    let closestMs = Infinity;

    for (const ev of events) {
      if (ev.status !== "upcoming" && ev.status !== "printed") continue;
      const target = new Date(ev.scheduledAt).getTime();
      const delta = target - now;
      const isInWindow =
        (ev.status === "upcoming" && delta > 0 && delta < 60 * 60 * 1000) ||
        (ev.status === "printed" && Math.abs(delta) < 20 * 60 * 1000);
      if (isInWindow && Math.abs(delta) < closestMs) {
        closestMs = Math.abs(delta);
        closest = ev;
      }
    }
    return {
      event: closest,
      ms: closest?.status === "upcoming" ? closestMs : null,
    };
  }, [events]);

  // Find closest upcoming event and track countdown
  useEffect(() => {
    if (!visible || dismissed) {
      setFadeState("out");
      setCurrentEvent(null);
      setCountdownMs(null);
      return;
    }

    const update = () => {
      const { event, ms } = findClosestUpcoming();
      setCurrentEvent(event);
      setCountdownMs(ms);

      // If event just printed (actual now has a value), switch state
      if (event && event.status === "printed" && event.actual != null) {
        setFadeState("visible");
      }
    };

    update();

    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(update, 1000);

    // Fade in
    const timer = setTimeout(() => setFadeState("in"), 50);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      clearTimeout(timer);
    };
  }, [visible, dismissed, findClosestUpcoming]);

  // Transition: fade in → visible after animation completes
  useEffect(() => {
    if (fadeState === "in") {
      const timer = setTimeout(() => setFadeState("visible"), 280);
      return () => clearTimeout(timer);
    }
  }, [fadeState]);

  const handleDismiss = () => {
    setFadeState("out");
    setDismissed(true);
    const timer = setTimeout(() => {
      onDismiss();
      setDismissed(false);
    }, 280);
    return () => clearTimeout(timer);
  };

  // Early return before fade animation starts
  if (fadeState === "out") return null;

  const isPrinted =
    currentEvent?.status === "printed" && currentEvent?.actual != null;
  const isTransitioning = fadeState === "in";

  return (
    <div
      className="flex items-center gap-2 bg-[var(--fintheon-bg)] border border-[var(--fintheon-accent)]/20 rounded-lg px-3 h-7 overflow-hidden flex-shrink-0"
      style={{
        opacity: isTransitioning ? 0 : 1,
        transition: "opacity 280ms cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      {!currentEvent ? (
        <>
          <Clock className="w-3 h-3 text-zinc-600" />
          <span className="text-[9px] text-zinc-500 tabular-nums">
            No active event
          </span>
        </>
      ) : (
        <div className="flex items-center gap-2 min-w-0">
          {/* Country code */}
          {currentEvent.country && (
            <span className="text-[9px] leading-none shrink-0 font-mono text-[var(--fintheon-text)]/45 tabular-nums">
              {formatCountryCode(currentEvent.country)}
            </span>
          )}

          {/* Event name preview */}
          <span className="text-[9px] text-[var(--fintheon-accent)]/80 font-medium tracking-[0.08em] uppercase truncate max-w-[100px]">
            {currentEvent.eventName}
          </span>

          {/* Separator */}
          <div className="w-px h-3 bg-[var(--fintheon-accent)]/15" />

          {/* Forecast */}
          {currentEvent.forecast != null && !isPrinted && (
            <span className="text-[9px] text-zinc-500 font-mono tabular-nums">
              Fcst {currentEvent.forecast}
            </span>
          )}

          {/* Countdown or Actual */}
          {isPrinted ? (
            <span className="text-[10px] text-emerald-400 font-mono font-semibold tabular-nums">
              {currentEvent.actual}
            </span>
          ) : countdownMs != null ? (
            <span
              className={`text-[10px] font-mono font-semibold tabular-nums ${
                countdownMs <= 60_000
                  ? "text-amber-400 animate-pulse"
                  : "text-[var(--fintheon-accent)]"
              }`}
            >
              {formatCountdown(countdownMs)}
            </span>
          ) : null}

          {/* Separator */}
          <div className="w-px h-3 bg-[var(--fintheon-accent)]/15" />

          {/* Dismiss X */}
          <button
            onClick={handleDismiss}
            className="p-0.5 rounded hover:bg-[var(--fintheon-accent)]/10 text-zinc-600 hover:text-[var(--fintheon-accent)] transition-colors shrink-0"
            title="Dismiss"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}
