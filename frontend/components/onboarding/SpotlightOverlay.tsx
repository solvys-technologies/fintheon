// [claude-code 2026-03-16] Spotlight tour overlay — SVG mask cutout with smooth transitions
import { useState, useEffect, useCallback, type ReactNode } from "react";

interface SpotlightOverlayProps {
  targetSelector: string;
  visible: boolean;
  padding?: number;
  onClose?: () => void;
  children: ReactNode;
}

interface TargetRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const DEFAULT_PADDING = 16;
const BORDER_RADIUS = 12;

function getCenterFallback(): TargetRect {
  return {
    x: window.innerWidth / 2 - 120,
    y: window.innerHeight / 2 - 60,
    width: 240,
    height: 120,
  };
}

export function SpotlightOverlay({
  targetSelector,
  visible,
  padding = DEFAULT_PADDING,
  onClose,
  children,
}: SpotlightOverlayProps) {
  const [rect, setRect] = useState<TargetRect>(getCenterFallback);
  const [opacity, setOpacity] = useState(0);

  const measure = useCallback(() => {
    const el = document.querySelector(targetSelector);
    if (el) {
      const r = el.getBoundingClientRect();
      setRect({
        x: r.x - padding,
        y: r.y - padding,
        width: r.width + padding * 2,
        height: r.height + padding * 2,
      });
    } else {
      setRect(getCenterFallback());
    }
  }, [targetSelector, padding]);

  // Measure on mount and when targetSelector changes
  useEffect(() => {
    if (!visible) return;
    // Small delay to let tab navigation settle
    const timer = setTimeout(measure, 100);
    return () => clearTimeout(timer);
  }, [visible, measure]);

  // ResizeObserver for layout changes
  useEffect(() => {
    if (!visible) return;
    const observer = new ResizeObserver(measure);
    observer.observe(document.body);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [visible, measure]);

  // Fade in/out
  useEffect(() => {
    if (visible) {
      requestAnimationFrame(() => setOpacity(1));
    } else {
      setOpacity(0);
    }
  }, [visible]);

  if (!visible && opacity === 0) return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  return (
    <div
      className="fixed inset-0 z-[9998]"
      style={{ opacity, transition: "opacity 300ms ease-in-out" }}
    >
      {/* SVG overlay with mask cutout */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox={`0 0 ${vw} ${vh}`}
        preserveAspectRatio="none"
      >
        <defs>
          <mask id="spotlight-mask">
            <rect x="0" y="0" width={vw} height={vh} fill="white" />
            <rect
              x={rect.x}
              y={rect.y}
              width={rect.width}
              height={rect.height}
              rx={BORDER_RADIUS}
              ry={BORDER_RADIUS}
              fill="black"
              style={{ transition: "all 300ms ease-in-out" }}
            />
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width={vw}
          height={vh}
          fill="rgba(0,0,0,0.70)"
          mask="url(#spotlight-mask)"
        />
      </svg>

      {/* Click-through blocker outside spotlight */}
      <div
        className="absolute inset-0"
        onClick={(e) => {
          // Only close if clicking outside the spotlight area
          const mx = e.clientX;
          const my = e.clientY;
          if (
            mx < rect.x ||
            mx > rect.x + rect.width ||
            my < rect.y ||
            my > rect.y + rect.height
          ) {
            onClose?.();
          }
        }}
      />

      {/* Children (tooltip) positioned relative to spotlight */}
      {children}
    </div>
  );
}

export type { TargetRect };
