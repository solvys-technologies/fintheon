// [claude-code 2026-04-19] Unicode spinner bank — Braille/ASCII-first microinteractions
// inspired by Irfan Aziz's Unicode Spinner (unicode.framer.website). Zero runtime deps.
// Every spinner is driven by two vars: `severity` (color) and `priority` (speed),
// both mapped to the existing Fintheon severity/priority enum so no new data shape.
//
// Presets: FishSwimmer (arbitrumChamber), CircleQuarters (refresh icon),
// MeterBar + ArrowShimmer + MeterToShimmer (riskflow top-bar refresh motion),
// HelixVertical (chat "thinking").

import { useEffect, useRef, useState, useMemo } from "react";
import type { CSSProperties } from "react";

export type IconSeverity = "critical" | "high" | "medium" | "low";
export type IconPriority = "critical" | "high" | "medium" | "low";

interface BaseProps {
  severity?: IconSeverity;
  priority?: IconPriority;
  /** px, applied as font-size. Default 14. */
  size?: number;
  /** override resolved severity color */
  color?: string;
  /** pause animation */
  active?: boolean;
  className?: string;
  style?: CSSProperties;
}

const SEVERITY_COLOR: Record<IconSeverity, string> = {
  critical: "var(--fintheon-severe)",
  high: "var(--fintheon-severe)",
  medium: "var(--fintheon-neutral-severe)",
  low: "var(--fintheon-neutral)",
};

const PRIORITY_MS: Record<IconPriority, number> = {
  critical: 60,
  high: 100,
  medium: 150,
  low: 220,
};

function resolveColor(severity?: IconSeverity, override?: string): string {
  if (override) return override;
  if (severity) return SEVERITY_COLOR[severity];
  return "var(--fintheon-accent)";
}

function resolveMs(priority?: IconPriority, override?: number): number {
  if (override != null) return override;
  if (priority) return PRIORITY_MS[priority];
  return 150;
}

const MONO_STACK =
  "ui-monospace, 'SF Mono', Menlo, Monaco, 'Cascadia Code', 'Roboto Mono', monospace";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
  );
}

