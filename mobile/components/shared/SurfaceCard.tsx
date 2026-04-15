// [claude-code 2026-04-15] T4: Surface card wrapper — Nothing-style flat card with optional accent border
import type { ReactNode, CSSProperties } from "react";

interface SurfaceCardProps {
  children: ReactNode;
  accentBorder?: "left" | "top";
  className?: string;
  noPadding?: boolean;
  style?: CSSProperties;
  onClick?: () => void;
}

export function SurfaceCard({
  children,
  accentBorder,
  className = "",
  noPadding = false,
  style,
  onClick,
}: SurfaceCardProps) {
  const accent: CSSProperties =
    accentBorder === "left"
      ? { borderLeft: "2px solid var(--accent)" }
      : accentBorder === "top"
        ? { borderTop: "2px solid var(--accent)" }
        : {};

  return (
    <div
      className={`bg-[var(--surface)] border border-[var(--border)] ${className}`}
      style={{
        borderRadius: 12,
        padding: noPadding ? 0 : 16,
        ...accent,
        ...style,
      }}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
