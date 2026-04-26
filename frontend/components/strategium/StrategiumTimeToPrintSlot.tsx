// [claude-code 2026-04-25] S40-P6: drop-in slot that conditionally renders
// Time-To-Print over PsychAssist when an eligible event is active. Pairs
// with PsychAssistDockable so the user side gets:
//   - psychAssistAutoStart=true  → PsychAssist auto-floats out of the header
//                                   while TTP holds the slot, then slides
//                                   back at T+30s.
//   - psychAssistAutoStart=false → PsychAssist stays put; TTP overlays the
//                                   header strip and PsychAssist hides via
//                                   `visible={!showTTP}`.
//
// MainLayout owns the actual slot; this primitive is what MainLayout drops
// into the existing PsychAssist position when its safe-zone clears.

import { useEffect, useRef } from "react";
import { useTimeToPrint } from "../../hooks/useTimeToPrint";
import { useSettings } from "../../contexts/SettingsContext";
import { TimeToPrintDockable } from "./TimeToPrintDockable";

interface StrategiumTimeToPrintSlotProps {
  /** Where PsychAssist normally lives — TTP renders in the same target. */
  psychAssistTarget: "header" | "floating";
  /** Setter from MainLayout: lets TTP nudge PsychAssist to floating when
   * `psychAssistAutoStart` is enabled, then restores it on cleared. */
  onRequestPsychAssistTarget?: (target: "header" | "floating") => void;
  /** When `psychAssistAutoStart` is false this is left to MainLayout to read
   * via the same hook — exposed here so the parent can hide PsychAssist while
   * TTP holds the slot. */
  onShowTtp?: (showing: boolean) => void;
}

export function StrategiumTimeToPrintSlot({
  psychAssistTarget,
  onRequestPsychAssistTarget,
  onShowTtp,
}: StrategiumTimeToPrintSlotProps) {
  const { event, secondsRemaining, upcomingCount, upcoming } = useTimeToPrint();
  const { psychAssistAutoStart } = useSettings();
  const priorTargetRef = useRef<"header" | "floating">(psychAssistTarget);

  const showing = event != null;

  // Notify parent so PsychAssist hides / unhides correctly.
  useEffect(() => {
    onShowTtp?.(showing);
  }, [showing, onShowTtp]);

  // PsychAssist auto-float coupling. When TTP shows up and the user has
  // psychAssistAutoStart enabled, push PsychAssist to floating. On hide,
  // restore the prior target.
  useEffect(() => {
    if (!psychAssistAutoStart) return;
    if (showing) {
      priorTargetRef.current = psychAssistTarget;
      if (psychAssistTarget !== "floating") {
        onRequestPsychAssistTarget?.("floating");
      }
    } else {
      onRequestPsychAssistTarget?.(priorTargetRef.current);
    }
    // psychAssistTarget is intentionally not in the deps — we want a one-shot
    // capture of the prior target, not a feedback loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showing, psychAssistAutoStart]);

  if (!event) return null;

  return (
    <TimeToPrintDockable
      event={event}
      target={psychAssistTarget}
      secondsRemaining={secondsRemaining}
      upcomingCount={upcomingCount}
      upcoming={upcoming}
    />
  );
}
