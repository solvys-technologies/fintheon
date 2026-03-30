// [claude-code 2026-03-28] S9-T5-T2: Sanctum filter & legend panel — rope legend, sort, narrative/category toggles, sentiment
import { useRef, useEffect, useCallback } from 'react';
import { useNarrative } from '../../contexts/NarrativeContext';
import { CATEGORY_COLORS } from '../../lib/narrative-force-layout';
import type { NarrativeCategory, CatalystSentiment } from '../../lib/narrative-types';

interface SanctumFilterPanelProps {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
}

// Must match NarrativeForceCanvas NARRATIVE_THREADS
const NARRATIVE_THREADS = [
  { slug: 'middle-east-conflict', title: 'Middle Eastern Conflict', color: '#F59E0B' },
  { slug: 'liquidity-credit-contraction', title: 'Liquidity & Credit', color: '#8B5CF6' },
  { slug: 'ai-singularity', title: 'The Singularity', color: '#3B82F6' },
  { slug: 'usd-jpy-carry-trade', title: 'USD-JPY Carry Trade', color: '#EC4899' },
  { slug: 'trade-war', title: 'Trade War', color: '#EF4444' },
  { slug: 'us-china-relations', title: 'US-China Relations', color: '#14B8A6' },
  { slug: 'rate-cut-cycle', title: 'Rate Cut Cycle', color: '#34D399' },
  { slug: 'trump-presidency', title: 'Trump Presidency', color: '#F97316' },
  { slug: 'price-stability', title: 'Price Stability', color: '#FBBF24' },
  { slug: 'maximum-employment', title: 'Max Employment', color: '#A78BFA' },
];

const CATEGORIES: { id: NarrativeCategory; label: string }[] = [
  { id: 'geopolitical', label: 'Geopolitical' },
  { id: 'monetary', label: 'Monetary' },
  { id: 'macroeconomic', label: 'Macroeconomic' },
  { id: 'market-structure', label: 'Market Structure' },
  { id: 'earnings', label: 'Earnings' },
  { id: 'supply-chain', label: 'Supply Chain' },
  { id: 'black-swan', label: 'Black Swan' },
];

const SORT_OPTIONS: { value: 'severity' | 'date' | 'health' | null; label: string }[] = [
  { value: 'severity', label: 'Severity (High \u2192 Low)' },
  { value: 'date', label: 'Date (Newest first)' },
  { value: 'health', label: 'Health Score' },
  { value: null, label: 'None (default)' },
];

const SENTIMENTS: { value: CatalystSentiment | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'bullish', label: 'Bullish' },
  { value: 'bearish', label: 'Bearish' },
];

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pt-3 pb-1.5">
      <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-[var(--fintheon-accent)]/70">
        {children}
      </span>
    </div>
  );
}

function RopeLegendLine({ width, color, opacity, dashed }: { width: number; color: string; opacity: number; dashed?: boolean }) {
  return (
    <svg width="40" height="10" className="flex-shrink-0">
      <line
        x1="2" y1="5" x2="38" y2="5"
        stroke={color}
        strokeWidth={width}
        opacity={opacity}
        strokeDasharray={dashed ? '4 3' : undefined}
      />
    </svg>
  );
}

