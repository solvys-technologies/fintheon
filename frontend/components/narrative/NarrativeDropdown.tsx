// [claude-code 2026-03-16] Glassmorphism narrative filter dropdown panel
// [claude-code 2026-03-16] Added catalyst tag filter section
import { useState, useCallback, useMemo } from 'react';
import { ChevronDown, ChevronRight, Filter, Tag } from 'lucide-react';
import { useNarrative } from '../../contexts/NarrativeContext';
import type { NarrativeCategory, NarrativeLane } from '../../lib/narrative-types';

const CATEGORY_CONFIG: Record<NarrativeCategory, { label: string; color: string }> = {
  geopolitical: { label: 'Geopolitical', color: '#F59E0B' },
  macroeconomic: { label: 'Macroeconomic', color: '#3B82F6' },
  monetary: { label: 'Monetary Policy', color: '#8B5CF6' },
  'market-structure': { label: 'Market Structure', color: '#EC4899' },
  'supply-chain': { label: 'Supply Chain', color: '#14B8A6' },
  'black-swan': { label: 'Black Swan', color: '#EF4444' },
  earnings: { label: 'Earnings', color: '#34D399' },
};

const ALL_CATEGORIES: NarrativeCategory[] = [
  'geopolitical', 'macroeconomic', 'monetary',
  'market-structure', 'supply-chain', 'black-swan', 'earnings',
];

interface NarrativeDropdownProps {
  visibleLaneIds: Set<string>;
  onToggleLane: (laneId: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  activeTags?: Set<string>;
  onToggleTag?: (tag: string) => void;
}

export function NarrativeDropdown({
  visibleLaneIds,
  onToggleLane,
  onSelectAll,
  onClearAll,
  activeTags,
  onToggleTag,
}: NarrativeDropdownProps) {
  const { state } = useNarrative();
  const [open, setOpen] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<NarrativeCategory>>(
    new Set(ALL_CATEGORIES),
  );

  const lanesByCategory = useMemo(() => {
    const map = new Map<NarrativeCategory, NarrativeLane[]>();
    for (const cat of ALL_CATEGORIES) map.set(cat, []);
    for (const lane of state.lanes) {
      const list = map.get(lane.category);
      if (list) list.push(lane);
    }
    return map;
  }, [state.lanes]);

  const toggleCategory = useCallback((cat: NarrativeCategory) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  // Collect all unique tags across catalysts
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const catalyst of state.catalysts) {
      if (catalyst.tags) {
        for (const tag of catalyst.tags) tagSet.add(tag);
      }
    }
    return Array.from(tagSet).sort();
  }, [state.catalysts]);

  const visibleCount = visibleLaneIds.size;
  const totalCount = state.lanes.length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-colors duration-150"
        style={{
          backgroundColor: open ? 'rgba(212, 175, 55, 0.1)' : 'transparent',
          color: 'var(--fintheon-text)',
          fontFamily: 'var(--font-body)',
        }}
      >
        <Filter className="w-3 h-3" style={{ color: 'var(--fintheon-accent)' }} />
        <span>Filter</span>
        <ChevronDown
          className="w-3 h-3 transition-transform duration-150"
          style={{ transform: open ? 'rotate(180deg)' : 'none' }}
        />
      </button>

      {open && (
        <div
          className="absolute top-full right-0 mt-1 w-64 rounded-lg border z-50 overflow-hidden"
          style={{
            backgroundColor: 'rgba(10, 10, 0, 0.85)',
            borderColor: 'rgba(212, 175, 55, 0.2)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
          }}
        >
          {/* Header with Select All / Clear All */}
          <div
            className="flex items-center justify-between px-3 py-2 border-b"
            style={{ borderColor: 'rgba(255, 255, 255, 0.06)' }}
          >
            <span className="text-[10px] text-gray-400 uppercase tracking-wider">
              Filter Narratives
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={onSelectAll}
                className="text-[10px] hover:underline"
                style={{ color: 'var(--fintheon-accent)' }}
              >
                All
              </button>
              <span className="text-gray-600 text-[10px]">|</span>
              <button
                onClick={onClearAll}
                className="text-[10px] text-gray-500 hover:text-gray-400 hover:underline"
              >
                None
              </button>
            </div>
          </div>

          {/* Category sections */}
          <div className="max-h-80 overflow-y-auto py-1">
            {ALL_CATEGORIES.map(cat => {
              const config = CATEGORY_CONFIG[cat];
              const lanes = lanesByCategory.get(cat) ?? [];
              if (lanes.length === 0) return null;

              const isExpanded = expandedCategories.has(cat);
              const catVisibleCount = lanes.filter(l => visibleLaneIds.has(l.id)).length;

              return (
                <div key={cat}>
                  {/* Category header */}
                  <button
                    onClick={() => toggleCategory(cat)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-white/5
                      transition-colors duration-100"
                  >
                    {isExpanded
                      ? <ChevronDown className="w-3 h-3 text-gray-500" />
                      : <ChevronRight className="w-3 h-3 text-gray-500" />
                    }
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: config.color }}
                    />
                    <span className="text-xs text-gray-300 flex-1 text-left">
                      {config.label}
                    </span>
                    <span className="text-[10px] text-gray-600">
                      {catVisibleCount}/{lanes.length}
                    </span>
                  </button>

                  {/* Lane checkboxes */}
                  {isExpanded && lanes.map(lane => (
                    <label
                      key={lane.id}
                      className="flex items-center gap-2 px-3 py-1 pl-9 cursor-pointer
                        hover:bg-white/5 transition-all duration-150"
                      style={{
                        opacity: visibleLaneIds.has(lane.id) ? 1 : 0.4,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={visibleLaneIds.has(lane.id)}
                        onChange={() => onToggleLane(lane.id)}
                        className="w-3 h-3 rounded border-gray-600 bg-transparent
                          accent-[var(--fintheon-accent)] cursor-pointer"
                      />
                      <span className="text-[11px] text-gray-300 truncate flex-1">
                        {lane.title}
                      </span>
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: lane.color || config.color }}
                      />
                    </label>
                  ))}
                </div>
              );
            })}

            {/* Tag filter section */}
            {allTags.length > 0 && onToggleTag && (
              <>
                <div
                  className="flex items-center gap-2 px-3 py-2 mt-1 border-t"
                  style={{ borderColor: 'rgba(255, 255, 255, 0.06)' }}
                >
                  <Tag className="w-3 h-3" style={{ color: 'var(--fintheon-accent)' }} />
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider">
                    Catalyst Tags
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 px-3 py-1.5 pb-2">
                  {allTags.map(tag => {
                    const isActive = activeTags?.has(tag) ?? false;
                    return (
                      <button
                        key={tag}
                        onClick={() => onToggleTag(tag)}
                        className="text-[10px] px-2 py-0.5 rounded-full border transition-all duration-150"
                        style={{
                          color: isActive ? 'var(--fintheon-accent)' : 'var(--fintheon-muted)',
                          backgroundColor: isActive
                            ? 'color-mix(in srgb, var(--fintheon-accent) 15%, transparent)'
                            : 'transparent',
                          borderColor: isActive
                            ? 'color-mix(in srgb, var(--fintheon-accent) 30%, transparent)'
                            : 'rgba(255, 255, 255, 0.1)',
                        }}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
