// [claude-code 2026-04-26] Fixed height + vertical-center alignment so the
//   fuse no longer morphs card-to-card based on headline line count. Per TP:
//   "fuses look stupid... should be the same size. Just center it" + horizontal
//   positioning stays left. Outer wrapper now picks a constant 56px height
//   and self-centers; segments still flex 1:1 so the bar reads uniform.
// [claude-code 2026-04-25] S42-T8: Nothing-design pass — slow per-segment transition
//   from 150ms to 220ms ease-out and bump the staggered delay from 18ms to 32ms per
//   segment for a more deliberate fill (~320ms total bottom-up). No glow, no shadow,
//   no shimmer — segments are flat blocks against the empty-track border colour. The
//   320ms total still slots cleanly inside the existing 220ms drain choreography.
// [claude-code 2026-04-20] `animateIn` — when true, the fuse mounts empty and
//   fills bottom-up, one segment at a time, so new scored items arriving at
//   the top of the feed visibly "charge up". Staggered delays mirror the
//   existing drain choreography (just reversed direction).
// [claude-code 2026-04-18] Drop the .nothing-fuse-shimmer overlay per TP — too brief on
//   mobile to register, and it competed visually with the drain choreography. Outer
//   wrapper kept (position:relative) in case future overlays need it.
//   Color contract unchanged — caller still passes a resolved CSS color from
//   colorForSeverity / colorForScore (palette adoption lives at the call site).
// [claude-code 2026-04-19] S26-P2 T10: `draining` prop — when true, the segments
//   fade back to the empty-track color bottom-to-top over ~220ms so the card's fuse
//   visibly empties before the full-viewport modal opens. The modal's horizontal
//   IVFuseBar then fills from 0 to the real level, which reads like the juice flowing
//   from the card into the modal footer. Sequence is orchestrated by RiskFlowCard —
//   we just honor the draining flag here.
// [claude-code 2026-04-15] Nothing-styled vertical fuse bar — discrete blocks filling bottom-up, IV 0-10 scale
import { useEffect, useState } from "react";

interface VerticalFuseBarProps {
  value: number; // 0-10
  color: string; // CSS color (already resolved through fuse-palette by the caller)
  segments?: number;
  /** When true, renders zero filled segments so the fuse appears to drain. Pair with
   *  a 150-220ms delay before navigating away for a clean drain/fill choreography. */
  draining?: boolean;
  /** When true, the fuse mounts empty and animates to `value` bottom-up. */
  animateIn?: boolean;
}

const SEGMENT_COUNT = 10;
const GAP = 2;

export function VerticalFuseBar({
  value,
  color,
  segments = SEGMENT_COUNT,
  draining = false,
  animateIn = false,
}: VerticalFuseBarProps) {
  // Mount-charge state: when animateIn=true, start filled=0 then flip to target
  // on the next frame so CSS transitions animate each segment bottom-up.
  const [charged, setCharged] = useState(!animateIn);
  useEffect(() => {
    if (!animateIn || charged) return;
    const raf = requestAnimationFrame(() => setCharged(true));
    return () => cancelAnimationFrame(raf);
  }, [animateIn, charged]);
  const targetFilled = Math.round((value / 10) * segments);
  const filled = draining || !charged ? 0 : targetFilled;

  return (
    <div
      style={{
        position: "relative",
        width: 4,
        height: 56,
        alignSelf: "center",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column-reverse",
          gap: GAP,
          width: "100%",
          height: "100%",
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
              // Drain reads top-down (i=9 first, i=0 last), mount-fill reads
              // bottom-up (i=0 first, i=9 last). 32ms per segment × 10 = 320ms
              // — deliberate Nothing-design pacing.
              transitionDelay: draining
                ? `${(segments - 1 - i) * 32}ms`
                : animateIn
                  ? `${i * 32}ms`
                  : "0ms",
              transition: "background 220ms ease-out",
              boxShadow: "none",
            }}
          />
        ))}
      </div>
    </div>
  );
}
