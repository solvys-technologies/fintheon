// [claude-code 2026-05-19] SOL-71: added isLockedOut prop; fixed tilt/lockout colors to Solvys palette.
import { useEffect, useRef } from "react";

interface WaveformCanvasProps {
  analyser: AnalyserNode;
  tiltMode: boolean;
  isLockedOut?: boolean;
}

// Solvys Gold: #c79f4a — used for normal and tilt waveform
const COLOR_NORMAL = "rgba(199, 159, 74,"; // Solvys Gold, alpha appended below
const COLOR_TILT = "rgba(199, 159, 74,"; // same hue, chaos shape distinguishes tilt
const COLOR_LOCKOUT = "rgba(199, 159, 74,"; // dimmed for lockout state

export function WaveformCanvas({
  analyser,
  tiltMode,
  isLockedOut = false,
}: WaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const frameRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      frameRef.current += 1;

      analyser.getByteFrequencyData(dataArray);

      ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let x = 0;

      if (isLockedOut) {
        // Lockout: slow flat pulse — gold, very low amplitude, frame-paced
        const pulse = 0.15 + Math.sin(frameRef.current * 0.04) * 0.1;
        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (dataArray[i] / 255) * canvas.height * 0.25;
          ctx.fillStyle = `${COLOR_LOCKOUT} ${pulse})`;
          ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
          x += barWidth + 1;
        }
      } else if (tiltMode) {
        // Tilt: full energy, gold, chaotic vertical offset
        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (dataArray[i] / 255) * canvas.height;
          const chaos = Math.random() * 16 - 8;
          ctx.fillStyle = `${COLOR_TILT} ${0.45 + dataArray[i] / 510})`;
          ctx.fillRect(
            x,
            canvas.height - barHeight + chaos,
            barWidth,
            barHeight,
          );
          x += barWidth + 1;
        }
      } else {
        // Normal: clean gold bars
        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (dataArray[i] / 255) * canvas.height;
          ctx.fillStyle = `${COLOR_NORMAL} ${0.5 + dataArray[i] / 510})`;
          ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
          x += barWidth + 1;
        }
      }
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [analyser, tiltMode, isLockedOut]);

  return (
    <canvas ref={canvasRef} width={300} height={96} className="w-full h-full" />
  );
}
