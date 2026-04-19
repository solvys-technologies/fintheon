// [claude-code 2026-04-19] S26-P2 T10: `draining` prop — when true, the segments
//   fade back to the empty-track color bottom-to-top over ~220ms so the card's fuse
//   visibly empties before the full-viewport modal opens. The modal's horizontal
//   IVFuseBar then fills from 0 to the real level, which reads like the juice flowing
//   from the card into the modal footer. Sequence is orchestrated by RiskFlowCard —
//   we just honor the draining flag here.
// [claude-code 2026-04-15] Nothing-styled vertical fuse bar — discrete blocks filling bottom-up, IV 0-10 scale

interface VerticalFuseBarProps {
  value: number; // 0-10
  color: string; // CSS color
  segments?: number;
  /** When true, renders zero filled segments so the fuse appears to drain. Pair with
   *  a 150-220ms delay before navigating away for a clean drain/fill choreography. */
  draining?: boolean;
}

const SEGMENT_COUNT = 10;
const GAP = 2;

export function VerticalFuseBar({
  value,
  color,
  segments = SEGMENT_COUNT,
  draining = false,
}: VerticalFuseBarProps) {
  const filled = draining ? 0 : Math.round((value / 10) * segments);

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
            // Stagger the drain top-down (i=9 first, i=0 last) so it reads as juice
            // flowing out of the card, not a simple fade. 18ms per segment × 10 = 180ms.
            transitionDelay: draining ? `${(segments - 1 - i) * 18}ms` : "0ms",
            transition: "background 150ms ease-out",
          }}
        />
      ))}
    </div>
  );
}
