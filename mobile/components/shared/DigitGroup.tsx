// [claude-code 2026-05-16] Ported from desktop DigitGroup for mobile arbitrum alignment.
import type { CSSProperties, ReactNode } from "react";

interface DigitGroupProps {
  value: string;
  style?: CSSProperties;
  className?: string;
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
