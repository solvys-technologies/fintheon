// [codex 2026-05-23] SolvysLoader now routes through dot/matrix only.
import type { CSSProperties } from "react";
import { DotMatrixLoader } from "../icon-bank/DotMatrixLoader";

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

export function SolvysLoader({
  text,
  size = 14,
  color,
  className,
  style,
}: SolvysLoaderProps) {
  return (
    <DotMatrixLoader
      variant="diagonal-scan"
      size={size}
      color={color ?? "var(--fintheon-accent)"}
      label={text}
      className={className}
      style={style}
    />
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
