// [claude-code 2026-04-15] Nothing-styled vertical fuse bar — discrete blocks filling bottom-up, IV 0-10 scale

interface VerticalFuseBarProps {
  value: number; // 0-10
  color: string; // CSS color
  segments?: number;
}

const SEGMENT_COUNT = 10;
const GAP = 2;

export function VerticalFuseBar({
  value,
  color,
  segments = SEGMENT_COUNT,
}: VerticalFuseBarProps) {
  const filled = Math.round((value / 10) * segments);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column-reverse",
        gap: GAP,
        width: 4,
        alignSelf: "stretch",
        flexShrink: 0,
      }}
    >
      {Array.from({ length: segments }, (_, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            minHeight: 2,
            borderRadius: 1,
            background: i < filled ? color : "var(--border)",
            transition: "background 150ms ease-out",
          }}
        />
      ))}
    </div>
  );
}
