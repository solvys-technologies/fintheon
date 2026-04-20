// Ported from https://github.com/Eronred/expo-agent-spinners (MIT) — S28-T3 2026-04-20
// React Native <Text> + setInterval swapped for <span> + useEffect. `prefers-reduced-motion`
// stops the tick and renders the first frame statically so low-motion users never see jitter.
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";

export type SpinnerSeverity = "critical" | "high" | "medium" | "low";
export type SpinnerPriority = "critical" | "high" | "medium" | "low";

export interface SpinnerProps {
  severity?: SpinnerSeverity;
  priority?: SpinnerPriority;
  /** px, applied as font-size. Default 14. */
  size?: number;
  /** override resolved severity color */
  color?: string;
  /** pause animation (render first frame) */
  active?: boolean;
  className?: string;
  style?: CSSProperties;
}

const SEVERITY_COLOR: Record<SpinnerSeverity, string> = {
  critical: "var(--fintheon-severe, #c79f4a)",
  high: "var(--fintheon-severe, #c79f4a)",
  medium: "var(--fintheon-neutral-severe, #c79f4a)",
  low: "var(--fintheon-neutral, #f0ead6)",
};

const PRIORITY_MS: Record<SpinnerPriority, number> = {
  critical: 60,
  high: 90,
  medium: 130,
  low: 200,
};

const MONO_STACK =
  "ui-monospace, 'SF Mono', Menlo, Monaco, 'Cascadia Code', 'Roboto Mono', monospace";

export function resolveSpinnerColor(
  severity?: SpinnerSeverity,
  override?: string,
): string {
  if (override) return override;
  if (severity) return SEVERITY_COLOR[severity];
  return "var(--fintheon-accent, #c79f4a)";
}

export function resolveSpinnerMs(
  priority: SpinnerPriority | undefined,
  fallbackMs: number,
): number {
  if (priority) return PRIORITY_MS[priority];
  return fallbackMs;
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return (
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
    );
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);
  return reduced;
}

/** Cycle a frames array every `intervalMs`. Stops cleanly when `active` is false
 *  or when the user prefers reduced motion. */
export function useSpinnerFrame<T>(
  frames: readonly T[],
  intervalMs: number,
  active: boolean,
): T {
  const [idx, setIdx] = useState(0);
  const reduced = useReducedMotion();
  const frozenRef = useRef(false);

  useEffect(() => {
    if (!active || reduced || frames.length <= 1) {
      frozenRef.current = true;
      return;
    }
    frozenRef.current = false;
    const id = window.setInterval(
      () => {
        setIdx((i) => (i + 1) % frames.length);
      },
      Math.max(16, intervalMs),
    );
    return () => window.clearInterval(id);
  }, [frames.length, intervalMs, active, reduced]);

  return frames[idx] ?? frames[0];
}

export function glyphStyle(
  size: number,
  color: string,
  extra?: CSSProperties,
): CSSProperties {
  return {
    fontFamily: MONO_STACK,
    fontSize: size,
    fontVariantNumeric: "tabular-nums",
    color,
    lineHeight: 1,
    letterSpacing: 0,
    whiteSpace: "pre",
    display: "inline-block",
    ...extra,
  };
}

export interface BaseSpinnerProps extends SpinnerProps {
  frames: readonly string[];
  intervalMs: number;
  ariaLabel?: string;
}

/** Generic spinner — the 54 named exports in ./index.tsx are thin wrappers over this. */
export function BaseSpinner({
  frames,
  intervalMs,
  size = 14,
  color,
  severity,
  priority,
  active = true,
  className,
  style,
  ariaLabel = "loading",
}: BaseSpinnerProps) {
  const resolvedMs = resolveSpinnerMs(priority, intervalMs);
  const frame = useSpinnerFrame(frames, resolvedMs, active);
  const resolvedColor = resolveSpinnerColor(severity, color);
  const resolvedFrames = useMemo(() => frames, [frames]);
  return (
    <span
      className={className}
      aria-label={ariaLabel}
      aria-live="polite"
      style={glyphStyle(size, resolvedColor, style)}
    >
      {active ? frame : resolvedFrames[0]}
    </span>
  );
}
