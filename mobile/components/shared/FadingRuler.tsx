// [claude-code 2026-05-16] Ported from desktop FadingRuler for mobile arbitrum alignment.
import type { CSSProperties } from "react";

interface FadingRulerProps {
  orientation?: "horizontal" | "vertical";
  className?: string;
  style?: CSSProperties;
}

export function FadingRuler({
  orientation = "horizontal",
  className,
  style,
}: FadingRulerProps) {
  const cls =
    orientation === "vertical"
      ? "fading-ruler fading-ruler--vertical"
      : "fading-ruler";
  return (
    <span
      role="separator"
      aria-orientation={orientation}
      className={className ? `${cls} ${className}` : cls}
      style={style}
    />
  );
}
