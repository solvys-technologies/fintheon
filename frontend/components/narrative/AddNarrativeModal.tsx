// [claude-code 2026-03-16] Full-featured Add/Edit Narrative modal with asset class multi-select
import { useState, useCallback, useMemo } from 'react';
import { X, ChevronDown, Check } from 'lucide-react';
import type {
  NarrativeCategory, DirectionBias, NarrativeStatus, NarrativeLane,
} from '../../lib/narrative-types';
import { ASSET_CLASSES } from '../../lib/narrative-types';

interface AddNarrativeModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (lane: Omit<NarrativeLane, 'id' | 'createdAt' | 'updatedAt'>) => void;
  editLane?: NarrativeLane | null;
}

const CATEGORIES: { value: NarrativeCategory; label: string }[] = [
  { value: 'macroeconomic', label: 'Macroeconomic' },
  { value: 'monetary', label: 'Monetary Policy' },
  { value: 'geopolitical', label: 'Geopolitical' },
  { value: 'earnings', label: 'Earnings' },
  { value: 'market-structure', label: 'Market Structure' },
  { value: 'supply-chain', label: 'Supply Chain' },
  { value: 'black-swan', label: 'Black Swan' },
];

const DIRECTIONS: { value: DirectionBias; label: string; color: string }[] = [
  { value: 'long', label: 'Long', color: 'var(--fintheon-bullish)' },
  { value: 'short', label: 'Short', color: 'var(--fintheon-bearish)' },
  { value: 'neutral', label: 'Neutral', color: 'var(--fintheon-muted)' },
];

const STATUSES: { value: NarrativeStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'watching', label: 'Watching' },
  { value: 'archived', label: 'Archived' },
];

