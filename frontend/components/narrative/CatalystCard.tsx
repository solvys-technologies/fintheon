// [claude-code 2026-03-16] Stone theme + narrative theme integration
// [claude-code 2026-03-16] Added tag pills and inline tag-add button
import { useState, useCallback, useRef } from 'react';
import type { CatalystCard as CatalystCardType } from '../../lib/narrative-types';

const SENTIMENT_COLORS: Record<string, string> = {
  bullish: 'var(--fintheon-bullish)',
  bearish: 'var(--fintheon-bearish)',
};

const SENTIMENT_BG: Record<string, string> = {
  bullish: 'color-mix(in srgb, var(--fintheon-bullish) 15%, transparent)',
  bearish: 'color-mix(in srgb, var(--fintheon-bearish) 15%, transparent)',
};

const SEVERITY_LABELS: Record<string, { label: string; color: string }> = {
  high: { label: 'HIGH', color: 'var(--fintheon-bearish)' },
  medium: { label: 'MED', color: 'var(--fintheon-accent)' },
  low: { label: 'LOW', color: 'var(--fintheon-muted)' },
};

const SOURCE_LABELS: Record<string, string> = {
  rss: 'RSS',
  user: 'USR',
  agent: 'AGT',
  riskflow: 'RFL',
  brief: 'MDB',
};

interface CatalystCardProps {
  catalyst: CatalystCardType;
  compact?: boolean;
  selected?: boolean;
  onSelect: (id: string) => void;
  onTagAdd?: (id: string, tag: string) => void;
  onDragStart?: (e: React.DragEvent, id: string) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  cardRef?: (el: HTMLDivElement | null) => void;
}

export default function CatalystCard({
  catalyst,
  compact = false,
  selected = false,
  onSelect,
  onTagAdd,
  onDragStart,
  onDragEnd,
  cardRef,
}: CatalystCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);
  const tagInputRef = useRef<HTMLInputElement>(null);

  const handleClick = useCallback(() => {
    onSelect(catalyst.id);
  }, [onSelect, catalyst.id]);

  const handleDragStart = useCallback((e: React.DragEvent) => {
    onDragStart?.(e, catalyst.id);
  }, [onDragStart, catalyst.id]);

  const sentimentColor = SENTIMENT_COLORS[catalyst.sentiment];
  const severity = SEVERITY_LABELS[catalyst.severity];

  const borderColor = selected
    ? sentimentColor
    : `color-mix(in srgb, var(--fintheon-border) ${isHovered ? '50%' : '30%'}, transparent)`;

  return (
    <div
      ref={cardRef}
      draggable={!!onDragStart}
      onClick={handleClick}
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={[
        'rounded-xl cursor-pointer select-none transition-all duration-200',
        compact ? 'px-2 py-1.5' : 'px-3 py-2.5',
        compact ? 'w-[120px]' : 'w-[160px]',
        selected ? 'catalyst-card-pulse' : '',
      ].filter(Boolean).join(' ')}
      style={{
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        backgroundColor: 'color-mix(in srgb, var(--fintheon-surface) 80%, transparent)',
        border: `1px solid ${borderColor}`,
        boxShadow: selected
          ? `0 4px 24px rgba(0,0,0,0.3), 0 0 12px color-mix(in srgb, ${sentimentColor} 25%, transparent)`
          : '0 4px 16px rgba(0,0,0,0.3)',
        transform: isHovered && !selected ? 'scale(1.02)' : 'scale(1)',
        minHeight: compact ? 'auto' : '80px',
      }}
    >
      {/* Title */}
      <p
        className="font-semibold leading-tight truncate"
        style={{
          fontSize: compact ? '10px' : '11px',
          color: 'var(--fintheon-text)',
        }}
      >
        {catalyst.title}
      </p>

      {!compact && (
        <>
          {/* Date */}
          <p
            className="mt-1 truncate"
            style={{ fontSize: '9px', color: 'var(--fintheon-muted)' }}
          >
            {new Date(catalyst.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </p>

          {/* Badges row */}
          <div className="flex items-center gap-1 mt-1.5 flex-wrap">
            {/* Sentiment pill */}
            <span
              className="rounded-full px-1.5 py-0.5 font-medium uppercase"
              style={{
                fontSize: '8px',
                color: sentimentColor,
                backgroundColor: SENTIMENT_BG[catalyst.sentiment],
              }}
            >
              {catalyst.sentiment}
            </span>

            {/* Severity badge */}
            <span
              className="rounded-full px-1.5 py-0.5 font-medium"
              style={{
                fontSize: '8px',
                color: severity.color,
                backgroundColor: `color-mix(in srgb, ${severity.color} 15%, transparent)`,
              }}
            >
              {severity.label}
            </span>

            {/* Source badge */}
            <span
              className="rounded px-1 py-0.5 font-mono"
              style={{
                fontSize: '7px',
                color: 'var(--fintheon-muted)',
                backgroundColor: 'color-mix(in srgb, var(--fintheon-muted) 10%, transparent)',
              }}
            >
              {SOURCE_LABELS[catalyst.source] || catalyst.source}
            </span>
          </div>

          {/* Tag pills */}
          <div className="flex flex-wrap items-center gap-1 mt-1">
            {catalyst.tags?.map(tag => (
              <span
                key={tag}
                className="text-[8px] px-1.5 py-0.5 rounded-full border"
                style={{
                  color: 'var(--fintheon-accent)',
                  backgroundColor: 'color-mix(in srgb, var(--fintheon-accent) 15%, transparent)',
                  borderColor: 'color-mix(in srgb, var(--fintheon-accent) 20%, transparent)',
                }}
              >
                {tag}
              </span>
            ))}
            {onTagAdd && !showTagInput && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowTagInput(true);
                  setTimeout(() => tagInputRef.current?.focus(), 0);
                }}
                className="text-[8px] w-4 h-4 flex items-center justify-center rounded-full border transition-colors"
                style={{
                  color: 'var(--fintheon-muted)',
                  borderColor: 'color-mix(in srgb, var(--fintheon-accent) 20%, transparent)',
                }}
                title="Add tag"
              >
                +
              </button>
            )}
            {showTagInput && (
              <input
                ref={tagInputRef}
                value={tagInput}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter' && tagInput.trim()) {
                    onTagAdd?.(catalyst.id, tagInput.trim());
                    setTagInput('');
                    setShowTagInput(false);
                  }
                  if (e.key === 'Escape') {
                    setTagInput('');
                    setShowTagInput(false);
                  }
                }}
                onBlur={() => { setTagInput(''); setShowTagInput(false); }}
                className="text-[8px] w-14 px-1 py-0.5 rounded border bg-transparent outline-none"
                style={{
                  color: 'var(--fintheon-text)',
                  borderColor: 'color-mix(in srgb, var(--fintheon-accent) 30%, transparent)',
                }}
                placeholder="tag..."
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
