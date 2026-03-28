// [claude-code 2026-03-28] S7: Elegant chronological timeline panel for NarrativeFlow events
import { useState, useMemo, useCallback } from 'react';
import { Plus, ChevronDown, ChevronRight } from 'lucide-react';
import { useNarrative } from '../../contexts/NarrativeContext';
import type { CatalystCard, NarrativeCategory } from '../../lib/narrative-types';

const CATEGORY_COLORS: Record<NarrativeCategory, string> = {
  geopolitical: '#F59E0B',
  monetary: '#8B5CF6',
  macroeconomic: '#3B82F6',
  'market-structure': '#EC4899',
  earnings: '#34D399',
  'supply-chain': '#14B8A6',
  'black-swan': '#EF4444',
};

const SEVERITY_DOT: Record<string, string> = {
  high: '#EF4444',
  medium: '#c79f4a',
  low: '#6B7280',
};

function formatDateHeader(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function groupByDate(catalysts: CatalystCard[]): [string, CatalystCard[]][] {
  const map = new Map<string, CatalystCard[]>();
  for (const c of catalysts) {
    const key = c.date?.slice(0, 10) ?? 'unknown';
    const arr = map.get(key) ?? [];
    arr.push(c);
    map.set(key, arr);
  }
  return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
}

interface InlineEditState {
  id: string;
  field: 'title' | 'description' | 'tags';
  value: string;
}

export function TimelinePanel() {
  const { state, dispatch } = useNarrative();
  const [collapsedDates, setCollapsedDates] = useState<Set<string>>(new Set());
  const [editState, setEditState] = useState<InlineEditState | null>(null);
  const [filterCategory, setFilterCategory] = useState<NarrativeCategory | 'all'>('all');

  const filteredCatalysts = useMemo(() => {
    let cards = state.catalysts.filter(c => c.drillDepth === 0);
    if (filterCategory !== 'all') {
      cards = cards.filter(c => c.category === filterCategory);
    }
    return cards.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
  }, [state.catalysts, filterCategory]);

  const dateGroups = useMemo(() => groupByDate(filteredCatalysts), [filteredCatalysts]);

  const toggleDate = useCallback((date: string) => {
    setCollapsedDates(prev => {
      const next = new Set(prev);
      next.has(date) ? next.delete(date) : next.add(date);
      return next;
    });
  }, []);

  const startEdit = useCallback((id: string, field: 'title' | 'description' | 'tags', currentValue: string) => {
    setEditState({ id, field, value: currentValue });
  }, []);

  const commitEdit = useCallback(() => {
    if (!editState) return;
    const { id, field, value } = editState;
    if (field === 'tags') {
      const newTags = value.split(',').map(t => t.trim()).filter(Boolean);
      dispatch({ type: 'UPDATE_CATALYST', id, updates: { tags: newTags } });
    } else {
      dispatch({ type: 'UPDATE_CATALYST', id, updates: { [field]: value } });
    }
    setEditState(null);
  }, [editState, dispatch]);

  const handleAddNew = useCallback(() => {
    dispatch({
      type: 'ADD_CATALYST',
      catalyst: {
        title: 'New Event',
        description: '',
        date: new Date().toISOString().slice(0, 10),
        sentiment: 'bearish',
        severity: 'medium',
        source: 'user',
        narrativeIds: [],
        isGhost: false,
        templateType: null,
        position: null,
        tags: [],
        category: 'macroeconomic',
        drillDepth: 0,
      },
    });
  }, [dispatch]);

  return (
    <div className="h-full flex flex-col bg-[var(--fintheon-bg)]">
      {/* Header */}
      <div className="shrink-0 px-5 py-4 border-b border-[var(--fintheon-border)]/10">
        <h2 className="text-sm font-bold text-[var(--fintheon-accent)] uppercase tracking-widest"
          style={{ fontFamily: 'var(--font-heading)' }}>
          Timeline
        </h2>
        <p className="text-[9px] text-[var(--fintheon-muted)]/40 mt-1">
          Your narrative timeline. Click any event to edit inline.
        </p>

        {/* Category filter */}
        <div className="flex flex-wrap gap-1 mt-3">
          <button
            onClick={() => setFilterCategory('all')}
            className={`text-[8px] px-2 py-0.5 rounded-full border transition-colors ${
              filterCategory === 'all'
                ? 'text-[var(--fintheon-accent)] border-[var(--fintheon-accent)]/30 bg-[var(--fintheon-accent)]/10'
                : 'text-[var(--fintheon-muted)]/40 border-transparent hover:text-[var(--fintheon-text)]/60'
            }`}
          >
            All ({filteredCatalysts.length})
          </button>
          {(Object.keys(CATEGORY_COLORS) as NarrativeCategory[]).map(cat => {
            const count = state.catalysts.filter(c => c.category === cat && c.drillDepth === 0).length;
            if (count === 0) return null;
            return (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`text-[8px] px-2 py-0.5 rounded-full border transition-colors ${
                  filterCategory === cat
                    ? 'border-current bg-current/10'
                    : 'border-transparent hover:border-current/20'
                }`}
                style={{ color: CATEGORY_COLORS[cat] }}
              >
                {cat.replace('-', ' ')} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Timeline body */}
      <div className="flex-1 overflow-y-auto px-5 py-3">
        {dateGroups.length === 0 && (
          <div className="text-center py-12">
            <p className="text-[10px] text-[var(--fintheon-muted)]/40">No events to display</p>
          </div>
        )}

        {dateGroups.map(([date, events]) => {
          const isCollapsed = collapsedDates.has(date);
          return (
            <div key={date} className="mb-4">
              {/* Date header */}
              <button
                onClick={() => toggleDate(date)}
                className="flex items-center gap-2 w-full text-left mb-2 group"
              >
                {isCollapsed
                  ? <ChevronRight className="w-3 h-3 text-[var(--fintheon-muted)]/30" />
                  : <ChevronDown className="w-3 h-3 text-[var(--fintheon-muted)]/30" />
                }
                <span className="text-[10px] font-bold text-[var(--fintheon-accent)]/60 uppercase tracking-wider">
                  {formatDateHeader(date)}
                </span>
                <div className="flex-1 h-px bg-[var(--fintheon-border)]/10" />
                <span className="text-[8px] text-[var(--fintheon-muted)]/30">{events.length}</span>
              </button>

              {/* Events */}
              {!isCollapsed && (
                <div className="ml-3 border-l border-[var(--fintheon-border)]/10 pl-4 space-y-2">
                  {events.map(event => (
                    <div
                      key={event.id}
                      className="relative rounded-lg border px-3 py-2 transition-colors hover:border-[var(--fintheon-accent)]/20 group/card"
                      style={{
                        borderColor: 'color-mix(in srgb, var(--fintheon-border) 15%, transparent)',
                        backgroundColor: 'color-mix(in srgb, var(--fintheon-surface) 40%, transparent)',
                      }}
                    >
                      {/* Timeline dot */}
                      <div
                        className="absolute -left-[21px] top-3 w-2.5 h-2.5 rounded-full border-2 border-[var(--fintheon-bg)]"
                        style={{ backgroundColor: SEVERITY_DOT[event.severity] ?? '#6B7280' }}
                      />

                      {/* Title — inline editable */}
                      <div className="flex items-start gap-2">
                        {editState?.id === event.id && editState.field === 'title' ? (
                          <input
                            autoFocus
                            value={editState.value}
                            onChange={e => setEditState({ ...editState, value: e.target.value })}
                            onBlur={commitEdit}
                            onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditState(null); }}
                            className="flex-1 text-[11px] font-semibold bg-transparent border-b border-[var(--fintheon-accent)]/30 outline-none px-0 py-0"
                            style={{ color: 'var(--fintheon-text)' }}
                          />
                        ) : (
                          <p
                            className="flex-1 text-[11px] font-semibold cursor-text"
                            style={{ color: 'var(--fintheon-text)' }}
                            onClick={() => startEdit(event.id, 'title', event.title)}
                          >
                            {event.title}
                          </p>
                        )}

                        {/* Sentiment arrow */}
                        <span className={`text-[9px] font-bold ${event.sentiment === 'bullish' ? 'text-green-400' : 'text-red-400'}`}>
                          {event.sentiment === 'bullish' ? '▲' : '▼'}
                        </span>
                      </div>

                      {/* Description — inline editable */}
                      {editState?.id === event.id && editState.field === 'description' ? (
                        <textarea
                          autoFocus
                          value={editState.value}
                          onChange={e => setEditState({ ...editState, value: e.target.value })}
                          onBlur={commitEdit}
                          rows={2}
                          className="w-full mt-1 text-[9px] bg-transparent border border-[var(--fintheon-accent)]/20 rounded outline-none px-1 py-0.5 resize-none"
                          style={{ color: 'var(--fintheon-muted)' }}
                        />
                      ) : event.description ? (
                        <p
                          className="text-[9px] mt-0.5 line-clamp-2 cursor-text"
                          style={{ color: 'var(--fintheon-muted)' }}
                          onClick={() => startEdit(event.id, 'description', event.description ?? '')}
                        >
                          {event.description}
                        </p>
                      ) : null}

                      {/* Meta row */}
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span
                          className="text-[7px] px-1.5 py-0.5 rounded-full font-medium uppercase"
                          style={{
                            color: CATEGORY_COLORS[(event.category ?? 'macroeconomic') as NarrativeCategory],
                            backgroundColor: `${CATEGORY_COLORS[(event.category ?? 'macroeconomic') as NarrativeCategory]}20`,
                          }}
                        >
                          {event.category ?? 'macro'}
                        </span>
                        <span className="text-[7px] font-mono text-[var(--fintheon-muted)]/30">
                          {event.severity}
                        </span>
                        {event.tags && event.tags.length > 0 && (
                          <div className="flex gap-0.5">
                            {event.tags.slice(0, 3).map(t => (
                              <span key={t} className="text-[6px] px-1 py-0.5 rounded bg-[var(--fintheon-accent)]/5 text-[var(--fintheon-accent)]/40">
                                {t}
                              </span>
                            ))}
                            {event.tags.length > 3 && (
                              <span className="text-[6px] text-[var(--fintheon-muted)]/20">+{event.tags.length - 3}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add button */}
      <div className="shrink-0 px-5 py-3 border-t border-[var(--fintheon-border)]/10">
        <button
          onClick={handleAddNew}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed transition-colors hover:bg-[var(--fintheon-accent)]/5"
          style={{ borderColor: 'color-mix(in srgb, var(--fintheon-accent) 20%, transparent)', color: 'var(--fintheon-accent)' }}
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="text-[10px] font-medium">Add Event</span>
        </button>
      </div>
    </div>
  );
}