export function AddNarrativeModal({ open, onClose, onSubmit, editLane }: AddNarrativeModalProps) {
  const isEdit = !!editLane;

  const [title, setTitle] = useState(editLane?.title ?? '');
  const [description, setDescription] = useState(editLane?.description ?? '');
  const [selectedInstruments, setSelectedInstruments] = useState<Set<string>>(
    new Set(editLane?.instruments ?? []),
  );
  const [direction, setDirection] = useState<DirectionBias>(editLane?.directionBias ?? 'neutral');
  const [category, setCategory] = useState<NarrativeCategory>(editLane?.category ?? 'macroeconomic');
  const [status, setStatus] = useState<NarrativeStatus>(editLane?.status ?? 'active');
  const [tags, setTags] = useState(editLane?.tags?.join(', ') ?? '');
  const [customInstrument, setCustomInstrument] = useState('');
  const [expandedClass, setExpandedClass] = useState<string | null>(null);

  // Reset when editLane changes
  const resetForm = useCallback(() => {
    setTitle(editLane?.title ?? '');
    setDescription(editLane?.description ?? '');
    setSelectedInstruments(new Set(editLane?.instruments ?? []));
    setDirection(editLane?.directionBias ?? 'neutral');
    setCategory(editLane?.category ?? 'macroeconomic');
    setStatus(editLane?.status ?? 'active');
    setTags(editLane?.tags?.join(', ') ?? '');
    setCustomInstrument('');
    setExpandedClass(null);
  }, [editLane]);

  const toggleInstrument = useCallback((inst: string) => {
    setSelectedInstruments(prev => {
      const next = new Set(prev);
      next.has(inst) ? next.delete(inst) : next.add(inst);
      return next;
    });
  }, []);

  const toggleAssetClass = useCallback((className: string) => {
    const instruments = ASSET_CLASSES[className];
    setSelectedInstruments(prev => {
      const next = new Set(prev);
      const allSelected = instruments.every(i => next.has(i));
      if (allSelected) {
        instruments.forEach(i => next.delete(i));
      } else {
        instruments.forEach(i => next.add(i));
      }
      return next;
    });
  }, []);

  const addCustomInstrument = useCallback(() => {
    const trimmed = customInstrument.trim().toUpperCase();
    if (!trimmed) return;
    setSelectedInstruments(prev => new Set([...prev, trimmed]));
    setCustomInstrument('');
  }, [customInstrument]);

  const handleSubmit = useCallback(() => {
    if (!title.trim()) return;
    const parsedTags = tags.split(',').map(t => t.trim()).filter(Boolean);
    onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      instruments: [...selectedInstruments],
      directionBias: direction,
      category,
      status,
      dateRange: editLane?.dateRange ?? { start: new Date().toISOString(), end: null },
      healthScore: editLane?.healthScore ?? 100,
      intensity: editLane?.intensity,
      color: editLane?.color ?? 'var(--fintheon-accent)',
      order: editLane?.order ?? 0,
      parentId: editLane?.parentId ?? null,
      forkDate: editLane?.forkDate ?? null,
      decayWeeks: editLane?.decayWeeks ?? 0,
      tags: parsedTags.length > 0 ? parsedTags : undefined,
    });
    resetForm();
    onClose();
  }, [title, description, selectedInstruments, direction, category, status, tags, editLane, onSubmit, onClose, resetForm]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-[520px] max-h-[85vh] overflow-y-auto rounded-xl border border-[var(--fintheon-border)]/30 shadow-2xl"
        style={{ backgroundColor: 'var(--fintheon-surface)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--fintheon-border)]/20">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--fintheon-text)' }}>
            {isEdit ? 'Edit Narrative' : 'Add Narrative'}
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--fintheon-accent)]/10">
            <X className="w-4 h-4 text-[var(--fintheon-muted)]" />
          </button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-4">
          {/* Title */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[var(--fintheon-muted)] mb-1">Title</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g., Fed Rate Cut Cycle Q2"
              autoFocus
              className="w-full px-3 py-2 rounded-lg text-xs bg-[var(--fintheon-bg)] border border-[var(--fintheon-border)]/20 text-[var(--fintheon-text)] outline-none focus:border-[var(--fintheon-accent)]/40"
              onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[var(--fintheon-muted)] mb-1">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Thesis, rationale, key levels..."
              rows={2}
              className="w-full px-3 py-2 rounded-lg text-xs bg-[var(--fintheon-bg)] border border-[var(--fintheon-border)]/20 text-[var(--fintheon-text)] outline-none focus:border-[var(--fintheon-accent)]/40 resize-none"
            />
          </div>

          {/* Direction + Category + Status row */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-[var(--fintheon-muted)] mb-1">Direction</label>
              <div className="flex rounded-lg border border-[var(--fintheon-border)]/20 overflow-hidden">
                {DIRECTIONS.map(d => (
                  <button
                    key={d.value}
                    onClick={() => setDirection(d.value)}
                    className={`flex-1 py-1.5 text-[10px] font-medium transition-colors ${
                      direction === d.value ? 'bg-[var(--fintheon-accent)]/15' : 'hover:bg-[var(--fintheon-accent)]/5'
                    }`}
                    style={{ color: direction === d.value ? d.color : 'var(--fintheon-muted)' }}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-[var(--fintheon-muted)] mb-1">Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value as NarrativeCategory)}
                className="w-full px-2 py-1.5 rounded-lg text-[10px] bg-[var(--fintheon-bg)] border border-[var(--fintheon-border)]/20 text-[var(--fintheon-text)] outline-none"
              >
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-[var(--fintheon-muted)] mb-1">Status</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as NarrativeStatus)}
                className="w-full px-2 py-1.5 rounded-lg text-[10px] bg-[var(--fintheon-bg)] border border-[var(--fintheon-border)]/20 text-[var(--fintheon-text)] outline-none"
              >
                {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>

          {/* Instruments — asset class multi-select */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[var(--fintheon-muted)] mb-1">
              Instruments ({selectedInstruments.size} selected)
            </label>

            {/* Selected chips */}
            {selectedInstruments.size > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {[...selectedInstruments].map(inst => (
                  <button
                    key={inst}
                    onClick={() => toggleInstrument(inst)}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono bg-[var(--fintheon-accent)]/12 text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/25 transition-colors"
                  >
                    {inst}
                    <X className="w-2.5 h-2.5" />
                  </button>
                ))}
              </div>
            )}

            {/* Asset class accordion */}
            <div className="border border-[var(--fintheon-border)]/15 rounded-lg overflow-hidden max-h-[180px] overflow-y-auto scrollbar-thin">
              {Object.entries(ASSET_CLASSES).map(([className, instruments]) => {
                const allChecked = instruments.every(i => selectedInstruments.has(i));
                const someChecked = instruments.some(i => selectedInstruments.has(i));
                const isExpanded = expandedClass === className;

                return (
                  <div key={className}>
                    <button
                      onClick={() => setExpandedClass(isExpanded ? null : className)}
                      className="flex items-center gap-2 w-full px-3 py-1.5 text-left text-[10px] hover:bg-[var(--fintheon-accent)]/5 transition-colors"
                    >
                      {/* Class-level checkbox */}
                      <span
                        onClick={(e) => { e.stopPropagation(); toggleAssetClass(className); }}
                        className="w-3.5 h-3.5 rounded border flex items-center justify-center cursor-pointer shrink-0"
                        style={{
                          borderColor: allChecked ? 'var(--fintheon-accent)' : 'var(--fintheon-border)',
                          backgroundColor: allChecked ? 'var(--fintheon-accent)' : someChecked ? 'color-mix(in srgb, var(--fintheon-accent) 30%, transparent)' : 'transparent',
                        }}
                      >
                        {(allChecked || someChecked) && <Check className="w-2.5 h-2.5 text-[var(--fintheon-bg)]" />}
                      </span>
                      <span className="flex-1 font-medium text-[var(--fintheon-text)]">{className}</span>
                      <span className="text-[8px] text-[var(--fintheon-muted)]">{instruments.length}</span>
                      <ChevronDown className={`w-3 h-3 text-[var(--fintheon-muted)] transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>

                    {isExpanded && (
                      <div className="flex flex-wrap gap-1 px-3 pb-2 pt-0.5">
                        {instruments.map(inst => {
                          const checked = selectedInstruments.has(inst);
                          return (
                            <button
                              key={inst}
                              onClick={() => toggleInstrument(inst)}
                              className={`px-1.5 py-0.5 rounded text-[9px] font-mono transition-colors ${
                                checked
                                  ? 'bg-[var(--fintheon-accent)]/15 text-[var(--fintheon-accent)]'
                                  : 'bg-[var(--fintheon-bg)] text-[var(--fintheon-muted)] hover:text-[var(--fintheon-text)]'
                              }`}
                            >
                              {inst}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Custom instrument input */}
            <div className="flex gap-1.5 mt-1.5">
              <input
                value={customInstrument}
                onChange={e => setCustomInstrument(e.target.value)}
                placeholder="Custom ticker..."
                className="flex-1 px-2 py-1 rounded text-[10px] bg-[var(--fintheon-bg)] border border-[var(--fintheon-border)]/15 text-[var(--fintheon-text)] outline-none font-mono"
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomInstrument(); } }}
              />
              <button
                onClick={addCustomInstrument}
                className="px-2 py-1 rounded text-[9px] font-medium text-[var(--fintheon-accent)] bg-[var(--fintheon-accent)]/10 hover:bg-[var(--fintheon-accent)]/20 transition-colors"
              >
                Add
              </button>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[var(--fintheon-muted)] mb-1">Tags</label>
            <input
              value={tags}
              onChange={e => setTags(e.target.value)}
              placeholder="e.g., dovish, rate-sensitive, Q2-catalyst"
              className="w-full px-3 py-2 rounded-lg text-xs bg-[var(--fintheon-bg)] border border-[var(--fintheon-border)]/20 text-[var(--fintheon-text)] outline-none focus:border-[var(--fintheon-accent)]/40"
            />
            <p className="text-[8px] text-[var(--fintheon-muted)]/50 mt-0.5">Comma-separated</p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--fintheon-border)]/15">
          <button
            onClick={() => { resetForm(); onClose(); }}
            className="px-3 py-1.5 rounded-lg text-xs text-[var(--fintheon-muted)] hover:text-[var(--fintheon-text)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim()}
            className="px-4 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-30 bg-[var(--fintheon-accent)]/15 text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/25"
          >
            {isEdit ? 'Save Changes' : 'Add Narrative'}
          </button>
        </div>
      </div>
    </div>
  );
}
