// [claude-code 2026-05-16] S67: VoiceBorderGlow — soft viewport-border glow overlay
// replacing VoiceModePixelOverlay with pure CSS radial gradients. No canvas, no pixel cells.
import { useEffect, useRef } from "react";

interface VoiceBorderGlowProps {
  active: boolean;
}

export function VoiceBorderGlow({ active }: VoiceBorderGlowProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active || !containerRef.current) return;

    const el = containerRef.current;
    const style = el.style;
    let frame: number;

    const animate = () => {
      const t = Date.now() / 2000;
      const pulse = 0.08 + 0.04 * Math.sin(t * Math.PI);
      const accent = "var(--fintheon-accent, #c79f4a)";

      style.background = [
        `radial-gradient(circle at 0% 0%, color-mix(in srgb, ${accent} ${pulse * 100}%, transparent) 0%, transparent 50%)`,
        `radial-gradient(circle at 100% 0%, color-mix(in srgb, ${accent} ${pulse * 100}%, transparent) 0%, transparent 50%)`,
        `radial-gradient(circle at 0% 100%, color-mix(in srgb, ${accent} ${pulse * 100}%, transparent) 0%, transparent 50%)`,
        `radial-gradient(circle at 100% 100%, color-mix(in srgb, ${accent} ${pulse * 100}%, transparent) 0%, transparent 50%)`,
        `radial-gradient(circle at 50% 0%, color-mix(in srgb, ${accent} ${pulse * 60}%, transparent) 0%, transparent 60%)`,
        `radial-gradient(circle at 50% 100%, color-mix(in srgb, ${accent} ${pulse * 60}%, transparent) 0%, transparent 60%)`,
        `radial-gradient(circle at 0% 50%, color-mix(in srgb, ${accent} ${pulse * 60}%, transparent) 0%, transparent 60%)`,
        `radial-gradient(circle at 100% 50%, color-mix(in srgb, ${accent} ${pulse * 60}%, transparent) 0%, transparent 60%)`,
      ].join(", ");

      frame = requestAnimationFrame(animate);
    };

    animate();
    return () => {
      if (frame) cancelAnimationFrame(frame);
    };
  }, [active]);

  if (!active) return null;

  return (
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 9997,
        opacity: 1,
      }}
    />
  );
}
