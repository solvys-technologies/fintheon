// [claude-code 2026-03-10] AI Loader — rotating glow circle + text animation, Solvys Gold palette
import { cn } from '../../lib/utils';

interface AiLoaderProps {
  text?: string;
  size?: number;
  className?: string;
}

export function AiLoader({ text = 'Thinking...', size = 40, className }: AiLoaderProps) {
  const r = size / 2 - 3; // ring radius with padding

  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      <div className="relative" style={{ width: size, height: size }}>
        {/* Outer glow */}
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="animate-spin"
          style={{ animationDuration: '2.4s' }}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--fintheon-accent)"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeDasharray={`${r * 1.8} ${r * 4.5}`}
            style={{ filter: 'drop-shadow(0 0 4px var(--fintheon-accent))' }}
          />
        </svg>
        {/* Inner dot */}
        <span
          className="absolute inset-0 flex items-center justify-center"
          aria-hidden="true"
        >
          <span
            className="rounded-full"
            style={{
              width: 6,
              height: 6,
              background: 'var(--fintheon-accent)',
              boxShadow: '0 0 8px var(--fintheon-accent)',
            }}
          />
        </span>
      </div>

      {text && (
        <span
          className="text-sm font-medium animate-pulse"
          style={{ color: 'var(--fintheon-accent)' }}
        >
          {text}
        </span>
      )}
    </div>
  );
}
