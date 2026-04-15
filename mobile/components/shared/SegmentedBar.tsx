// [claude-code 2026-04-15] T4: Segmented progress bar — Nothing signature discrete blocks

interface SegmentedBarProps {
  value: number; // 0-100
  segments?: number;
  color?: string;
  size?: "hero" | "standard" | "compact";
}

const HEIGHTS = { hero: 16, standard: 8, compact: 4 } as const;

export function SegmentedBar({
  value,
  segments = 10,
  color = "var(--text-display)",
  size = "standard",
}: SegmentedBarProps) {
  const filled = Math.round(
    (Math.min(100, Math.max(0, value)) / 100) * segments,
  );

  return (
    <div
      style={{ display: "flex", gap: 2, width: "100%", height: HEIGHTS[size] }}
    >
      {Array.from({ length: segments }, (_, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: "100%",
            backgroundColor: i < filled ? color : "var(--border)",
          }}
        />
      ))}
    </div>
  );
}
