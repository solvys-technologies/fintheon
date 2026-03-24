// [claude-code 2026-03-06] NarrativeFlow GhostCard — semi-transparent card for future scheduled events
import { useState, useEffect } from 'react';
import type { CatalystCard as CatalystCardType } from '../../lib/narrative-types';
import CatalystCard from './CatalystCard';

interface GhostCardProps {
  catalyst: CatalystCardType;
  compact?: boolean;
  selected?: boolean;
  onSelect: (id: string) => void;
  onDragStart?: (e: React.DragEvent, id: string) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  cardRef?: (el: HTMLDivElement | null) => void;
}

export default function GhostCard({
  catalyst,
  compact = false,
  selected = false,
  onSelect,
  onDragStart,
  onDragEnd,
  cardRef,
}: GhostCardProps) {
  const [solidified, setSolidified] = useState(false);
  const [wasGhost, setWasGhost] = useState(catalyst.isGhost ?? true);

  // Detect transition from ghost → solid (event occurred)
  useEffect(() => {
    if (wasGhost && !catalyst.isGhost) {
      setSolidified(true);
      const timer = setTimeout(() => setSolidified(false), 1000);
      return () => clearTimeout(timer);
    }
    setWasGhost(catalyst.isGhost ?? false);
  }, [catalyst.isGhost, wasGhost]);

  // If no longer a ghost, render as a normal CatalystCard (with optional solidify animation)
  if (!catalyst.isGhost) {
    return (
      <div className={solidified ? 'ghost-solidify' : ''}>
        <CatalystCard
          catalyst={catalyst}
          compact={compact}
          selected={selected}
          onSelect={onSelect}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          cardRef={cardRef}
        />
      </div>
    );
  }

  return (
    <div
      ref={cardRef}
      className={[
        'rounded-xl cursor-pointer select-none transition-all duration-200 relative',
        compact ? 'px-2 py-1.5 w-[120px]' : 'px-3 py-2.5 w-[160px]',
      ].join(' ')}
      style={{
        opacity: 0.5,
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        backgroundColor: 'color-mix(in srgb, var(--fintheon-surface) 60%, transparent)',
        border: `1px dashed color-mix(in srgb, var(--fintheon-border) 40%, transparent)`,
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        minHeight: compact ? 'auto' : '80px',
        filter: 'saturate(0.7)',
      }}
      onClick={() => onSelect(catalyst.id)}
      draggable={!!onDragStart}
      onDragStart={(e) => onDragStart?.(e, catalyst.id)}
      onDragEnd={onDragEnd}
    >
      {/* Scheduled badge */}
      <span
        className="absolute top-1 right-1.5 rounded-full px-1.5 py-0.5 font-medium uppercase"
        style={{
          fontSize: '7px',
          color: 'var(--fintheon-muted)',
          backgroundColor: 'color-mix(in srgb, var(--fintheon-muted) 15%, transparent)',
        }}
      >
        Scheduled
      </span>

      {/* Title */}
      <p
        className="font-semibold leading-tight truncate pr-10"
        style={{
          fontSize: compact ? '10px' : '11px',
          color: 'var(--fintheon-text)',
        }}
      >
        {catalyst.title}
      </p>

      {!compact && (
        <p
          className="mt-1 truncate"
          style={{ fontSize: '9px', color: 'var(--fintheon-muted)' }}
        >
          {new Date(catalyst.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </p>
      )}
    </div>
  );
}
