// [claude-code 2026-04-25] S38: Viewport pixel sweep overlay for voice-mode activation.
// Corner-to-circle-to-corner WAAPI animation, then deterministic corner flicker while active.
import { useEffect, useRef } from "react";

interface VoiceModePixelOverlayProps {
  active: boolean;
}

// Deterministic 8x8 cell pattern — stable hash of grid coords decides on/off.
// No randomness at runtime; same pattern every activation.
function cellOn(col: number, row: number): boolean {
  const h = (col * 73856093) ^ (row * 19349663);
  return (h >>> 0) % 7 < 3;
}

const CELL_PX = 8;
const CORNER_RADIUS_PCT = 18;
const CIRCLE_RADIUS_PCT = 60;
const SWEEP_IN_MS = 450;
const HOLD_MS = 150;
const SWEEP_OUT_MS = 450;

// Deterministic flicker schedule — pre-computed on/off frames at ~500ms cadence.
const FLICKER_SCHEDULE_MS = [
  0, 520, 980, 1480, 2020, 2540, 3060, 3540, 4080, 4600,
];
const FLICKER_OPACITIES = [
  0.42, 0.34, 0.46, 0.38, 0.44, 0.36, 0.48, 0.4, 0.42, 0.36,
];

export function VoiceModePixelOverlay({ active }: VoiceModePixelOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const flickerTimerRef = useRef<number | null>(null);
  const flickerIndexRef = useRef(0);

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

    if (active) {
      const cornerMask = `radial-gradient(circle at 0% 0%, black ${CORNER_RADIUS_PCT}%, transparent ${CORNER_RADIUS_PCT + 4}%), radial-gradient(circle at 100% 0%, black ${CORNER_RADIUS_PCT}%, transparent ${CORNER_RADIUS_PCT + 4}%), radial-gradient(circle at 0% 100%, black ${CORNER_RADIUS_PCT}%, transparent ${CORNER_RADIUS_PCT + 4}%), radial-gradient(circle at 100% 100%, black ${CORNER_RADIUS_PCT}%, transparent ${CORNER_RADIUS_PCT + 4}%)`;
      const circleMask = `radial-gradient(circle at 50% 50%, black ${CIRCLE_RADIUS_PCT}%, transparent ${CIRCLE_RADIUS_PCT + 4}%), radial-gradient(circle at 50% 50%, black ${CIRCLE_RADIUS_PCT}%, transparent ${CIRCLE_RADIUS_PCT + 4}%), radial-gradient(circle at 50% 50%, black ${CIRCLE_RADIUS_PCT}%, transparent ${CIRCLE_RADIUS_PCT + 4}%), radial-gradient(circle at 50% 50%, black ${CIRCLE_RADIUS_PCT}%, transparent ${CIRCLE_RADIUS_PCT + 4}%)`;

      const sweep = overlay.animate(
        [
          {
            opacity: 0,
            webkitMaskImage: cornerMask,
            maskImage: cornerMask,
          } as Keyframe,
          {
            opacity: 0.55,
            webkitMaskImage: circleMask,
            maskImage: circleMask,
            offset: SWEEP_IN_MS / (SWEEP_IN_MS + HOLD_MS + SWEEP_OUT_MS),
          } as Keyframe,
          {
            opacity: 0.55,
            webkitMaskImage: circleMask,
            maskImage: circleMask,
            offset:
              (SWEEP_IN_MS + HOLD_MS) / (SWEEP_IN_MS + HOLD_MS + SWEEP_OUT_MS),
          } as Keyframe,
          {
            opacity: 0,
            webkitMaskImage: cornerMask,
            maskImage: cornerMask,
          } as Keyframe,
        ],
        {
          duration: SWEEP_IN_MS + HOLD_MS + SWEEP_OUT_MS,
          easing: "cubic-bezier(0.16, 1, 0.3, 1)",
          fill: "forwards",
        },
      );

      const startFlicker = () => {
        overlay.style.maskImage = cornerMask;
        (
          overlay.style as CSSStyleDeclaration & { webkitMaskImage?: string }
        ).webkitMaskImage = cornerMask;
        flickerIndexRef.current = 0;
        const tick = () => {
          if (!overlayRef.current) return;
          const idx = flickerIndexRef.current % FLICKER_OPACITIES.length;
          overlayRef.current.style.opacity = String(FLICKER_OPACITIES[idx]);
          flickerIndexRef.current += 1;
          const next =
            FLICKER_SCHEDULE_MS[
              flickerIndexRef.current % FLICKER_SCHEDULE_MS.length
            ];
          const cur = FLICKER_SCHEDULE_MS[idx];
          const delay = next > cur ? next - cur : 520;
          flickerTimerRef.current = window.setTimeout(tick, delay);
        };
        tick();
      };

      sweep.onfinish = () => {
        startFlicker();
      };

      return () => {
        sweep.cancel();
        if (flickerTimerRef.current !== null) {
          clearTimeout(flickerTimerRef.current);
          flickerTimerRef.current = null;
        }
      };
    } else {
      if (flickerTimerRef.current !== null) {
        clearTimeout(flickerTimerRef.current);
        flickerTimerRef.current = null;
      }
      overlay.animate(
        [{ opacity: parseFloat(overlay.style.opacity || "0") }, { opacity: 0 }],
        {
          duration: 220,
          easing: "cubic-bezier(0.4, 0, 0.2, 1)",
          fill: "forwards",
        },
      );
    }
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
