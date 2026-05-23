// [codex 2026-05-23] Arbitrum now shares Consilium's bank/courthouse icon.

import type { CSSProperties } from "react";
import { EXACT_ICON_BODIES } from "../icon-bank/iconifyBodies";

interface Props {
  size?: number;
  className?: string;
  style?: CSSProperties;
  color?: string;
}

export function ArbitrumGlyph({ size = 14, className, style, color }: Props) {
  const glyph = EXACT_ICON_BODIES["building-bank"];
  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${glyph.width} ${glyph.height}`}
      width={size}
      height={size}
      className={className}
      style={{
        color: color ?? "currentColor",
        flexShrink: 0,
        ...style,
      }}
      dangerouslySetInnerHTML={{ __html: glyph.body }}
    />
  );
}
