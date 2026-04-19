// [claude-code 2026-04-19] S25: shared drag-to-close physics + timing so SnapSheet and
//   the new full-screen DetailSheet feel identical under the finger. All tunable surfaces
//   here — nowhere else should hard-code these numbers.
import type { PanInfo, Transition } from "framer-motion";

/** Dismiss if the user flicks down fast OR drags down far. */
export const SHEET_VELOCITY_DISMISS = 300;
export const SHEET_OFFSET_DISMISS = 120;

/** Slide-up entry — custom cubic-bezier for a natural sheet feel (matches SnapSheet). */
export const SHEET_ENTRY: Transition = {
  duration: 0.32,
  ease: [0.22, 0.1, 0.2, 1],
};

/** Spring for micro-interactions (tap, reveal, status changes). Snappy but not jittery. */
export const MICRO_SPRING: Transition = {
  type: "spring",
  stiffness: 420,
  damping: 32,
  mass: 0.8,
};

/** Subtle stagger to reveal header → body → footer in sequence for a composed feel. */
export const DETAIL_STAGGER = 0.06;

/** Press feedback — applies to any glass card that becomes a button. */
export const CARD_PRESS = {
  scale: 0.985,
  transition: { type: "spring" as const, stiffness: 600, damping: 32 },
};

/** Shared drag handler — call from `onDragEnd`. */
export function shouldDismissFromDrag(info: PanInfo): boolean {
  return (
    info.velocity.y > SHEET_VELOCITY_DISMISS ||
    info.offset.y > SHEET_OFFSET_DISMISS
  );
}

/** Backdrop fade timing — slightly slower than sheet so the surface feels weighted. */
export const BACKDROP_TRANSITION: Transition = { duration: 0.22 };
