// [claude-code 2026-04-25] S35: Arbitrum dropdown glyph — stacked +/- in Nothing Display font.
// Replaces the lucide Fish icon (Arbitrum != Aquarium-the-aquatic-thing; the surface label
// stayed but the dropdown icon needs to read as "deliberation / weighing both sides").
//
// Renders a tight 2-row glyph: "+" on top, "−" on bottom, sized to lucide's icon convention.
// `size` matches lucide's prop (default 14px in the Sanctum dropdown). Accepts the standard
// LucideIcon-shaped props so it can be a drop-in replacement at the call sites that still
// type their icons as `typeof GitBranch`.

import type { CSSProperties } from "react";

interface Props {
  size?: number;
  className?: string;
  style?: CSSProperties;
  color?: string;
}

export function ArbitrumGlyph({ size = 14, className, style, color }: Props) {
  // Glyph height is the size; width is slightly narrower because the chars are vertical-stack.
  // Using line-height:1 + tight letter-spacing keeps the stack visually centered with the
  // adjacent label text in dropdowns.
  return (
    <span
      aria-hidden="true"
      className={className}
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        lineHeight: 1,
        fontFamily: "var(--font-display)",
        fontWeight: 500,
        color: color ?? "currentColor",
        ...style,
      }}
    >
      <span style={{ fontSize: size * 0.72, lineHeight: 0.85 }}>+</span>
      <span style={{ fontSize: size * 0.72, lineHeight: 0.85 }}>−</span>
    </span>
  );
}
