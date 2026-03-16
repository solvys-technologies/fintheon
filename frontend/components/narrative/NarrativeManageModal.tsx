// [claude-code 2026-03-16] Narrative management modal — lane/catalyst overview with tag editing
import { useState, useCallback, useMemo } from 'react';
import { X, GripVertical, Archive, Pencil, ChevronDown, ChevronRight } from 'lucide-react';
import { useNarrative } from '../../contexts/NarrativeContext';
import type { NarrativeLane, CatalystCard } from '../../lib/narrative-types';

interface NarrativeManageModalProps {
  open: boolean;
  onClose: () => void;
}

export function NarrativeManageModal({ open, onClose }: NarrativeManageModalProps) {
  const { state, dispatch } = useNarrative();
  const [expandedLanes, setExpandedLanes] = useState<Set<string>>(new Set());
  const [editingLaneId, setEditingLaneId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [tagInput, setTagInput] = useState<Record<string, string>>({});
  const [isClosing, setIsClosing] = useState(false);

  const sortedLanes = useMemo(() =>
    [...state.lanes].sort((a, b) => a.order - b.order),
    [state.lanes],
  );

  const catalystsByLane = useMemo(() => {
    const map = new Map<string, CatalystCard[]>();
    for (const lane of state.lanes) {
      map.set(lane.id, state.catalysts.filter(c => c.narrativeIds.includes(lane.id)));
    }
    // Unattached catalysts
    const attached = new Set(state.catalysts.filter(c => c.narrativeIds.length > 0).map(c => c.id));
    const unattached = state.catalysts.filter(c => !attached.has(c.id));
    if (unattached.length > 0) map.set('__unattached__', unattached);
    return map;
  }, [state.lanes, state.catalysts]);

  const toggleLane = useCallback((id: string) => {
    setExpandedLanes(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => { setIsClosing(false); onClose(); }, 250);
  }, [onClose]);

  const startRename = useCallback((lane: NarrativeLane) => {
    setEditingLaneId(lane.id);
    setEditTitle(lane.title);
  }, []);

  const commitRename = useCallback(() => {
    if (editingLaneId && editTitle.trim()) {
      dispatch({ type: 'UPDATE_LANE', id: editingLaneId, updates: { title: editTitle.trim() } });
    }
    setEditingLaneId(null);
    setEditTitle('');
  }, [editingLaneId, editTitle, dispatch]);

  const archiveLane = useCallback((id: string) => {
    dispatch({ type: 'UPDATE_LANE', id, updates: { status: 'archived' } });
  }, [dispatch]);

  const moveLane = useCallback((idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= sortedLanes.length) return;
    const ids = sortedLanes.map(l => l.id);
    [ids[idx], ids[target]] = [ids[target], ids[idx]];
    dispatch({ type: 'REORDER_LANES', ids });
  }, [sortedLanes, dispatch]);

  const addTag = useCallback((catalystId: string) => {
    const raw = tagInput[catalystId]?.trim();
    if (!raw) return;
    const catalyst = state.catalysts.find(c => c.id === catalystId);
    if (!catalyst) return;
    const existing = catalyst.tags ?? [];
    if (!existing.includes(raw)) {
      dispatch({ type: 'TAG_CATALYST', catalystId, tags: [...existing, raw] });
    }
    setTagInput(prev => ({ ...prev, [catalystId]: '' }));
  }, [tagInput, state.catalysts, dispatch]);

  const removeTag = useCallback((catalystId: string, tag: string) => {
    const catalyst = state.catalysts.find(c => c.id === catalystId);
    if (!catalyst) return;
    dispatch({ type: 'TAG_CATALYST', catalystId, tags: (catalyst.tags ?? []).filter(t => t !== tag) });
  }, [state.catalysts, dispatch]);

  if (!open && !isClosing) return null;

  const renderCatalyst = (c: CatalystCard) => (
    <div
      key={c.id}
      className="flex flex-col gap-1 px-3 py-2 ml-6 border-l"
      style={{ borderColor: 'color-mix(in srgb, var(--fintheon-accent) 15%, transparent)' }}
    >
      <div className="flex items-center gap-2">
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: c.sentiment === 'bullish' ? 'var(--fintheon-bullish)' : 'var(--fintheon-bearish)' }}
        />
        <span className="text-xs truncate flex-1" style={{ color: 'var(--fintheon-text)' }}>
          {c.title}
        </span>
        <span className="text-[9px] font-mono" style={{ color: 'var(--fintheon-muted)' }}>
          {new Date(c.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {(c.tags ?? []).map(tag => (
          <span
            key={tag}
            className="text-[9px] px-1.5 py-0.5 rounded-full border inline-flex items-center gap-1 group"
            style={{
              color: 'var(--fintheon-accent)',
              backgroundColor: 'color-mix(in srgb, var(--fintheon-accent) 15%, transparent)',
              borderColor: 'color-mix(in srgb, var(--fintheon-accent) 20%, transparent)',
            }}
          >
            {tag}
            <button
              onClick={() => removeTag(c.id, tag)}
              className="opacity-50 hover:opacity-100 transition-opacity text-[8px] leading-none"
              style={{ color: 'var(--fintheon-accent)' }}
            >
              x
            </button>
          </span>
        ))}
        <div className="flex items-center gap-0.5">
          <input
            value={tagInput[c.id] ?? ''}
            onChange={e => setTagInput(prev => ({ ...prev, [c.id]: e.target.value }))}
            onKeyDown={e => { if (e.key === 'Enter') addTag(c.id); }}
            placeholder="add tag..."
            className="text-[9px] w-16 px-1 py-0.5 rounded border bg-transparent outline-none"
            style={{
              color: 'var(--fintheon-text)',
              borderColor: 'color-mix(in srgb, var(--fintheon-accent) 20%, transparent)',
            }}
          />
        </div>
      </div>
    </div>
  );

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm ${
        isClosing ? 'animate-fade-out-backdrop' : 'animate-fade-in-backdrop'
      }`}
      onClick={handleClose}
    >
      <div
        className={`w-full max-w-lg max-h-[80vh] flex flex-col rounded-lg border shadow-[0_0_40px_rgba(199,159,74,0.12)] ${
          isClosing ? 'animate-fade-out' : 'animate-fade-in'
        }`}
        style={{
          backgroundColor: 'color-mix(in srgb, var(--fintheon-surface) 90%, transparent)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderColor: 'color-mix(in srgb, var(--fintheon-accent) 20%, transparent)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <h2 className="text-sm font-bold" style={{ color: 'var(--fintheon-accent)' }}>
            Manage Narratives
          </h2>
          <button onClick={handleClose} className="p-1 hover:bg-white/5 rounded transition-all">
            <X className="w-4 h-4" style={{ color: 'var(--fintheon-muted)' }} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto py-2">
          {sortedLanes.map((lane, idx) => {
            const isExpanded = expandedLanes.has(lane.id);
            const catalysts = catalystsByLane.get(lane.id) ?? [];
            const isArchived = lane.status === 'archived';

            return (
              <div key={lane.id} className={isArchived ? 'opacity-50' : ''}>
                <div className="flex items-center gap-1.5 px-3 py-2 hover:bg-white/5 transition-colors">
                  {/* Reorder grip */}
                  <div className="flex flex-col gap-0.5">
                    <button onClick={() => moveLane(idx, -1)} disabled={idx === 0}
                      className="text-[8px] leading-none disabled:opacity-20" style={{ color: 'var(--fintheon-muted)' }}>
                      <GripVertical className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Expand toggle */}
                  <button onClick={() => toggleLane(lane.id)} className="p-0.5">
                    {isExpanded
                      ? <ChevronDown className="w-3 h-3" style={{ color: 'var(--fintheon-muted)' }} />
                      : <ChevronRight className="w-3 h-3" style={{ color: 'var(--fintheon-muted)' }} />}
                  </button>

                  {/* Lane color dot */}
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: lane.color || 'var(--fintheon-accent)' }} />

                  {/* Title or rename input */}
                  {editingLaneId === lane.id ? (
                    <input
                      value={editTitle}
                      onChange={e => setEditTitle(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditingLaneId(null); }}
                      onBlur={commitRename}
                      autoFocus
                      className="flex-1 text-xs bg-transparent outline-none border-b px-1"
                      style={{ color: 'var(--fintheon-text)', borderColor: 'var(--fintheon-accent)' }}
                    />
                  ) : (
                    <span className="flex-1 text-xs truncate" style={{ color: 'var(--fintheon-text)' }}>
                      {lane.title}
                    </span>
                  )}

                  {/* Catalyst count */}
                  <span className="text-[9px] font-mono" style={{ color: 'var(--fintheon-muted)' }}>
                    {catalysts.length}
                  </span>

                  {/* Actions */}
                  <button onClick={() => startRename(lane)} className="p-1 hover:bg-white/10 rounded" title="Rename">
                    <Pencil className="w-3 h-3" style={{ color: 'var(--fintheon-muted)' }} />
                  </button>
                  {!isArchived && (
                    <button onClick={() => archiveLane(lane.id)} className="p-1 hover:bg-white/10 rounded" title="Archive">
                      <Archive className="w-3 h-3" style={{ color: 'var(--fintheon-muted)' }} />
                    </button>
                  )}
                </div>

                {/* Expanded catalysts */}
                {isExpanded && catalysts.map(renderCatalyst)}
              </div>
            );
          })}

          {/* Unattached catalysts */}
          {catalystsByLane.has('__unattached__') && (
            <div className="mt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-2 px-3 py-2">
                <button onClick={() => toggleLane('__unattached__')} className="p-0.5">
                  {expandedLanes.has('__unattached__')
                    ? <ChevronDown className="w-3 h-3" style={{ color: 'var(--fintheon-muted)' }} />
                    : <ChevronRight className="w-3 h-3" style={{ color: 'var(--fintheon-muted)' }} />}
                </button>
                <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--fintheon-muted)' }}>
                  Unattached Catalysts
                </span>
                <span className="text-[9px] font-mono" style={{ color: 'var(--fintheon-muted)' }}>
                  {(catalystsByLane.get('__unattached__') ?? []).length}
                </span>
              </div>
              {expandedLanes.has('__unattached__') &&
                (catalystsByLane.get('__unattached__') ?? []).map(renderCatalyst)}
            </div>
          )}

          {state.lanes.length === 0 && state.catalysts.length === 0 && (
            <p className="text-center text-xs py-8" style={{ color: 'var(--fintheon-muted)' }}>
              No narratives or catalysts yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
