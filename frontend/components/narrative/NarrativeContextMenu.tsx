// [claude-code 2026-03-16] Right-click context menu for narrative lanes and catalysts
import { useEffect, useRef, useState } from 'react';
import {
  Pencil, Trash2, Archive, Eye, GitFork, MessageSquare, ArrowUp, ArrowDown,
} from 'lucide-react';
import type { NarrativeLane, NarrativeStatus, DirectionBias } from '../../lib/narrative-types';

export interface ContextMenuTarget {
  type: 'lane' | 'catalyst';
  id: string;
  x: number;
  y: number;
}

interface NarrativeContextMenuProps {
  target: ContextMenuTarget;
  lane?: NarrativeLane;
  onClose: () => void;
  onRename: (id: string) => void;
  onDelete: (id: string) => void;
  onArchive: (id: string) => void;
  onSetStatus: (id: string, status: NarrativeStatus) => void;
  onSetDirection: (id: string, bias: DirectionBias) => void;
  onFork: (id: string) => void;
  onAskAI: (id: string) => void;
  onEdit: (id: string) => void;
}

interface MenuItem {
  label: string;
  icon: React.ReactNode;
  action: () => void;
  danger?: boolean;
  divider?: boolean;
  sub?: MenuItem[];
}

export function NarrativeContextMenu({
  target, lane, onClose, onRename, onDelete, onArchive,
  onSetStatus, onSetDirection, onFork, onAskAI, onEdit,
}: NarrativeContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [subMenuKey, setSubMenuKey] = useState<string | null>(null);

  // Close on outside click or escape
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => { document.removeEventListener('mousedown', handleClick); document.removeEventListener('keydown', handleKey); };
  }, [onClose]);

  // Clamp position to viewport
  const x = Math.min(target.x, window.innerWidth - 200);
  const y = Math.min(target.y, window.innerHeight - 320);

  const isLane = target.type === 'lane';
  const currentStatus = lane?.status ?? 'active';

  const statusOptions: { value: NarrativeStatus; label: string }[] = [
    { value: 'active', label: 'Active' },
    { value: 'watching', label: 'Watching' },
    { value: 'archived', label: 'Archived' },
    { value: 'decayed', label: 'Decayed' },
  ];

  const directionOptions: { value: DirectionBias; label: string; icon: React.ReactNode }[] = [
    { value: 'long', label: 'Long', icon: <ArrowUp className="w-3 h-3 text-[var(--fintheon-bullish)]" /> },
    { value: 'short', label: 'Short', icon: <ArrowDown className="w-3 h-3 text-[var(--fintheon-bearish)]" /> },
    { value: 'neutral', label: 'Neutral', icon: <span className="text-[var(--fintheon-muted)] text-xs">--</span> },
  ];

  const items: MenuItem[] = isLane ? [
    { label: 'Edit Narrative...', icon: <Pencil className="w-3.5 h-3.5" />, action: () => { onEdit(target.id); onClose(); } },
    { label: 'Rename', icon: <Pencil className="w-3.5 h-3.5" />, action: () => { onRename(target.id); onClose(); } },
    { label: 'Fork Narrative', icon: <GitFork className="w-3.5 h-3.5" />, action: () => { onFork(target.id); onClose(); }, divider: true },
    { label: 'Ask AI about this...', icon: <MessageSquare className="w-3.5 h-3.5" />, action: () => { onAskAI(target.id); onClose(); }, divider: true },
    { label: currentStatus === 'archived' ? 'Unarchive' : 'Archive', icon: <Archive className="w-3.5 h-3.5" />, action: () => { onArchive(target.id); onClose(); } },
    { label: 'Delete', icon: <Trash2 className="w-3.5 h-3.5" />, action: () => { onDelete(target.id); onClose(); }, danger: true },
  ] : [
    { label: 'Edit Catalyst...', icon: <Pencil className="w-3.5 h-3.5" />, action: () => { onEdit(target.id); onClose(); } },
    { label: 'Ask AI about this...', icon: <MessageSquare className="w-3.5 h-3.5" />, action: () => { onAskAI(target.id); onClose(); }, divider: true },
    { label: 'Delete', icon: <Trash2 className="w-3.5 h-3.5" />, action: () => { onDelete(target.id); onClose(); }, danger: true },
  ];

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] min-w-[180px] py-1 rounded-lg shadow-xl border border-[var(--fintheon-border)]/30 backdrop-blur-xl"
      style={{
        left: x,
        top: y,
        backgroundColor: 'color-mix(in srgb, var(--fintheon-surface) 95%, transparent)',
      }}
    >
      {items.map((item, i) => (
        <div key={item.label}>
          <button
            onClick={item.action}
            className={`flex items-center gap-2.5 w-full text-left px-3 py-1.5 text-[11px] transition-colors ${
              item.danger
                ? 'text-[#EF4444] hover:bg-[#EF4444]/10'
                : 'text-[var(--fintheon-text)] hover:bg-[var(--fintheon-accent)]/8'
            }`}
          >
            <span className={item.danger ? 'text-[#EF4444]/70' : 'text-[var(--fintheon-muted)]'}>{item.icon}</span>
            {item.label}
          </button>
          {item.divider && <div className="mx-2 my-1 border-t border-[var(--fintheon-border)]/15" />}
        </div>
      ))}

      {/* Status submenu for lanes */}
      {isLane && (
        <>
          <div className="mx-2 my-1 border-t border-[var(--fintheon-border)]/15" />
          <div
            className="relative"
            onMouseEnter={() => setSubMenuKey('status')}
            onMouseLeave={() => setSubMenuKey(null)}
          >
            <button className="flex items-center gap-2.5 w-full text-left px-3 py-1.5 text-[11px] text-[var(--fintheon-text)] hover:bg-[var(--fintheon-accent)]/8 transition-colors">
              <Eye className="w-3.5 h-3.5 text-[var(--fintheon-muted)]" />
              Status
              <span className="ml-auto text-[9px] text-[var(--fintheon-muted)]">&#9654;</span>
            </button>
            {subMenuKey === 'status' && (
              <div
                className="absolute left-full top-0 ml-1 min-w-[120px] py-1 rounded-lg shadow-xl border border-[var(--fintheon-border)]/30 backdrop-blur-xl"
                style={{ backgroundColor: 'color-mix(in srgb, var(--fintheon-surface) 95%, transparent)' }}
              >
                {statusOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { onSetStatus(target.id, opt.value); onClose(); }}
                    className={`block w-full text-left px-3 py-1.5 text-[11px] transition-colors ${
                      currentStatus === opt.value
                        ? 'text-[var(--fintheon-accent)]'
                        : 'text-[var(--fintheon-text)] hover:bg-[var(--fintheon-accent)]/8'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Direction submenu */}
          <div
            className="relative"
            onMouseEnter={() => setSubMenuKey('direction')}
            onMouseLeave={() => setSubMenuKey(null)}
          >
            <button className="flex items-center gap-2.5 w-full text-left px-3 py-1.5 text-[11px] text-[var(--fintheon-text)] hover:bg-[var(--fintheon-accent)]/8 transition-colors">
              <ArrowUp className="w-3.5 h-3.5 text-[var(--fintheon-muted)]" />
              Direction
              <span className="ml-auto text-[9px] text-[var(--fintheon-muted)]">&#9654;</span>
            </button>
            {subMenuKey === 'direction' && (
              <div
                className="absolute left-full top-0 ml-1 min-w-[110px] py-1 rounded-lg shadow-xl border border-[var(--fintheon-border)]/30 backdrop-blur-xl"
                style={{ backgroundColor: 'color-mix(in srgb, var(--fintheon-surface) 95%, transparent)' }}
              >
                {directionOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { onSetDirection(target.id, opt.value); onClose(); }}
                    className={`flex items-center gap-2 w-full text-left px-3 py-1.5 text-[11px] transition-colors ${
                      lane?.directionBias === opt.value
                        ? 'text-[var(--fintheon-accent)]'
                        : 'text-[var(--fintheon-text)] hover:bg-[var(--fintheon-accent)]/8'
                    }`}
                  >
                    {opt.icon} {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
