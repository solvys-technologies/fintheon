// [claude-code 2026-03-06] Warning badge for cross-narrative conflicts
import { AlertTriangle } from 'lucide-react';
import type { NarrativeConflict } from '../../lib/narrative-types';
import type { Point } from '../../lib/narrative-catenary';

interface ConflictBadgeProps {
  conflict: NarrativeConflict;
  position: Point;
  onClick: (id: string) => void;
}

export function ConflictBadge({ conflict, position, onClick }: ConflictBadgeProps) {
  return (
    <button
      onClick={() => onClick(conflict.id)}
      className="absolute flex items-center justify-center w-6 h-6 rounded-full cursor-pointer"
      style={{
        left: position.x - 12,
        top: position.y - 12,
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
        boxShadow: '0 0 8px rgba(239, 68, 68, 0.3)',
        border: '1px solid rgba(239, 68, 68, 0.4)',
        zIndex: 20,
      }}
      title={conflict.description}
    >
      <AlertTriangle size={12} color="var(--fintheon-bearish)" />
    </button>
  );
}
