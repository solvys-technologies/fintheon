// [claude-code 2026-03-28] S5-T5: Living motion system — pure CSS + RAF, no external libs

/** Staggered entrance: cards appear with delay based on index */
export function staggerDelay(index: number, baseMs = 0): React.CSSProperties {
  return { animationDelay: `${index * 50 + baseMs}ms` };
}

/** Spring physics easing for zoom transitions */
export const SPRING_EASE = "cubic-bezier(0.34, 1.56, 0.64, 1)";

/** Card entrance animation class name */
export const CARD_ENTER_CLASS = "animate-card-enter";

/** Severity glow animation class name */
export const SEVERITY_PULSE_CLASS = "animate-severity-pulse";

/** Rope draw-in animation class name */
export const ROPE_DRAW_CLASS = "animate-rope-draw";

/** Zoom transition — applies to canvas container */
export const ZOOM_TRANSITION = `transform 0.4s ${SPRING_EASE}`;

/** Severity-driven scale: HIGH = 1.05, MEDIUM = 1.0, LOW = 0.97 */
export function severityScale(severity: "high" | "medium" | "low"): number {
  switch (severity) {
    case "high":
      return 1.05;
    case "medium":
      return 1.0;
    case "low":
      return 0.97;
  }
}

/** Severity-driven opacity: HIGH = 1, MEDIUM = 1, LOW = 0.85 */
export function severityOpacity(severity: "high" | "medium" | "low"): number {
  return severity === "low" ? 0.85 : 1;
}

/** Severity-driven left border width: HIGH = 3px, MEDIUM = 2px, LOW = 1px */
export function severityBorderWidth(
  severity: "high" | "medium" | "low",
): number {
  switch (severity) {
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
  }
}
