// [claude-code 2026-03-06] Dropdown menu for quick-adding typed catalysts in NarrativeFlow
import { useEffect, useRef } from 'react';
import { CATALYST_TEMPLATES } from '../../lib/narrative-templates';
import type { CatalystTemplateType } from '../../lib/narrative-types';

interface CatalystTemplateMenuProps {
  open: boolean;
  onClose: () => void;
  onSelect: (templateType: CatalystTemplateType) => void;
  anchorPosition: { x: number; y: number };
}

export function CatalystTemplateMenu({ open, onClose, onSelect, anchorPosition }: CatalystTemplateMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 backdrop-blur-lg bg-[var(--fintheon-surface)]/90 border border-[var(--fintheon-border)]/30 rounded-lg shadow-xl p-2 animate-fade-in"
      style={{ left: anchorPosition.x, top: anchorPosition.y }}
    >
      <div className="grid grid-cols-2 gap-1 min-w-[200px]">
        {CATALYST_TEMPLATES.map((template) => {
          const Icon = template.icon;
          return (
            <button
              key={template.type}
              onClick={() => {
                onSelect(template.type);
                onClose();
              }}
              className="flex items-center gap-2 px-3 py-2 rounded text-sm text-[var(--fintheon-text)] hover:bg-[var(--fintheon-accent)]/10 transition-colors text-left"
            >
              <Icon className="w-4 h-4 text-[var(--fintheon-accent)] shrink-0" />
              <div>
                <div className="font-medium text-xs">{template.label}</div>
                <div className="text-[10px] text-[var(--fintheon-muted)]">{template.description}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
