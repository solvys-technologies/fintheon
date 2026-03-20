import { useEffect, useRef } from 'react';

interface WaveformCanvasProps {
  analyser: AnalyserNode;
  tiltMode: boolean;
}

export function WaveformCanvas({ analyser, tiltMode }: WaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      
      analyser.getByteFrequencyData(dataArray);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;

        if (tiltMode) {
          const chaos = Math.random() * 20 - 10;
          ctx.fillStyle = `rgba(239, 68, 68, ${0.5 + dataArray[i] / 510})`;
          ctx.fillRect(x, canvas.height - barHeight + chaos, barWidth, barHeight);
        } else {
          ctx.fillStyle = `rgba(255, 192, 56, ${0.5 + dataArray[i] / 510})`;
          ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        }

        x += barWidth + 1;
      }
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [analyser, tiltMode]);

  return (
    <canvas
      ref={canvasRef}
      width={300}
      height={96}
      className="w-full h-full"
    />
  );
}
