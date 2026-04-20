// [claude-code 2026-04-20] S21-T3: White agent-speaking waveform.
// Replaces the user's aurora orb when the agent is talking. Isometric feel
// via skewed columns + per-column phase offset. Amplitude driven by the
// `amplitudes` prop (0..1 samples); absent, it runs a low-amplitude ambient
// breathing pattern so the UI never looks frozen.
import { useEffect, useRef } from "react";

interface WhiteWaveformProps {
  amplitudes?: number[]; // 0..1 samples; newest last
  active?: boolean;
  width?: number;
  height?: number;
  barCount?: number;
  className?: string;
}

export function WhiteWaveform({
  amplitudes,
  active = true,
  width = 96,
  height = 36,
  barCount = 24,
  className = "",
}: WhiteWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const phaseRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const draw = () => {
      phaseRef.current += active ? 0.09 : 0.03;
      ctx.clearRect(0, 0, width, height);

      const gap = 2;
      const totalGap = gap * (barCount - 1);
      const barWidth = Math.max(1, (width - totalGap) / barCount);
      const centerY = height / 2;

      for (let i = 0; i < barCount; i++) {
        const tail = amplitudes?.slice(-barCount) ?? [];
        const sample = tail[i];
        const ambient =
          0.08 + Math.abs(Math.sin(phaseRef.current + i * 0.35)) * 0.1;
        const value =
          typeof sample === "number"
            ? Math.max(0.05, Math.min(1, sample))
            : ambient;

        const barHeight = Math.max(2, value * (height - 4));
        const x = i * (barWidth + gap);
        const y = centerY - barHeight / 2;

        // Isometric tilt: slight x-shear as we move right.
        ctx.save();
        ctx.transform(1, 0, -0.18, 1, i * 0.4, 0);
        ctx.fillStyle = `rgba(255,255,255,${active ? 0.92 : 0.45})`;
        ctx.beginPath();
        const r = Math.min(1.5, barWidth / 2);
        roundRect(ctx, x, y, barWidth, barHeight, r);
        ctx.fill();
        ctx.restore();
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [amplitudes, active, width, height, barCount]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height, display: "block" }}
      className={className}
      aria-hidden
    />
  );
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
}
