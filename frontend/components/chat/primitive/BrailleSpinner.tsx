import type { CSSProperties } from "react";

interface BrailleSpinnerProps {
  size?: number;
  color?: string;
  label?: string;
  className?: string;
}

export function BrailleSpinner({
  size = 14,
  color = "var(--fintheon-accent)",
  label,
  className,
}: BrailleSpinnerProps) {
  const style: CSSProperties = {
    width: size,
    height: size,
    borderRadius: "9999px",
    border: `2px solid ${color}33`,
    borderTopColor: color,
    animation: "spin 0.8s linear infinite",
  };

  return (
    <span
      className={className}
      style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
      aria-label={label ?? "Loading"}
    >
      <span style={style} />
      {label ? <span style={{ fontSize: 11 }}>{label}</span> : null}
    </span>
  );
}

export function BrailleSpinnerCentered({
  size = 14,
  color,
  label,
}: BrailleSpinnerProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "12px 0",
      }}
    >
      <BrailleSpinner size={size} color={color} label={label} />
    </div>
  );
}
