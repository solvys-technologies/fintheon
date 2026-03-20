// [claude-code 2026-03-06] SVG arc gauge for narrative health score (0-100)
import { useState } from 'react';

interface HealthGaugeProps {
  score: number;
  size?: number;
}

export function HealthGauge({ score, size = 28 }: HealthGaugeProps) {
  const [hovered, setHovered] = useState(false);

  const radius = size / 2 - 2;
  const circumference = Math.PI * radius;
  const fillLength = (Math.max(0, Math.min(100, score)) / 100) * circumference;

  const color = score >= 70 ? '#34D399' : score >= 40 ? 'var(--fintheon-accent)' : '#EF4444';

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background arc */}
        <path
          d={describeArc(size / 2, size / 2, radius, 180, 360)}
          fill="none"
          stroke="var(--fintheon-border)"
          strokeWidth={2}
          strokeLinecap="round"
          opacity={0.3}
        />
        {/* Fill arc */}
        <path
          d={describeArc(size / 2, size / 2, radius, 180, 360)}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeDasharray={`${fillLength} ${circumference}`}
          style={{ transition: 'stroke-dasharray 600ms ease' }}
        />
      </svg>
      {/* Score number */}
      <span
        className="absolute text-center font-mono font-bold"
        style={{ fontSize: size * 0.28, color, top: '45%' }}
      >
        {Math.round(score)}
      </span>
      {/* Tooltip */}
      {hovered && (
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-[10px] whitespace-nowrap bg-[var(--fintheon-surface)] border border-[var(--fintheon-border)]/30 text-[var(--fintheon-text)] shadow-lg z-20">
          Health: {Math.round(score)}/100
        </div>
      )}
    </div>
  );
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const startRad = (startAngle * Math.PI) / 180;
  const endRad = (endAngle * Math.PI) / 180;
  const x1 = cx + r * Math.cos(startRad);
  const y1 = cy + r * Math.sin(startRad);
  const x2 = cx + r * Math.cos(endRad);
  const y2 = cy + r * Math.sin(endRad);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
}