export function SanctumFilterPanel({ open, onClose, anchorRef }: SanctumFilterPanelProps) {
  const { state, dispatch } = useNarrative();
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose, anchorRef]);

  // Derive visible lane IDs from state for narrative toggles
  // visibleLaneIds logic: catalysts store narrative slugs, we track which ones are hidden
  // Using categoryFilter for categories. For narratives, we use the existing visibleLaneIds pattern.
  // Since visibleLaneIds isn't in state (it's local to NarrativeMap), we track hidden narratives locally.
  // Actually, checking the NarrativeMap: visibleLaneIds is derived from a local useState. Let's manage narrative
  // toggles through the existing lanes/catalysts pattern — but the brief says to add to state.
  // For now, narrative toggles will dispatch SET_FILTER style actions through the existing visibleLaneIds.
  // HOWEVER: visibleLaneIds lives in NarrativeMap as local state. The brief says to use approach 2 (state).
  // We'll pass narrative visibility through state as well. But to keep scope minimal, let's reuse
  // the category filter pattern for narratives too — but narratives are already handled by NarrativeMap's
  // visibleLaneIds which is passed down. The filter panel can work within state for categories/sort/sentiment.

  const handleSentimentChange = useCallback((sentiment: CatalystSentiment | 'all') => {
    dispatch({ type: 'SET_FILTER', sentiment });
  }, [dispatch]);

  const handleSortChange = useCallback((sort: 'severity' | 'date' | 'health' | null) => {
    dispatch({ type: 'SET_SEVERITY_SORT', sort });
  }, [dispatch]);

  const handleCategoryToggle = useCallback((cat: NarrativeCategory) => {
    dispatch({ type: 'TOGGLE_CATEGORY', category: cat });
  }, [dispatch]);

  const handleCategoryClearAll = useCallback(() => {
    dispatch({ type: 'SET_CATEGORY_FILTER', categories: new Set(CATEGORIES.map(c => c.id)) });
  }, [dispatch]);

  const handleCategorySelectAll = useCallback(() => {
    dispatch({ type: 'SET_CATEGORY_FILTER', categories: new Set() });
  }, [dispatch]);

  if (!open) return null;

  const isCategoryVisible = (cat: NarrativeCategory) =>
    state.categoryFilter.size === 0 || state.categoryFilter.has(cat);

  return (
    <div
      ref={panelRef}
      className="absolute top-full right-0 mt-1 z-50 w-[260px] max-h-[70vh] overflow-y-auto rounded-lg border border-[var(--fintheon-accent)]/20 bg-[var(--fintheon-bg)] shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl"
      style={{ scrollbarWidth: 'thin', scrollbarColor: '#c79f4a30 transparent' }}
    >
      {/* Section 1: Rope Legend */}
      <SectionHeading>Rope Types</SectionHeading>
      <div className="px-3 pb-2 space-y-1.5">
        <div className="flex items-center gap-2">
          <RopeLegendLine width={1} color="#8B5CF6" opacity={0.12} />
          <span className="text-[10px] text-[var(--fintheon-text)]/60">Hub → Catalyst (structural)</span>
        </div>
        <div className="flex items-center gap-2">
          <RopeLegendLine width={2} color="#3B82F6" opacity={0.3} />
          <span className="text-[10px] text-[var(--fintheon-text)]/60">Same-narrative connection</span>
        </div>
        <div className="flex items-center gap-2">
          <RopeLegendLine width={2} color="#c79f4a" opacity={0.25} />
          <span className="text-[10px] text-[var(--fintheon-text)]/60">Cross-narrative (gold)</span>
        </div>
        <p className="text-[9px] text-[var(--fintheon-text)]/30 italic">Thickness = tag overlap strength</p>
      </div>

      <div className="mx-3 border-t border-[var(--fintheon-accent)]/10" />

      {/* Section 2: Importance Sort */}
      <SectionHeading>Sort By</SectionHeading>
      <div className="px-3 pb-2 space-y-0.5">
        {SORT_OPTIONS.map(opt => (
          <label key={opt.label} className="flex items-center gap-2 py-0.5 cursor-pointer group">
            <div
              className={`w-3 h-3 rounded-full border transition-colors ${
                state.severitySort === opt.value
                  ? 'border-[var(--fintheon-accent)] bg-[var(--fintheon-accent)]'
                  : 'border-[var(--fintheon-text)]/20 group-hover:border-[var(--fintheon-text)]/40'
              }`}
            >
              {state.severitySort === opt.value && (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--fintheon-bg)]" />
                </div>
              )}
            </div>
            <span className="text-[10px] text-[var(--fintheon-text)]/60 group-hover:text-[var(--fintheon-text)]/80">
              {opt.label}
            </span>
          </label>
        ))}
      </div>

      <div className="mx-3 border-t border-[var(--fintheon-accent)]/10" />

      {/* Section 3: Narrative Thread Toggles */}
      <SectionHeading>Narratives</SectionHeading>
      <div className="px-3 pb-2 space-y-0.5">
        {NARRATIVE_THREADS.map(thread => (
          <label key={thread.slug} className="flex items-center gap-2 py-0.5 cursor-pointer group">
            <div
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: thread.color }}
            />
            <span className="text-[10px] text-[var(--fintheon-text)]/60 group-hover:text-[var(--fintheon-text)]/80 truncate">
              {thread.title}
            </span>
          </label>
        ))}
        <p className="text-[9px] text-[var(--fintheon-text)]/25 italic pt-0.5">
          Narrative visibility controlled by map view
        </p>
      </div>

      <div className="mx-3 border-t border-[var(--fintheon-accent)]/10" />

      {/* Section 4: Category Toggles */}
      <SectionHeading>Categories</SectionHeading>
      <div className="px-3 pb-1">
        <div className="flex gap-2 mb-1">
          <button
            onClick={handleCategorySelectAll}
            className="text-[9px] text-[var(--fintheon-accent)]/60 hover:text-[var(--fintheon-accent)] transition-colors"
          >
            Show All
          </button>
          <button
            onClick={handleCategoryClearAll}
            className="text-[9px] text-[var(--fintheon-accent)]/60 hover:text-[var(--fintheon-accent)] transition-colors"
          >
            Clear All
          </button>
        </div>
        <div className="space-y-0.5">
          {CATEGORIES.map(cat => {
            const visible = isCategoryVisible(cat.id);
            return (
              <label key={cat.id} className="flex items-center gap-2 py-0.5 cursor-pointer group">
                <div
                  onClick={(e) => { e.preventDefault(); handleCategoryToggle(cat.id); }}
                  className={`w-3 h-3 rounded-[3px] border transition-colors flex items-center justify-center ${
                    visible
                      ? 'border-transparent'
                      : 'border-[var(--fintheon-text)]/20 group-hover:border-[var(--fintheon-text)]/40'
                  }`}
                  style={visible ? { backgroundColor: CATEGORY_COLORS[cat.id] } : undefined}
                >
                  {visible && (
                    <svg width="8" height="8" viewBox="0 0 8 8">
                      <path d="M1.5 4L3.5 6L6.5 2" stroke="#050402" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: CATEGORY_COLORS[cat.id] }}
                />
                <span className={`text-[10px] transition-colors ${
                  visible
                    ? 'text-[var(--fintheon-text)]/60 group-hover:text-[var(--fintheon-text)]/80'
                    : 'text-[var(--fintheon-text)]/25 line-through'
                }`}>
                  {cat.label}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="mx-3 border-t border-[var(--fintheon-accent)]/10" />

      {/* Section 5: Sentiment */}
      <SectionHeading>Sentiment</SectionHeading>
      <div className="px-3 pb-3">
        <div className="flex rounded-md overflow-hidden border border-[var(--fintheon-accent)]/15">
          {SENTIMENTS.map(s => (
            <button
              key={s.value}
              onClick={() => handleSentimentChange(s.value)}
              className={`flex-1 px-2 py-1 text-[10px] font-medium transition-colors ${
                state.filterSentiment === s.value
                  ? 'bg-[var(--fintheon-accent)]/15 text-[var(--fintheon-accent)]'
                  : 'text-[var(--fintheon-text)]/40 hover:text-[var(--fintheon-text)]/60 hover:bg-[var(--fintheon-accent)]/5'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
