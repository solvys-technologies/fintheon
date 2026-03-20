// [claude-code 2026-03-11] T5: added /stop command handling
import { useState, useEffect, useCallback, useRef } from 'react';
import { Lock } from 'lucide-react';
import { filterSkills, type SkillDef } from '../../lib/skills';

interface PulseSlashPickerProps {
  query: string;
  onSelect: (skillId: string) => void;
  onDismiss: () => void;
  onStop?: () => void;
  disabledSkills?: Record<string, { reason: string }>;
}

export function PulseSlashPicker({ query, onSelect, onDismiss, onStop, disabledSkills }: PulseSlashPickerProps) {
  const [highlightIndex, setHighlightIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const filtered = filterSkills(query);

  // Reset highlight when query changes
  useEffect(() => {
    setHighlightIndex(0);
  }, [query]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      const skill = filtered[highlightIndex];
      if (skill && !disabledSkills?.[skill.id]) {
        if (skill.id === 'stop' && onStop) {
          onStop();
          onDismiss();
        } else {
          onSelect(skill.id);
        }
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onDismiss();
    }
  }, [filtered, highlightIndex, onSelect, onDismiss, disabledSkills]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [handleKeyDown]);

  // Scroll highlighted item into view
  useEffect(() => {
    const el = listRef.current?.children[highlightIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlightIndex]);

  if (filtered.length === 0) {
    return (
      <div
        className="absolute bottom-full mb-1 left-0 w-72 rounded-lg border border-[var(--fintheon-accent)]/20 shadow-xl z-50 overflow-hidden"
        style={{ backgroundColor: 'var(--fintheon-surface)' }}
      >
        <div className="px-3 py-3 text-[12px] text-gray-500 text-center">
          No matching skills for "/{query}"
        </div>
      </div>
    );
  }

  return (
    <div
      className="absolute bottom-full mb-1 left-0 w-72 rounded-lg border border-[var(--fintheon-accent)]/20 shadow-xl z-50 overflow-hidden"
      style={{ backgroundColor: 'var(--fintheon-surface)' }}
    >
      <div className="px-3 py-1.5 border-b border-[var(--fintheon-accent)]/10">
        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Skills</span>
      </div>
      <div ref={listRef} className="py-1 max-h-52 overflow-y-auto">
        {filtered.map((skill, idx) => {
          const Icon = skill.icon;
          const highlighted = idx === highlightIndex;
          const disabled = disabledSkills?.[skill.id];
          return (
            <button
              key={skill.id}
              onMouseEnter={() => setHighlightIndex(idx)}
              onClick={() => {
                if (disabled) return;
                if (skill.id === 'stop' && onStop) {
                  onStop();
                  onDismiss();
                } else {
                  onSelect(skill.id);
                }
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 transition-colors ${
                disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
              }`}
              style={highlighted && !disabled ? { backgroundColor: `${skill.color}12` } : undefined}
            >
              <div className="flex-shrink-0">
                {disabled ? (
                  <Lock size={14} className="text-gray-600" />
                ) : (
                  <Icon size={14} style={{ color: highlighted ? skill.color : '#6B7280' }} />
                )}
              </div>
              <div className="flex-1 text-left min-w-0">
                <span className={`text-[12px] font-medium ${highlighted && !disabled ? 'text-white' : 'text-gray-400'}`}>
                  /{skill.id}
                </span>
                <span className="ml-2 text-[10px] text-gray-600 truncate">
                  {disabled ? disabled.reason : skill.description}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
