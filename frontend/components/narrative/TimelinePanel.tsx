// [claude-code 2026-03-29] Add severity filter (default: Critical & High) + fix empty timeline
// [claude-code 2026-03-28] S7: Paginated 2-column narrative timeline — structured view of NarrativeFlow
import { useState, useMemo, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, Filter } from 'lucide-react';
import { useNarrative } from '../../contexts/NarrativeContext';
import type { CatalystCard, NarrativeCategory } from '../../lib/narrative-types';

// The 10 real narrative threads (must match migration 027)
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
] as const;

const COLS_PER_PAGE = 2;
const TOTAL_PAGES = Math.ceil(NARRATIVE_THREADS.length / COLS_PER_PAGE);

const SEVERITY_DOT: Record<string, string> = {
  high: '#EF4444',
  medium: '#c79f4a',
  low: '#6B7280',
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
}

// Group cards by date for a column
function groupByDate(cards: CatalystCard[]): [string, CatalystCard[]][] {
  const map = new Map<string, CatalystCard[]>();
  for (const c of cards) {
    const key = c.date?.slice(0, 10) ?? 'unknown';
    const arr = map.get(key) ?? [];
    arr.push(c);
    map.set(key, arr);
  }
  return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
}

export function TimelinePanel() {
  const { state } = useNarrative();
  const [pageIndex, setPageIndex] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('right');
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [tagFilterOpen, setTagFilterOpen] = useState(false);
  // Default to Critical & High only
  const [severityFilter, setSeverityFilter] = useState<Set<string>>(new Set(['high']));

  // Current 2 narratives to display
  const visibleThreads = useMemo(() => {
    const start = pageIndex * COLS_PER_PAGE;
    return NARRATIVE_THREADS.slice(start, start + COLS_PER_PAGE);
  }, [pageIndex]);

  // All unique tags from catalysts
  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const c of state.catalysts) {
      for (const t of (c.tags ?? [])) set.add(t);
    }
    return [...set].sort();
  }, [state.catalysts]);

  // Cards grouped by narrative thread
  const cardsByThread = useMemo(() => {
    const map = new Map<string, CatalystCard[]>();
    for (const thread of NARRATIVE_THREADS) {
      const cards = state.catalysts.filter(c => {
        const threads = c.narrativeThreads ?? (c.narrative ? [c.narrative] : []);
        if (!threads.includes(thread.slug)) return false;
        if (activeTagFilter && !(c.tags ?? []).includes(activeTagFilter)) return false;
        // Severity filter (empty set = show all)
        if (severityFilter.size > 0 && !severityFilter.has(c.severity)) return false;
        return true;
      });
      map.set(thread.slug, cards.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')));
    }
    return map;
  }, [state.catalysts, activeTagFilter, severityFilter]);

  // Find cross-column connections (cards that appear in both visible threads)
  const crossConnections = useMemo(() => {
    if (visibleThreads.length < 2) return [];
    const leftCards = cardsByThread.get(visibleThreads[0].slug) ?? [];
    const rightCards = cardsByThread.get(visibleThreads[1].slug) ?? [];
    const rightIds = new Set(rightCards.map(c => c.id));
    // Cards that appear in both columns via narrativeThreads
    return leftCards.filter(c => {
      const threads = c.narrativeThreads ?? [];
      return threads.includes(visibleThreads[1].slug);
    }).map(c => ({
      id: c.id,
      title: c.title,
      existsInRight: rightIds.has(c.id),
    }));
  }, [visibleThreads, cardsByThread]);

  const changePage = useCallback((direction: 'left' | 'right', newIndex: number) => {
    setSlideDirection(direction);
    setTransitioning(true);
    setTimeout(() => {
      setPageIndex(newIndex);
      setTransitioning(false);
    }, 200);
  }, []);

  const handlePrev = useCallback(() => {
    if (pageIndex > 0) changePage('right', pageIndex - 1);
  }, [pageIndex, changePage]);

  const handleNext = useCallback(() => {
    if (pageIndex < TOTAL_PAGES - 1) changePage('left', pageIndex + 1);
  }, [pageIndex, changePage]);

  return (
    <div className="h-full flex flex-col bg-[var(--fintheon-bg)]">
      {/* Header with navigation */}
      <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-[var(--fintheon-border)]/10">
        <div>
          <div className="flex items-baseline gap-3">
            <h2 className="text-lg font-bold text-[var(--fintheon-accent)] uppercase tracking-widest"
              style={{ fontFamily: 'var(--font-heading)' }}>
              Timeline
            </h2>
            <div className="flex items-baseline gap-1.5 text-[13px]" style={{ fontFamily: 'var(--font-mono)' }}>
              <span className="shimmer-number font-bold">{state.catalysts.length}</span>
              <span className="text-[var(--fintheon-muted)]/50 text-[11px]">events</span>
              <span className="text-[var(--fintheon-muted)]/20 mx-0.5">&middot;</span>
              <span className="shimmer-number font-bold">{NARRATIVE_THREADS.length}</span>
              <span className="text-[var(--fintheon-muted)]/50 text-[11px]">narratives</span>
            </div>
          </div>
          <p className="text-[11px] text-[var(--fintheon-muted)]/40 mt-0.5" style={{ fontFamily: 'var(--font-body)' }}>
            Structured Narrative View
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Severity filter pills */}
          <div className="flex items-center gap-1">
            {(['high', 'medium', 'low'] as const).map(sev => {
              const active = severityFilter.has(sev);
              const label = sev === 'high' ? 'Critical & High' : sev === 'medium' ? 'Medium' : 'Low';
              const dotColor = SEVERITY_DOT[sev];
              return (
                <button
                  key={sev}
                  onClick={() => setSeverityFilter(prev => {
                    const next = new Set(prev);
                    if (next.has(sev)) {
                      next.delete(sev);
                    } else {
                      next.add(sev);
                    }
                    return next;
                  })}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[8px] uppercase tracking-wider transition-colors ${
                    active
                      ? 'border-[var(--fintheon-accent)]/30 text-[var(--fintheon-text)]/80'
                      : 'border-[var(--fintheon-accent)]/8 text-[var(--fintheon-muted)]/25 hover:text-[var(--fintheon-muted)]/50'
                  }`}
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: active ? dotColor : `${dotColor}40` }} />
                  {label}
                </button>
              );
            })}
          </div>

          {/* Tag filter */}
          <div className="relative">
            <button
              onClick={() => setTagFilterOpen(v => !v)}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] transition-colors ${
                activeTagFilter
                  ? 'text-[var(--fintheon-accent)] bg-[var(--fintheon-accent)]/10'
                  : 'text-[var(--fintheon-muted)]/40 hover:text-[var(--fintheon-text)]/60'
              }`}
              style={{ fontFamily: 'var(--font-body)' }}
            >
              <Filter className="w-3 h-3" />
              {activeTagFilter ? `#${activeTagFilter}` : 'Filter'}
            </button>
            {tagFilterOpen && (
              <div className="absolute top-full right-0 mt-1 z-50 w-48 max-h-48 overflow-y-auto rounded-lg border bg-[var(--fintheon-bg)] shadow-lg"
                style={{ borderColor: 'color-mix(in srgb, var(--fintheon-accent) 20%, transparent)' }}>
                <button
                  onClick={() => { setActiveTagFilter(null); setTagFilterOpen(false); }}
                  className={`w-full text-left px-3 py-1.5 text-[9px] transition-colors ${!activeTagFilter ? 'text-[var(--fintheon-accent)]' : 'text-[var(--fintheon-muted)]/50 hover:text-[var(--fintheon-text)]'}`}
                >
                  All tags
                </button>
                {allTags.slice(0, 30).map(tag => (
                  <button
                    key={tag}
                    onClick={() => { setActiveTagFilter(tag); setTagFilterOpen(false); }}
                    className={`w-full text-left px-3 py-1.5 text-[9px] transition-colors ${activeTagFilter === tag ? 'text-[var(--fintheon-accent)] bg-[var(--fintheon-accent)]/5' : 'text-[var(--fintheon-muted)]/50 hover:text-[var(--fintheon-text)]'}`}
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Page navigation */}
          <div className="flex items-center gap-1">
            <button
              onClick={handlePrev}
              disabled={pageIndex === 0}
              className="p-1 rounded transition-colors hover:bg-[var(--fintheon-accent)]/5 disabled:opacity-20"
              style={{ color: 'var(--fintheon-accent)' }}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-[9px] text-[var(--fintheon-muted)]/40 min-w-[40px] text-center" style={{ fontFamily: 'var(--font-mono)' }}>
              {pageIndex + 1}/{TOTAL_PAGES}
            </span>
            <button
              onClick={handleNext}
              disabled={pageIndex >= TOTAL_PAGES - 1}
              className="p-1 rounded transition-colors hover:bg-[var(--fintheon-accent)]/5 disabled:opacity-20"
              style={{ color: 'var(--fintheon-accent)' }}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Two-column narrative view with slide transition */}
      <div
        className="flex-1 min-h-0 flex gap-0 overflow-hidden transition-all duration-200 ease-out"
        style={{
          opacity: transitioning ? 0 : 1,
          transform: transitioning
            ? `translateX(${slideDirection === 'left' ? '-20px' : '20px'})`
            : 'translateX(0)',
        }}
      >
        {visibleThreads.map((thread, colIdx) => {
          const cards = cardsByThread.get(thread.slug) ?? [];
          const dateGroups = groupByDate(cards);
          return (
            <div
              key={thread.slug}
              className="flex-1 min-w-0 flex flex-col border-r last:border-r-0 overflow-hidden"
              style={{ borderColor: 'color-mix(in srgb, var(--fintheon-border) 10%, transparent)' }}
            >
              {/* Column header */}
              <div className="shrink-0 px-4 py-3 border-b" style={{ borderColor: `${thread.color}20` }}>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: thread.color }} />
                  <h3 className="text-[11px] font-bold uppercase tracking-wider" style={{ color: thread.color, fontFamily: 'var(--font-heading)' }}>
                    {thread.title}
                  </h3>
                </div>
                <p className="text-[8px] mt-0.5 opacity-40" style={{ color: 'var(--fintheon-muted)', fontFamily: 'var(--font-mono)' }}>
                  {cards.length} events
                </p>
              </div>

              {/* Cards chronologically */}
              <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
                {dateGroups.length === 0 && (
                  <p className="text-[9px] text-[var(--fintheon-muted)]/30 text-center py-8" style={{ fontFamily: 'var(--font-body)' }}>
                    No events in this narrative
                  </p>
                )}

                {dateGroups.map(([date, events]) => (
                  <div key={date}>
                    {/* Date separator */}
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[8px] font-bold uppercase tracking-wider" style={{ color: `${thread.color}60`, fontFamily: 'var(--font-mono)' }}>
                        {formatDate(date)}
                      </span>
                      <div className="flex-1 h-px" style={{ backgroundColor: `${thread.color}15` }} />
                    </div>

                    {/* Event cards */}
                    <div className="space-y-1.5 ml-1">
                      {events.map(event => {
                        const isBullish = event.sentiment === 'bullish';
                        const isMultiNarrative = (event.narrativeThreads ?? []).length > 1;
                        return (
                          <div
                            key={event.id}
                            className="rounded-lg border px-3 py-2 transition-colors hover:border-[var(--fintheon-accent)]/15"
                            style={{
                              borderColor: 'color-mix(in srgb, var(--fintheon-border) 12%, transparent)',
                              backgroundColor: 'color-mix(in srgb, var(--fintheon-surface) 40%, transparent)',
                              borderLeft: `3px solid ${SEVERITY_DOT[event.severity] ?? '#6B7280'}`,
                            }}
                          >
                            {/* Title + sentiment */}
                            <div className="flex items-start gap-1.5">
                              <p className="flex-1 text-[10px] font-semibold leading-tight" style={{ color: 'var(--fintheon-text)', fontFamily: 'var(--font-body)' }}>
                                {event.title}
                              </p>
                              <span className="text-[9px] font-bold shrink-0" style={{ color: isBullish ? 'var(--fintheon-bullish)' : 'var(--fintheon-bearish)' }}>
                                {isBullish ? '▲' : '▼'}
                              </span>
                            </div>

                            {/* Description */}
                            {event.description && (
                              <p className="text-[8px] mt-0.5 line-clamp-2 opacity-50" style={{ color: 'var(--fintheon-muted)', fontFamily: 'var(--font-body)' }}>
                                {event.description}
                              </p>
                            )}

                            {/* Tags */}
                            {event.tags && event.tags.length > 0 && (
                              <div className="flex flex-wrap gap-0.5 mt-1">
                                {event.tags.slice(0, 4).map(t => (
                                  <span key={t} className="text-[6px] px-1 py-0.5 rounded" style={{ color: `${thread.color}80`, backgroundColor: `${thread.color}08`, fontFamily: 'var(--font-mono)' }}>
                                    #{t}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Multi-narrative indicator (rope connection) */}
                            {isMultiNarrative && (
                              <div className="flex items-center gap-1 mt-1 pt-1 border-t" style={{ borderColor: '#c79f4a15' }}>
                                <div className="w-8 h-px" style={{ backgroundColor: '#c79f4a40' }} />
                                <span className="text-[6px] italic" style={{ color: '#c79f4a60', fontFamily: 'var(--font-body)' }}>
                                  also in: {(event.narrativeThreads ?? []).filter(s => s !== thread.slug).map(s =>
                                    NARRATIVE_THREADS.find(t => t.slug === s)?.title ?? s
                                  ).join(', ')}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Cross-column connections indicator */}
      {crossConnections.length > 0 && (
        <div className="shrink-0 px-4 py-2 border-t border-[var(--fintheon-border)]/10 flex items-center gap-2">
          <div className="w-6 h-px bg-[var(--fintheon-accent)]/30" />
          <span className="text-[7px] text-[var(--fintheon-accent)]/40" style={{ fontFamily: 'var(--font-mono)' }}>
            {crossConnections.length} shared events between these narratives
          </span>
        </div>
      )}
    </div>
  );
}
