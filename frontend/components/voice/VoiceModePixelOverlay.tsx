// [claude-code 2026-04-26] Removed the corner-to-circle-to-corner mask sweep
// and the deterministic-flicker loop per TP: "whatever that shit is that
// swirls all over the screen needs to come out." Replaced with a simple
// fade-in to a static pixelated dim and a fade-out on deactivation.
// Pixel grid is identical (8px cells, deterministic on/off, accent color);
// only the animation behavior changed.
// [claude-code 2026-04-25] S38: Viewport pixel sweep overlay for voice-mode activation.
import { useEffect, useRef } from "react";

interface VoiceModePixelOverlayProps {
  active: boolean;
}

function cellOn(col: number, row: number): boolean {
  const h = (col * 73856093) ^ (row * 19349663);
  return (h >>> 0) % 7 < 3;
}

const CELL_PX = 8;
const FADE_IN_MS = 320;
const FADE_OUT_MS = 220;
const ACTIVE_OPACITY = 0.34;

export function VoiceModePixelOverlay({ active }: VoiceModePixelOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const accent =
      getComputedStyle(document.documentElement)
        .getPropertyValue("--accent-primary")
        .trim() || "#c79f4a";
    ctx.fillStyle = accent;

    const cols = Math.ceil(w / CELL_PX);
    const rows = Math.ceil(h / CELL_PX);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (cellOn(c, r)) {
          ctx.fillRect(c * CELL_PX, r * CELL_PX, CELL_PX - 1, CELL_PX - 1);
        }
      }
    }
  }, []);

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;

    const start = parseFloat(overlay.style.opacity || "0");
    const target = active ? ACTIVE_OPACITY : 0;
    overlay.animate([{ opacity: start }, { opacity: target }], {
      duration: active ? FADE_IN_MS : FADE_OUT_MS,
      easing: "cubic-bezier(0.4, 0, 0.2, 1)",
      fill: "forwards",
    });
  }, [active]);

  return (
    <div
      ref={overlayRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 9998,
        opacity: 0,
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
        }}
      />
    </div>
  );
}
