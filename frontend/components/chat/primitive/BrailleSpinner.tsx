import { useState, useEffect } from "react";

interface BrailleSpinnerProps {
  size?: number;
  gap?: number;
  color?: string;
  label?: string;
  className?: string;
}

const CLOCKWISE = [0, 1, 3, 2];

export function BrailleSpinner({
  size = 8,
  gap = 2,
  label,
  className,
}: BrailleSpinnerProps) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setStep((s) => (s + 1) % 4), 150);
    return () => clearInterval(id);
  }, []);

  const active = CLOCKWISE[step];

  return (
    <span
      className={className}
      style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
      aria-label={label ?? "Loading"}
    >
      <div
        role="status"
        style={{
          display: "grid",
          gridTemplateColumns: `${size}px ${size}px`,
          gap,
        }}
      >
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              width: size,
              height: size,
              background:
                i === active
                  ? "var(--fintheon-accent)"
                  : "rgba(199,159,74,0.15)",
            }}
          />
        ))}
      </div>
      {label ? <span style={{ fontSize: 11 }}>{label}</span> : null}
    </span>
  );
}

export function BrailleSpinnerCentered({
  size = 8,
  gap = 2,
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
      <BrailleSpinner size={size} gap={gap} color={color} label={label} />
    </div>
  );
}
