// [claude-code 2026-04-15] T8: Nothing-style loading spinner — 4 blocks, sequential clockwise fill
import { useState, useEffect } from "react";

const BLOCKS = [0, 1, 3, 2]; // clockwise: TL, TR, BR, BL (index in 2x2 grid)
const STEP_MS = 150;

export function SegmentedSpinner({
  size = 8,
  gap = 2,
}: {
  size?: number;
  gap?: number;
}) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setStep((s) => (s + 1) % 4), STEP_MS);
    return () => clearInterval(id);
  }, []);

  const active = BLOCKS[step];

  return (
    <div
      role="status"
      aria-label="Loading"
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
            background: i === active ? "var(--text-display)" : "var(--border)",
            transition: "background 80ms ease-out",
          }}
        />
      ))}
    </div>
  );
}
