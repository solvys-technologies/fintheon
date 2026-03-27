// [claude-code 2026-03-27] ChatMind-style research card — bullets, metadata, drill-deeper, highlight support
import { useState, useCallback, useRef, useEffect } from 'react';
import { RISK_LANE_LABELS } from '../../lib/narrative-grid-layout';
import type { CatalystCard, NarrativeCategory } from '../../lib/narrative-types';

const SENTIMENT_COLORS: Record<string, string> = { bullish: 'var(--fintheon-bullish)', bearish: 'var(--fintheon-bearish)' };
const SEVERITY_BORDER: Record<string, string> = { high: 'var(--fintheon-bearish)', medium: 'var(--fintheon-accent)', low: 'var(--fintheon-border)' };

interface NarrativeResearchCardProps {
  catalyst: CatalystCard;
  compact?: boolean;
  selected?: boolean;
  highlightMode?: boolean;
  onSelect: (id: string) => void;
  onExpand?: (id: string) => void;
  onHighlightBranch?: (cardId: string, highlightedText: string) => void;
  onDrillDeeper?: (cardId: string, query: string) => void;
  cardRef?: (el: HTMLDivElement | null) => void;
}

export default function NarrativeResearchCard({
  catalyst,
  compact = false,
  selected = false,
  highlightMode = false,
  onSelect,
  onExpand,
  onHighlightBranch,
  onDrillDeeper,
  cardRef,
}: NarrativeResearchCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [drillOpen, setDrillOpen] = useState(false);
  const [drillValue, setDrillValue] = useState('');
  const [drillLoading, setDrillLoading] = useState(false);
  const drillInputRef = useRef<HTMLInputElement>(null);
  const cardDomRef = useRef<HTMLDivElement | null>(null);

  const sentimentColor = SENTIMENT_COLORS[catalyst.sentiment];
  const severityBorder = SEVERITY_BORDER[catalyst.severity];
  const categoryLabel = catalyst.category
    ? RISK_LANE_LABELS[catalyst.category as NarrativeCategory] ?? catalyst.category
    : null;

  const hasBullets = catalyst.researchBullets && catalyst.researchBullets.length > 0;

  // Severity → rough IV score for display
  const ivScore = catalyst.severity === 'high' ? '7+' : catalyst.severity === 'medium' ? '4-6' : '1-3';

  const handleClick = useCallback(() => {
    if (!highlightMode) onSelect(catalyst.id);
  }, [highlightMode, onSelect, catalyst.id]);

  const handleExpand = useCallback((e: React.MouseEvent) => { e.stopPropagation(); onExpand?.(catalyst.id); }, [onExpand, catalyst.id]);

  const handleDrillOpen = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); setDrillOpen(true);
    setTimeout(() => drillInputRef.current?.focus(), 0);
  }, []);

  const handleDrillSubmit = useCallback(() => {
    if (!drillValue.trim()) return;
    setDrillLoading(true);
    onDrillDeeper?.(catalyst.id, drillValue.trim());
    setDrillValue('');
  }, [drillValue, onDrillDeeper, catalyst.id]);

  // Clear loading when new bullets arrive
  useEffect(() => {
    if (drillLoading && hasBullets) { setDrillLoading(false); setDrillOpen(false); }
  }, [catalyst.researchBullets, drillLoading, hasBullets]);

  // Highlight text selection handler
  const handleMouseUp = useCallback(() => {
    if (!highlightMode || !onHighlightBranch) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const text = sel.toString().trim();
    if (!text || !cardDomRef.current?.contains(sel.getRangeAt(0).commonAncestorContainer)) return;
    onHighlightBranch(catalyst.id, text);
    setTimeout(() => sel.removeAllRanges(), 300);
  }, [highlightMode, onHighlightBranch, catalyst.id]);

  const width = compact ? 200 : 280;
  const isGhost = catalyst.isGhost;
  const isAgent = catalyst.source === 'agent';
  const borderColor = selected
    ? sentimentColor
    : `color-mix(in srgb, var(--fintheon-border) ${isHovered ? '50%' : '30%'}, transparent)`;

  return (
    <div
      ref={(el) => { cardDomRef.current = el; cardRef?.(el); }}
      onClick={handleClick}
      onMouseUp={handleMouseUp}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={[
        'rounded-xl transition-all duration-200',
        highlightMode ? 'cursor-text' : 'cursor-pointer',
        selected ? 'research-card-selected' : '',
        isAgent ? 'research-card-agent' : '',
      ].filter(Boolean).join(' ')}
      style={{
        width: `${width}px`,
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        backgroundColor: 'color-mix(in srgb, var(--fintheon-surface) 90%, transparent)',
        border: `1px solid ${borderColor}`,
        borderLeft: `3px solid ${severityBorder}`,
        borderRadius: '12px',
        boxShadow: selected
          ? `0 4px 24px rgba(0,0,0,0.3), 0 0 12px color-mix(in srgb, ${sentimentColor} 25%, transparent)`
          : '0 4px 16px rgba(0,0,0,0.3)',
        transform: isHovered && !selected ? 'scale(1.01)' : 'scale(1)',
        opacity: isGhost ? 0.7 : 1,
        borderStyle: isGhost ? 'dashed' : undefined,
        userSelect: highlightMode ? 'text' : 'none',
      }}
    >
      {/* ── Title bar ── */}
      <div className="flex items-start justify-between px-3 pt-2.5 pb-1">
        <div className="flex-1 min-w-0 pr-2">
          {catalyst.parentHighlight && (
            <p
              className="truncate italic"
              style={{ fontSize: '8px', color: 'var(--fintheon-muted)', marginBottom: '2px' }}
            >
              branched from: {catalyst.parentHighlight}
            </p>
          )}
          <p
            className="font-semibold leading-tight uppercase tracking-wide"
            style={{ fontSize: compact ? '10px' : '11px', color: 'var(--fintheon-muted)' }}
          >
            {catalyst.title}
          </p>
        </div>
        {onExpand && (
          <button onClick={handleExpand} title="Expand card"
            className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded transition-colors"
            style={{ fontSize: '11px', color: 'var(--fintheon-muted)', backgroundColor: 'transparent' }}
          >↗</button>
        )}
      </div>

      {/* Metadata strip */}
      <div className="flex items-center gap-1.5 px-3 pb-2 flex-wrap" style={{ fontSize: '9px' }}>
        {categoryLabel && (
          <span className="rounded-full px-1.5 py-0.5 font-medium"
            style={{ color: 'var(--fintheon-text)', backgroundColor: 'color-mix(in srgb, var(--fintheon-muted) 15%, transparent)' }}>
            {categoryLabel}
          </span>
        )}
        <span style={{ color: 'var(--fintheon-muted)' }}>IV: {ivScore}</span>
        <span className="flex items-center gap-0.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sentimentColor }} />
          <span style={{ color: sentimentColor }}>{catalyst.sentiment}</span>
        </span>
      </div>
      <div className="mx-3" style={{ height: '1px', backgroundColor: 'color-mix(in srgb, var(--fintheon-border) 20%, transparent)' }} />

      {/* ── Research bullets / body ── */}
      <div className="px-3 py-2" style={{ minHeight: compact ? 'auto' : '60px' }}>
        {hasBullets ? (
          <div className="flex flex-col gap-1.5">
            {catalyst.researchBullets!.map((bullet) => (
              <p
                key={bullet.id}
                className="leading-snug research-bullet"
                style={{
                  fontSize: '10px',
                  color: 'var(--fintheon-text)',
                  userSelect: highlightMode ? 'text' : 'none',
                }}
              >
                <span style={{ color: 'var(--fintheon-muted)', marginRight: '4px' }}>•</span>
                <span className="font-semibold">{bullet.boldPhrase}</span>
                {bullet.explanation && (
                  <span style={{ fontWeight: 400 }}>: {bullet.explanation}</span>
                )}
              </p>
            ))}
          </div>
        ) : (
          catalyst.description ? (
            <p
              className="leading-snug"
              style={{ fontSize: '10px', color: 'var(--fintheon-text)' }}
            >
              {catalyst.description}
            </p>
          ) : null
        )}

        {/* Loading skeleton for drill-deeper response */}
        {drillLoading && (
          <div className="flex flex-col gap-1.5 mt-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded animate-pulse"
                style={{
                  height: '8px',
                  width: `${70 + i * 8}%`,
                  backgroundColor: 'color-mix(in srgb, var(--fintheon-muted) 20%, transparent)',
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Drill deeper input */}
      <div className="px-3 pb-2.5" onClick={(e) => e.stopPropagation()}>
        {!drillOpen ? (
          <button onClick={handleDrillOpen} className="w-full text-left transition-colors"
            style={{ fontSize: '10px', color: 'var(--fintheon-muted)', backgroundColor: 'transparent', border: 'none', padding: '2px 0', cursor: 'pointer' }}>
            › Drill deeper...
          </button>
        ) : (
          <div className="flex items-center gap-1">
            <input ref={drillInputRef} value={drillValue}
              onChange={(e) => setDrillValue(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') handleDrillSubmit();
                if (e.key === 'Escape') { setDrillOpen(false); setDrillValue(''); }
              }}
              className="flex-1 bg-transparent outline-none border-b"
              style={{ fontSize: '10px', color: 'var(--fintheon-text)', borderColor: 'color-mix(in srgb, var(--fintheon-accent) 40%, transparent)', padding: '2px 0' }}
              placeholder="Ask a follow-up..."
            />
            <button onClick={handleDrillSubmit} className="flex-shrink-0"
              style={{ fontSize: '11px', color: 'var(--fintheon-accent)', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', padding: '0 2px' }}>
              ↑
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
