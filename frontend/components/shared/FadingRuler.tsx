// [claude-code 2026-04-26] S45-T2: FadingRuler primitive — the ONLY divider used
//   on new S45 surfaces. Replaces every place a glass-surface border would have
//   lived. Two orientations + an optional className passthrough.
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
