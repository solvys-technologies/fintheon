import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Search, X, Users, Activity, FileText, Calendar, Layout } from 'lucide-react';
import { PULSE_AGENTS } from '../../contexts/PulseAgentContext';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface SearchResult {
  id: string;
  type: 'agent' | 'section' | 'riskflow' | 'report' | 'event';
  title: string;
  subtitle?: string;
  icon: typeof Search;
  action?: () => void;
}

interface SearchModalProps {
  open: boolean;
  onClose: () => void;
  onNavigateTab?: (tab: string) => void;
}

/* ------------------------------------------------------------------ */
/*  Static data for search                                             */
/* ------------------------------------------------------------------ */

const SECTIONS = [
  { id: 'executive', title: 'Executive Dashboard', tab: 'executive' },
  { id: 'tape', title: 'RiskFlow Feed', tab: 'news' },
  { id: 'analysis', title: 'Analysis', tab: 'analysis' },
  { id: 'riskflow', title: 'RiskFlow', tab: 'riskflow' },
  { id: 'boardroom', title: 'Board Room', tab: 'boardroom' },
  { id: 'research', title: 'Research Department', tab: 'research' },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function SearchModal({ open, onClose, onNavigateTab }: SearchModalProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const results = useMemo((): SearchResult[] => {
    if (!query.trim()) {
      // Show sections by default
      return SECTIONS.map((s) => ({
        id: s.id,
        type: 'section',
        title: s.title,
        subtitle: 'Navigate',
        icon: Layout,
        action: () => { onNavigateTab?.(s.tab); onClose(); },
      }));
    }

    const q = query.toLowerCase();
    const matched: SearchResult[] = [];

    // Agents
    PULSE_AGENTS.forEach((a) => {
      if (a.name.toLowerCase().includes(q) || a.sector.toLowerCase().includes(q)) {
        matched.push({
          id: `agent-${a.id}`,
          type: 'agent',
          title: a.name,
          subtitle: a.sector,
          icon: Users,
        });
      }
    });

    // Sections
    SECTIONS.forEach((s) => {
      if (s.title.toLowerCase().includes(q)) {
        matched.push({
          id: `section-${s.id}`,
          type: 'section',
          title: s.title,
          subtitle: 'Navigate',
          icon: Layout,
          action: () => { onNavigateTab?.(s.tab); onClose(); },
        });
      }
    });

    // Static report items
    const reports = ['MDB Report', 'Weekly Tape Summary', 'Psych Eval', 'Blindspots'];
    reports.forEach((r) => {
      if (r.toLowerCase().includes(q)) {
        matched.push({
          id: `report-${r}`,
          type: 'report',
          title: r,
          subtitle: 'Report',
          icon: FileText,
        });
      }
    });

    return matched;
  }, [query, onNavigateTab, onClose]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = results[selectedIndex];
        if (item?.action) item.action();
      } else if (e.key === 'Escape') {
        onClose();
      }
    },
    [results, selectedIndex, onClose],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center" style={{ paddingTop: '20vh' }}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div
        className="relative w-full max-w-lg rounded-xl border border-[var(--fintheon-accent)]/20 bg-[var(--fintheon-surface)] shadow-2xl overflow-hidden"
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-[var(--fintheon-accent)]/10 px-4 py-3">
          <Search size={16} className="text-gray-500 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
            placeholder="Search agents, sections, reports..."
            className="flex-1 bg-transparent text-[14px] text-white placeholder:text-gray-600 focus:outline-none"
          />
          <kbd className="text-[10px] text-gray-600 border border-gray-700 rounded px-1.5 py-0.5 font-mono">esc</kbd>
        </div>

        {/* Results */}
        <div className="max-h-[300px] overflow-y-auto py-1">
          {results.length === 0 && (
            <div className="text-center py-8 text-[13px] text-gray-600">No results found.</div>
          )}
          {results.map((item, idx) => {
            const Icon = item.icon;
            const isSelected = idx === selectedIndex;
            return (
              <button
                key={item.id}
                onClick={() => item.action?.()}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  isSelected ? 'bg-[var(--fintheon-accent)]/10' : 'hover:bg-[var(--fintheon-accent)]/5'
                }`}
              >
                <Icon size={15} className="text-gray-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] text-white truncate">{item.title}</div>
                  {item.subtitle && (
                    <div className="text-[10px] text-gray-500 truncate">{item.subtitle}</div>
                  )}
                </div>
                <span
                  className="text-[9px] uppercase tracking-wider text-gray-600 px-1.5 py-0.5 rounded border border-gray-800"
                >
                  {item.type}
                </span>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="border-t border-[var(--fintheon-accent)]/10 px-4 py-2 flex items-center gap-4">
          <span className="text-[10px] text-gray-600 flex items-center gap-1">
            <kbd className="border border-gray-700 rounded px-1 py-0.5 font-mono text-[9px]">Tab</kbd> to navigate
          </span>
          <span className="text-[10px] text-gray-600 flex items-center gap-1">
            <kbd className="border border-gray-700 rounded px-1 py-0.5 font-mono text-[9px]">Enter</kbd> to select
          </span>
        </div>
      </div>
    </div>
  );
}