function useFrameCycle<T>(frames: T[], intervalMs: number, active: boolean): T {
  const [idx, setIdx] = useState(0);
  const reduced = useRef(prefersReducedMotion());
  useEffect(() => {
    if (!active || reduced.current || frames.length <= 1) return;
    const id = window.setInterval(() => {
      setIdx((i) => (i + 1) % frames.length);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [frames.length, intervalMs, active]);
  return frames[idx] ?? frames[0];
}

function glyphStyle(
  size: number,
  color: string,
  extra?: CSSProperties,
): CSSProperties {
  return {
    fontFamily: MONO_STACK,
    fontSize: size,
    fontVariantNumeric: "tabular-nums",
    fontFeatureSettings: '"tnum" 1, "zero" 1',
    color,
    lineHeight: 1,
    letterSpacing: 0,
    whiteSpace: "pre",
    display: "inline-block",
    ...extra,
  };
}

// ─── FISH ────────────────────────────────────────────────────────────
// ~~~~~~~ ><((º> ~~~~~  — fish swims through a tilde stream.
// Animation: the fish token holds station while the stream scrolls under it,
// so the fish appears to move against the current.
const FISH_TOKEN = "><((º>";
const STREAM_CHARS = "~ ~ ~~ ~~~ ~ ~";

function buildFishFrame(offset: number, streamWidth: number): string {
  const repeated = STREAM_CHARS.repeat(6);
  const left = repeated.slice(offset, offset + streamWidth);
  const right = repeated.slice(offset, offset + streamWidth);
  return `${left} ${FISH_TOKEN} ${right}`;
}

export function FishSwimmer({
  severity,
  priority,
  size = 14,
  color,
  active = true,
  className,
  style,
  streamWidth = 7,
}: BaseProps & { streamWidth?: number }) {
  const frames = useMemo(() => {
    const out: string[] = [];
    for (let i = 0; i < STREAM_CHARS.length; i++) {
      out.push(buildFishFrame(i, streamWidth));
    }
    return out;
  }, [streamWidth]);
  const ms = resolveMs(priority) * 0.75;
  const frame = useFrameCycle(frames, ms, active);
  const resolved = resolveColor(severity, color);
  return (
    <span
      className={className}
      aria-label="swimming"
      style={glyphStyle(size, resolved, {
        opacity: 0.75,
        ...style,
      })}
    >
      {frame}
    </span>
  );
}

// ─── CIRCLE QUARTERS ─────────────────────────────────────────────────
// ◴ ◷ ◶ ◵  — rotates clockwise. Used as the refresh icon across the app.
const CIRCLE_QUARTER_FRAMES = ["◴", "◷", "◶", "◵"];
const CIRCLE_IDLE = "◴";

export function CircleQuarters({
  severity,
  priority,
  size = 14,
  color,
  active = true,
  className,
  style,
}: BaseProps) {
  const ms = resolveMs(priority, 110);
  const frame = useFrameCycle(CIRCLE_QUARTER_FRAMES, ms, active);
  const resolved = resolveColor(severity, color);
  return (
    <span
      className={className}
      aria-hidden="true"
      style={glyphStyle(size, resolved, {
        width: size * 1.1,
        textAlign: "center",
        ...style,
      })}
    >
      {active ? frame : CIRCLE_IDLE}
    </span>
  );
}

// ─── METER ───────────────────────────────────────────────────────────
// ▱▱▱▱▱ fills to ▰▰▰▰▰ then resets. Finite fill, meant to be used in a
// one-shot MeterToShimmer sequence.
const METER_EMPTY = "▱";
const METER_FULL = "▰";

function buildMeterFrames(cells: number): string[] {
  const out: string[] = [];
  for (let i = 0; i <= cells; i++) {
    out.push(METER_FULL.repeat(i) + METER_EMPTY.repeat(cells - i));
  }
  return out;
}

export function MeterBar({
  severity,
  priority,
  size = 12,
  color,
  active = true,
  className,
  style,
  cells = 5,
  loop = true,
  onComplete,
}: BaseProps & {
  cells?: number;
  loop?: boolean;
  onComplete?: () => void;
}) {
  const frames = useMemo(() => buildMeterFrames(cells), [cells]);
  const ms = resolveMs(priority, 80);
  const [idx, setIdx] = useState(0);
  const reduced = useRef(prefersReducedMotion());
  useEffect(() => {
    if (!active || reduced.current) return;
    const id = window.setInterval(() => {
      setIdx((i) => {
        if (i + 1 >= frames.length) {
          if (!loop) {
            window.clearInterval(id);
            onComplete?.();
            return i;
          }
          return 0;
        }
        return i + 1;
      });
    }, ms);
    return () => window.clearInterval(id);
  }, [frames.length, ms, active, loop, onComplete]);
  const resolved = resolveColor(severity, color);
  return (
    <span
      className={className}
      aria-label="loading"
      style={glyphStyle(size, resolved, style)}
    >
      {frames[idx]}
    </span>
  );
}

// ─── ARROW SHIMMER (ARROW-3) ─────────────────────────────────────────
// ▹▹▹▹▹ stream with ▸ cursor travelling left-to-right.
const ARROW_EMPTY = "▹";
const ARROW_FULL = "▸";

function buildArrowFrames(cells: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < cells; i++) {
    out.push(
      ARROW_EMPTY.repeat(i) + ARROW_FULL + ARROW_EMPTY.repeat(cells - i - 1),
    );
  }
  return out;
}

export function ArrowShimmer({
  severity,
  priority,
  size = 12,
  color,
  active = true,
  className,
  style,
  cells = 5,
}: BaseProps & { cells?: number }) {
  const frames = useMemo(() => buildArrowFrames(cells), [cells]);
  const ms = resolveMs(priority, 90);
  const frame = useFrameCycle(frames, ms, active);
  const resolved = resolveColor(severity, color);
  return (
    <span
      className={className}
      aria-label="streaming"
      style={glyphStyle(size, resolved, style)}
    >
      {frame}
    </span>
  );
}

// ─── METER → SHIMMER ─────────────────────────────────────────────────
// Two-stage refresh motion: METER fills once, then hands off to ARROW shimmer
// that loops until the parent sets `active` false.
export function MeterToShimmer({
  severity,
  priority,
  size = 12,
  color,
  active = true,
  className,
  style,
  cells = 5,
}: BaseProps & { cells?: number }) {
  const [stage, setStage] = useState<"meter" | "arrow">("meter");
  useEffect(() => {
    if (!active) setStage("meter");
  }, [active]);
  if (!active) return null;
  if (stage === "meter") {
    return (
      <MeterBar
        severity={severity}
        priority={priority}
        size={size}
        color={color}
        className={className}
        style={style}
        cells={cells}
        loop={false}
        onComplete={() => setStage("arrow")}
      />
    );
  }
  return (
    <ArrowShimmer
      severity={severity}
      priority={priority}
      size={size}
      color={color}
      className={className}
      style={style}
      cells={cells}
    />
  );
}

// ─── HELIX VERTICAL ──────────────────────────────────────────────────
// Two Braille strands weaving as they descend. Stood up vertically so it
// fits the chat-thinking slot beside an avatar or inline in an assistant row.
const HELIX_FRAMES: string[][] = [
  ["⠁ ⠀", "⠐ ⠈", "⠀ ⠂", "⠐ ⠈", "⠁ ⠀"],
  ["⠀ ⠁", "⠈ ⠐", "⠂ ⠀", "⠈ ⠐", "⠀ ⠁"],
  ["⠁ ⠀", "⠐ ⠈", "⠀ ⠂", "⠐ ⠈", "⠁ ⠀"],
  ["⠀ ⠁", "⠈ ⠐", "⠂ ⠀", "⠈ ⠐", "⠀ ⠁"],
];

export function HelixVertical({
  severity,
  priority,
  size = 11,
  color,
  active = true,
  className,
  style,
  rows,
}: BaseProps & { rows?: number }) {
  const ms = resolveMs(priority, 120);
  const frame = useFrameCycle(HELIX_FRAMES, ms, active);
  const resolved = resolveColor(severity, color);
  const displayed = rows ? frame.slice(0, rows) : frame;
  return (
    <span
      className={className}
      aria-label="thinking"
      style={glyphStyle(size, resolved, {
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        lineHeight: 1.05,
        ...style,
      })}
    >
      {displayed.map((row, i) => (
        <span key={i} style={{ display: "block" }}>
          {row}
        </span>
      ))}
    </span>
  );
}
