// [claude-code 2026-03-27] S2-T7: Commentator manager — drag-and-drop ranked list with add/seed
import { useState, useCallback } from 'react';
import { GripVertical, Users, Plus, ChevronDown, ChevronUp, Trash2, Pencil, Sprout } from 'lucide-react';
import type { CommentatorEntry, CommentatorTier } from '../../../backend-hono/src/types/commentator';
import { TIER_DEFAULT_MULTIPLIERS } from '../../../backend-hono/src/types/commentator';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8080').replace(/\/$/, '');

interface CommentatorManagerProps {
  registry: CommentatorEntry[];
  onRegistryChanged: () => void;
}

const TIER_BADGE: Record<CommentatorTier, { label: string; color: string }> = {
  1: { label: 'T1', color: 'text-[var(--fintheon-accent)] border-[var(--fintheon-accent)]/30' },
  2: { label: 'T2', color: 'text-cyan-400 border-cyan-400/30' },
  3: { label: 'T3', color: 'text-zinc-400 border-zinc-400/30' },
};

export function CommentatorManager({ registry, onRegistryChanged }: CommentatorManagerProps) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  // Add form state
  const [addName, setAddName] = useState('');
  const [addAliases, setAddAliases] = useState('');
  const [addTier, setAddTier] = useState<CommentatorTier>(2);
  const [addRole, setAddRole] = useState('');
  const [addInstitution, setAddInstitution] = useState('');
  const [addSubmitting, setAddSubmitting] = useState(false);

  // Inline edit state
  const [editName, setEditName] = useState('');
  const [editTier, setEditTier] = useState<CommentatorTier>(2);
  const [editRole, setEditRole] = useState('');
  const [editAliases, setEditAliases] = useState('');

  const sorted = [...registry].filter((e) => e.active).sort((a, b) => a.rank - b.rank);

  // Drag-and-drop handlers (same pattern as NavSidebar)
  const handleDragStart = useCallback((e: React.DragEvent, idx: number) => {
    e.dataTransfer.setData('text/plain', String(idx));
    e.dataTransfer.effectAllowed = 'move';
    setDragIdx(idx);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    const sourceIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
    setDragIdx(null);
    if (isNaN(sourceIdx) || sourceIdx === targetIdx) return;

    // Reorder locally
    const reordered = [...sorted];
    const [moved] = reordered.splice(sourceIdx, 1);
    reordered.splice(targetIdx, 0, moved);
    const orderedIds = reordered.map((e) => e.id);

    try {
      await fetch(`${API_BASE}/api/commentator/reorder`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderedIds }) }).then(r => r.json());
      onRegistryChanged();
    } catch (err) {
      console.error('[CommentatorManager] Reorder failed:', err);
    }
  }, [sorted, onRegistryChanged]);

  const handleDragEnd = useCallback(() => setDragIdx(null), []);

  const handleAdd = async () => {
    if (!addName.trim()) return;
    setAddSubmitting(true);
    try {
      await fetch(`${API_BASE}/api/commentator`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: addName.trim(),
          aliases: addAliases.split(',').map((a) => a.trim()).filter(Boolean),
          tier: addTier,
          role: addRole.trim() || undefined,
          institution: addInstitution.trim() || undefined,
          weightMultiplier: TIER_DEFAULT_MULTIPLIERS[addTier],
        }),
      }).then(r => r.json());
      setAddName('');
      setAddAliases('');
      setAddTier(2);
      setAddRole('');
      setAddInstitution('');
      setShowAdd(false);
      onRegistryChanged();
    } catch (err) {
      console.error('[CommentatorManager] Add failed:', err);
    } finally {
      setAddSubmitting(false);
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await fetch(`${API_BASE}/api/commentator/${id}`, { method: 'DELETE' }).then(r => r.json());
      onRegistryChanged();
    } catch (err) {
      console.error('[CommentatorManager] Remove failed:', err);
    }
  };

  const startEdit = (entry: CommentatorEntry) => {
    setEditingId(entry.id);
    setEditName(entry.name);
    setEditTier(entry.tier);
    setEditRole(entry.role ?? '');
    setEditAliases(entry.aliases.join(', '));
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    try {
      await fetch(`${API_BASE}/api/commentator/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          aliases: editAliases.split(',').map((a) => a.trim()).filter(Boolean),
          tier: editTier,
          role: editRole.trim() || undefined,
          weightMultiplier: TIER_DEFAULT_MULTIPLIERS[editTier],
        }),
      }).then(r => r.json());
      setEditingId(null);
      onRegistryChanged();
    } catch (err) {
      console.error('[CommentatorManager] Edit failed:', err);
    }
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await fetch(`${API_BASE}/api/commentator/seed`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) }).then(r => r.json());
      onRegistryChanged();
    } catch (err) {
      console.error('[CommentatorManager] Seed failed:', err);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] font-semibold text-[var(--fintheon-text)]/70 uppercase tracking-wider">
          <Users className="w-3.5 h-3.5 text-[var(--fintheon-accent)]" />
          Persons of Interest Ranking
        </div>
        <button
          onClick={handleSeed}
          disabled={seeding}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] border border-zinc-700 text-zinc-500 hover:text-[var(--fintheon-accent)] hover:border-[var(--fintheon-accent)]/30 transition-colors disabled:opacity-50"
          title="Seed default persons of interest (idempotent)"
        >
          <Sprout className="w-2.5 h-2.5" />
          {seeding ? 'Seeding...' : 'Seed Defaults'}
        </button>
      </div>

      {/* Ranked list */}
      <div className="space-y-0.5 max-h-[280px] overflow-y-auto">
        {sorted.map((entry, idx) => {
          const tier = TIER_BADGE[entry.tier] ?? TIER_BADGE[3];
          const isEditing = editingId === entry.id;

          if (isEditing) {
            return (
              <div key={entry.id} className="p-2 rounded border border-[var(--fintheon-accent)]/20 bg-[var(--fintheon-accent)]/5 space-y-1.5">
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-transparent border border-zinc-700 rounded px-2 py-0.5 text-[10px] text-[var(--fintheon-text)] focus:border-[var(--fintheon-accent)]/50 outline-none"
                  placeholder="Name"
                />
                <input
                  value={editAliases}
                  onChange={(e) => setEditAliases(e.target.value)}
                  className="w-full bg-transparent border border-zinc-700 rounded px-2 py-0.5 text-[10px] text-zinc-400 focus:border-[var(--fintheon-accent)]/50 outline-none"
                  placeholder="Aliases (comma-separated)"
                />
                <div className="flex gap-1.5">
                  <select
                    value={editTier}
                    onChange={(e) => setEditTier(Number(e.target.value) as CommentatorTier)}
                    className="bg-transparent border border-zinc-700 rounded px-1.5 py-0.5 text-[10px] text-zinc-400 outline-none"
                  >
                    <option value={1}>Tier 1</option>
                    <option value={2}>Tier 2</option>
                    <option value={3}>Tier 3</option>
                  </select>
                  <input
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    className="flex-1 bg-transparent border border-zinc-700 rounded px-2 py-0.5 text-[10px] text-zinc-400 focus:border-[var(--fintheon-accent)]/50 outline-none"
                    placeholder="Role"
                  />
                </div>
                <div className="flex gap-1.5">
                  <button onClick={handleSaveEdit} className="px-2 py-0.5 rounded text-[9px] bg-[var(--fintheon-accent)]/20 text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/30 transition-colors">
                    Save
                  </button>
                  <button onClick={() => setEditingId(null)} className="px-2 py-0.5 rounded text-[9px] text-zinc-500 hover:text-zinc-300 transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div
              key={entry.id}
              draggable
              onDragStart={(e) => handleDragStart(e, idx)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, idx)}
              onDragEnd={handleDragEnd}
              className={`flex items-center gap-1.5 px-1.5 py-1 rounded group transition-colors ${
                dragIdx === idx ? 'opacity-50 bg-[var(--fintheon-accent)]/5' : 'hover:bg-zinc-800/30'
              }`}
            >
              <div className="cursor-grab active:cursor-grabbing touch-none shrink-0 text-zinc-600 hover:text-zinc-400">
                <GripVertical className="w-3 h-3" />
              </div>
              <span className="text-[9px] text-zinc-600 w-4 text-right font-mono shrink-0">
                {idx + 1}.
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-semibold text-[var(--fintheon-text)] truncate">
                  {entry.name}
                </div>
                <div className="text-[8px] text-zinc-500 truncate">
                  {entry.role}{entry.institution ? ` \u2014 ${entry.institution}` : ''}
                </div>
              </div>
              <span className={`text-[8px] font-bold px-1 py-px rounded border shrink-0 ${tier.color}`}>
                {tier.label} {entry.weightMultiplier}x
              </span>
              <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                <button onClick={() => startEdit(entry)} className="p-0.5 text-zinc-600 hover:text-[var(--fintheon-accent)] transition-colors">
                  <Pencil className="w-2.5 h-2.5" />
                </button>
                <button onClick={() => handleRemove(entry.id)} className="p-0.5 text-zinc-600 hover:text-red-400 transition-colors">
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              </div>
            </div>
          );
        })}

        {sorted.length === 0 && (
          <div className="text-[10px] text-zinc-600 text-center py-4">
            No persons of interest. Click "Seed Defaults" to populate.
          </div>
        )}
      </div>

      {/* Add form toggle */}
      <button
        onClick={() => setShowAdd(!showAdd)}
        className="flex items-center gap-1.5 text-[10px] text-zinc-500 hover:text-[var(--fintheon-accent)] transition-colors"
      >
        <Plus className="w-3 h-3" />
        Add Official
        {showAdd ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {showAdd && (
        <div className="space-y-1.5 p-2 rounded border border-zinc-800 bg-zinc-900/50">
          <input
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            className="w-full bg-transparent border border-zinc-700 rounded px-2 py-1 text-[10px] text-[var(--fintheon-text)] focus:border-[var(--fintheon-accent)]/50 outline-none"
            placeholder="Name"
          />
          <input
            value={addAliases}
            onChange={(e) => setAddAliases(e.target.value)}
            className="w-full bg-transparent border border-zinc-700 rounded px-2 py-1 text-[10px] text-zinc-400 focus:border-[var(--fintheon-accent)]/50 outline-none"
            placeholder="Aliases (comma-separated)"
          />
          <div className="flex gap-1.5">
            <select
              value={addTier}
              onChange={(e) => setAddTier(Number(e.target.value) as CommentatorTier)}
              className="bg-transparent border border-zinc-700 rounded px-1.5 py-1 text-[10px] text-zinc-400 outline-none"
            >
              <option value={1}>Tier 1</option>
              <option value={2}>Tier 2</option>
              <option value={3}>Tier 3</option>
            </select>
            <input
              value={addRole}
              onChange={(e) => setAddRole(e.target.value)}
              className="flex-1 bg-transparent border border-zinc-700 rounded px-2 py-1 text-[10px] text-zinc-400 focus:border-[var(--fintheon-accent)]/50 outline-none"
              placeholder="Role"
            />
          </div>
          <input
            value={addInstitution}
            onChange={(e) => setAddInstitution(e.target.value)}
            className="w-full bg-transparent border border-zinc-700 rounded px-2 py-1 text-[10px] text-zinc-400 focus:border-[var(--fintheon-accent)]/50 outline-none"
            placeholder="Institution"
          />
          <button
            onClick={handleAdd}
            disabled={!addName.trim() || addSubmitting}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-[var(--fintheon-accent)]/30 text-[10px] text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {addSubmitting ? 'Adding...' : 'Add to Bottom'}
          </button>
        </div>
      )}
    </div>
  );
}
