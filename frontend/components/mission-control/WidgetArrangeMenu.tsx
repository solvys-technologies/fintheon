// [claude-code 2026-03-11] Track 4: Gear menu for reordering + toggling MC widget visibility
import { useState, useRef, useEffect } from 'react';
import { Settings, ChevronUp, ChevronDown, Eye, EyeOff } from 'lucide-react';
import type { MissionWidgetId } from '../../lib/layoutOrderStorage';

interface WidgetEntry {
  id: MissionWidgetId;
  label: string;
}

interface WidgetArrangeMenuProps {
  widgets: WidgetEntry[];
  visibility: Record<MissionWidgetId, boolean>;
  onReorder: (order: MissionWidgetId[]) => void;
  onToggleVisibility: (id: MissionWidgetId) => void;
}

export function WidgetArrangeMenu({ widgets, visibility, onReorder, onToggleVisibility }: WidgetArrangeMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const moveUp = (idx: number) => {
    if (idx <= 0) return;
    const next = widgets.map((w) => w.id);
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    onReorder(next);
  };

  const moveDown = (idx: number) => {
    if (idx >= widgets.length - 1) return;
    const next = widgets.map((w) => w.id);
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    onReorder(next);
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="p-1 hover:bg-[var(--fintheon-accent)]/10 rounded transition-colors"
        title="Arrange widgets"
      >
        <Settings className="w-3.5 h-3.5 text-[var(--fintheon-accent)]/60 hover:text-[var(--fintheon-accent)]" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-56 bg-[#0c0a06] border border-[var(--fintheon-accent)]/20 rounded-lg shadow-xl py-1">
          <div className="px-3 py-1.5 text-[9px] tracking-[0.18em] uppercase text-zinc-500 border-b border-[var(--fintheon-accent)]/10">
            Widget Layout
          </div>
          {widgets.map((w, idx) => {
            const visible = visibility[w.id] !== false;
            return (
              <div
                key={w.id}
                className="flex items-center gap-1 px-2 py-1.5 hover:bg-[var(--fintheon-accent)]/5 transition-colors"
              >
                {/* Up / Down */}
                <button
                  onClick={() => moveUp(idx)}
                  disabled={idx === 0}
                  className="p-0.5 rounded hover:bg-[var(--fintheon-accent)]/10 disabled:opacity-20 disabled:cursor-default"
                  title="Move up"
                >
                  <ChevronUp className="w-3 h-3 text-zinc-400" />
                </button>
                <button
                  onClick={() => moveDown(idx)}
                  disabled={idx === widgets.length - 1}
                  className="p-0.5 rounded hover:bg-[var(--fintheon-accent)]/10 disabled:opacity-20 disabled:cursor-default"
                  title="Move down"
                >
                  <ChevronDown className="w-3 h-3 text-zinc-400" />
                </button>

                {/* Label */}
                <span className={`flex-1 text-[11px] truncate ${visible ? 'text-zinc-300' : 'text-zinc-600'}`}>
                  {w.label}
                </span>

                {/* Visibility toggle */}
                <button
                  onClick={() => onToggleVisibility(w.id)}
                  className="p-0.5 rounded hover:bg-[var(--fintheon-accent)]/10"
                  title={visible ? 'Hide widget' : 'Show widget'}
                >
                  {visible ? (
                    <Eye className="w-3.5 h-3.5 text-[var(--fintheon-accent)]/60" />
                  ) : (
                    <EyeOff className="w-3.5 h-3.5 text-zinc-600" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
