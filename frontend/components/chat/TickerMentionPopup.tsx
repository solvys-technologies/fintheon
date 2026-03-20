import { useState, useEffect, useRef, useMemo } from 'react';
import { KNOWN_AGENTS } from '../../contexts/PulseAgentContext';

/* ------------------------------------------------------------------ */
/*  Ticker data                                                        */
/* ------------------------------------------------------------------ */

const TICKER_SYMBOLS = [
  { symbol: 'MNQ', name: 'E-mini Micro Nasdaq' },
  { symbol: 'ES', name: 'E-mini S&P 500' },
  { symbol: 'NQ', name: 'E-mini Nasdaq-100' },
  { symbol: 'YM', name: 'E-mini Dow Jones' },
  { symbol: 'RTY', name: 'E-mini Russell 2000' },
  { symbol: 'CL', name: 'Crude Oil' },
  { symbol: 'GC', name: 'Gold' },
  { symbol: 'SI', name: 'Silver' },
  { symbol: 'ZB', name: '30-Year T-Bond' },
  { symbol: 'VIX', name: 'Volatility Index' },
];

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type MentionType = 'agent' | 'ticker';

interface MentionItem {
  type: MentionType;
  value: string;
  label: string;
  sublabel?: string;
}

interface TickerMentionPopupProps {
  query: string; // The search text after @ or $
  triggerChar: '@' | '$';
  position: { top: number; left: number };
  onSelect: (item: MentionItem) => void;
  onClose: () => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function TickerMentionPopup({ query, triggerChar, position, onSelect, onClose }: TickerMentionPopupProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const items = useMemo((): MentionItem[] => {
    const q = query.toLowerCase();
    if (triggerChar === '@') {
      return KNOWN_AGENTS
        .filter((name) => name.toLowerCase().includes(q))
        .map((name) => ({ type: 'agent' as const, value: name, label: name }));
    }
    return TICKER_SYMBOLS
      .filter((t) => t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q))
      .map((t) => ({ type: 'ticker' as const, value: t.symbol, label: `$${t.symbol}`, sublabel: t.name }));
  }, [query, triggerChar]);

  // Reset selection when items change
  useEffect(() => { setSelectedIndex(0); }, [items]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, items.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (items[selectedIndex]) onSelect(items[selectedIndex]);
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [items, selectedIndex, onSelect, onClose]);

  if (items.length === 0) return null;

  return (
    <div
      className="fixed z-[100] w-52 max-h-[200px] overflow-y-auto rounded-lg border border-[var(--fintheon-accent)]/20 bg-[var(--fintheon-surface)] shadow-xl"
      style={{ top: position.top, left: position.left }}
      ref={listRef}
    >
      {items.map((item, idx) => (
        <button
          key={`${item.type}-${item.value}`}
          onClick={() => onSelect(item)}
          onMouseEnter={() => setSelectedIndex(idx)}
          className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
            idx === selectedIndex ? 'bg-[var(--fintheon-accent)]/10' : 'hover:bg-[var(--fintheon-accent)]/5'
          }`}
        >
          <span className="text-[12px] font-medium text-white">{item.label}</span>
          {item.sublabel && <span className="text-[10px] text-gray-500 truncate">{item.sublabel}</span>}
        </button>
      ))}
    </div>
  );
}
