// [claude-code 2026-03-10] Vanishing input — canvas particle animation on submit
import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { cn } from '../../lib/utils';

interface VanishInputProps {
  placeholders: string[];
  onSubmit: (value: string) => void;
  className?: string;
  cycleDuration?: number;
}

export function VanishInput({
  placeholders,
  onSubmit,
  className,
  cycleDuration = 3000,
}: VanishInputProps) {
  const [value, setValue] = useState('');
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [vanishing, setVanishing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cycle placeholders
  useEffect(() => {
    if (placeholders.length <= 1) return;
    const iv = setInterval(() => {
      setPlaceholderIdx((i) => (i + 1) % placeholders.length);
    }, cycleDuration);
    return () => clearInterval(iv);
  }, [placeholders, cycleDuration]);

  // Vanish animation
  const runVanish = useCallback(() => {
    const canvas = canvasRef.current;
    const input = inputRef.current;
    if (!canvas || !input || !value.trim()) return;

    setVanishing(true);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = input.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    // Render text to canvas
    const computed = getComputedStyle(input);
    ctx.font = computed.font;
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--fintheon-text').trim() || '#f0ead6';
    ctx.textBaseline = 'middle';
    ctx.fillText(value, 8, canvas.height / 2);

    // Read pixels
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const particles: { x: number; y: number; vx: number; vy: number; alpha: number }[] = [];

    for (let y = 0; y < canvas.height; y += 3) {
      for (let x = 0; x < canvas.width; x += 3) {
        const i = (y * canvas.width + x) * 4;
        if (imageData.data[i + 3] > 50) {
          particles.push({
            x,
            y,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.8) * 3,
            alpha: 1,
          });
        }
      }
    }

    setValue('');
    let frame = 0;
    const maxFrames = 40;

    const animate = () => {
      frame++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const accent = getComputedStyle(document.documentElement).getPropertyValue('--fintheon-accent').trim() || '#D4AF37';

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 1 / maxFrames;
        if (p.alpha <= 0) continue;
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = accent;
        ctx.fillRect(p.x, p.y, 2, 2);
      }

      if (frame < maxFrames) {
        requestAnimationFrame(animate);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setVanishing(false);
      }
    };

    requestAnimationFrame(animate);
  }, [value]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    onSubmit(value.trim());
    runVanish();
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={cn('relative', className)}
    >
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholders[placeholderIdx]}
        className={cn(
          'w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors',
          'placeholder:text-[var(--fintheon-muted)]',
          vanishing && 'text-transparent',
        )}
        style={{
          background: 'var(--fintheon-surface)',
          borderColor: value ? 'var(--fintheon-accent)' : 'rgba(212,175,55,0.15)',
          color: 'var(--fintheon-text)',
        }}
      />
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
      />
    </form>
  );
}
