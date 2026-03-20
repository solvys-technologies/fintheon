// [claude-code 2026-03-06] Visual diamond node at narrative lane fork points
import { useState } from 'react';
import type { NarrativeLane } from '../../lib/narrative-types';

interface ForkNodeProps {
  lane: NarrativeLane;
  forkDate: string;
  position: { x: number; y: number };
}

export function ForkNode({ lane, forkDate, position }: ForkNodeProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="absolute z-10"
      style={{ left: position.x - 8, top: position.y - 8 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Diamond shape */}
      <div
        className="w-4 h-4 rotate-45 border border-[var(--fintheon-accent)]/40 bg-[var(--fintheon-surface)]"
        style={{ transition: 'border-color 200ms ease' }}
      />
      {/* Fork lines (two lines branching down from diamond) */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex gap-3">
        <div className="w-px h-6 bg-[var(--fintheon-accent)]/30" />
        <div className="w-px h-6 bg-[var(--fintheon-accent)]/30" />
      </div>
      {/* Tooltip */}
      {hovered && (
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-[10px] whitespace-nowrap bg-[var(--fintheon-surface)] border border-[var(--fintheon-border)]/30 text-[var(--fintheon-text)] shadow-lg z-20">
          Forked: {forkDate}
        </div>
      )}
    </div>
  );
}
