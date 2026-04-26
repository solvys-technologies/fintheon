// [claude-code 2026-04-25] Shared digit-group wrapper for the solvys-transitions number pop-in.
//   Splits a string into <span class="t-digit"> children inside a re-keyed
//   .t-digit-group.is-animating wrapper so the value cascades in left-to-right
//   on first render and on every subsequent value change. Stagger is applied to
//   the trailing digits so the most-significant character lands first.
import type { CSSProperties, ReactNode } from "react";

interface DigitGroupProps {
  /** The numeric / textual value to render. Each character becomes one <span>. */
  value: string;
  /** Inline style passed through to the wrapping <span>. */
  style?: CSSProperties;
  className?: string;
  /** Optional trailing render slot (e.g. a "%" label that should NOT animate). */
  suffix?: ReactNode;
}

export function DigitGroup({
  value,
  style,
  className,
  suffix,
}: DigitGroupProps) {
  const chars = value.split("");
  const len = chars.length;
  return (
    <span
      key={value}
      className={`t-digit-group is-animating${className ? ` ${className}` : ""}`}
      style={style}
    >
      {chars.map((ch, i) => {
        // Stagger only the trailing 1-2 digits so the leftmost (most significant)
        // appears first and the value reads left-to-right.
        const fromEnd = len - 1 - i;
        const stagger = fromEnd === 1 ? "1" : fromEnd === 0 ? "2" : undefined;
        return (
          <span key={i} className="t-digit" data-stagger={stagger}>
            {ch}
          </span>
        );
      })}
      {suffix}
    </span>
  );
}
