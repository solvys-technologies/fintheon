// [claude-code 2026-04-25] S42-T8: Nothing-design pass — stripped the HelixVertical
//   Braille glyph (read as decorative AI shimmer at small sizes) and replaced with a
//   horizontal indeterminate fuse: a 3-segment cluster slides left-to-right on a
//   surface track at 1500ms via WAAPI. Same segmented language as NothingFuse but
//   un-anchored from a value. No glow, no gradient, no AI sparkle.
import { useEffect, useRef } from "react";
import { cn } from "../../lib/utils";

interface AiLoaderProps {
  text?: string;
  size?: number;
  className?: string;
}

const CLUSTER_PERIOD_MS = 1500;
const CLUSTER_SEGMENTS = 3;
const TRACK_SEGMENTS = 10;

export function AiLoader({
  text = "Thinking...",
  size = 40,
  className,
}: AiLoaderProps) {
  const clusterRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = clusterRef.current;
    if (!node) return;
    const reduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced) return;
    // Slide the 3-segment cluster from off-track-left to off-track-right and
    // loop. translate is in % of the track width.
    const animation = node.animate(
      [{ transform: "translateX(-30%)" }, { transform: "translateX(100%)" }],
      {
        duration: CLUSTER_PERIOD_MS,
        iterations: Infinity,
        easing: "cubic-bezier(0.45, 0, 0.55, 1)",
      },
    );
    return () => animation.cancel();
  }, []);

  // Track width scales with size; height stays 3px (matches NothingFuse default thickness).
  const trackWidth = Math.max(80, size * 2);
  const segGapPct = 100 / TRACK_SEGMENTS;
  const clusterWidthPct = segGapPct * CLUSTER_SEGMENTS;

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <div
        role="status"
        aria-label={text}
        style={{
          width: trackWidth,
          height: 3,
          position: "relative",
          background: "var(--fintheon-surface)",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        {/* Tick dividers cut the track into TRACK_SEGMENTS for the segmented look */}
        {Array.from({ length: TRACK_SEGMENTS - 1 }, (_, i) => (
          <span
            key={i}
            aria-hidden
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: `${((i + 1) / TRACK_SEGMENTS) * 100}%`,
              width: 1,
              background: "var(--fintheon-bg, #050402)",
              pointerEvents: "none",
              zIndex: 2,
            }}
          />
        ))}
        <div
          ref={clusterRef}
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            width: `${clusterWidthPct}%`,
            background: "var(--fintheon-accent, #c79f4a)",
            borderRadius: 2,
            zIndex: 1,
          }}
        />
      </div>
      {text && (
        <span
          className="text-[11px] tracking-[0.2em] uppercase"
          style={{ color: "var(--fintheon-accent)" }}
        >
          {text}
        </span>
      )}
    </div>
  );
}
