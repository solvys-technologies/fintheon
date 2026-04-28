// [claude-code 2026-04-28] T6: SolvysLoader — dotmatrix-inspired Braille beat loader.
//   Uses Braille pulse animation with Solvys Gold accent.
//   Respects prefers-reduced-motion; reduced motion renders a static gold dot.
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";

interface SolvysLoaderProps {
  /** Text rendered beneath the glyph. Omit for inline-only use. */
  text?: string;
  /** Glyph size in px. Default 14. */
  size?: number;
  /** Override color. Defaults to var(--fintheon-accent). */
  color?: string;
  className?: string;
  style?: CSSProperties;
}

const MONO_STACK =
  "ui-monospace, 'SF Mono', Menlo, Monaco, 'Cascadia Code', 'Roboto Mono', monospace";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
  );
}

// Braille dot frames: a single cell that pulses through density states.
const BRAILLE_BEAT_FRAMES = ["⠀", "⠁", "⠃", "⠇", "⠏", "⠟", "⠿", "⠟", "⠏", "⠇", "⠃", "⠁"];

export function SolvysLoader({
  text,
  size = 14,
  color,
  className,
  style,
}: SolvysLoaderProps) {
  const [frameIdx, setFrameIdx] = useState(0);
  const reduced = useRef(prefersReducedMotion());

  useEffect(() => {
    if (reduced.current) return;
    const id = window.setInterval(() => {
      setFrameIdx((i) => (i + 1) % BRAILLE_BEAT_FRAMES.length);
    }, 90);
    return () => window.clearInterval(id);
  }, []);

  const glyph = reduced.current ? "●" : BRAILLE_BEAT_FRAMES[frameIdx];
  const resolvedColor = color ?? "var(--fintheon-accent)";

  const glyphStyle: CSSProperties = {
    fontFamily: MONO_STACK,
    fontSize: size,
    fontVariantNumeric: "tabular-nums",
    color: resolvedColor,
    lineHeight: 1,
    letterSpacing: 0,
    whiteSpace: "pre",
    display: "inline-block",
    width: size * 1.4,
    textAlign: "center",
  };

  return (
    <div
      className={`inline-flex items-center gap-2${className ? ` ${className}` : ""}`}
      style={style}
    >
      <span style={glyphStyle} aria-hidden="true">
        {glyph}
      </span>
      {text && (
        <span
          className="text-[10px] tracking-[0.18em] uppercase"
          style={{ color: "var(--fintheon-muted)" }}
        >
          {text}
        </span>
      )}
    </div>
  );
}

/** Full-center variant for page / panel loading states. */
export function SolvysLoaderCentered({
  text = "Loading…",
  size = 18,
  color,
  className,
  style,
}: SolvysLoaderProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 py-12${className ? ` ${className}` : ""}`}
      style={style}
    >
      <SolvysLoader size={size} color={color} />
      {text && (
        <span
          className="text-[11px] tracking-[0.18em] uppercase"
          style={{ color: "var(--fintheon-muted)" }}
        >
          {text}
        </span>
      )}
    </div>
  );
}
