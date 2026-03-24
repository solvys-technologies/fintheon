// [claude-code 2026-03-11] Native Economic Calendar — replaced TradingView iframe (X-Frame-Options blocked)
// [claude-code 2026-03-12] Reverted to TradingView widget embed — full-tab with importance filter
import { useEffect, useRef, useState } from 'react';
import { CalendarDays, Filter } from 'lucide-react';

type ImportanceFilter = 'all' | 'medium' | 'high';

const FILTER_MAP: Record<ImportanceFilter, string> = {
  all: '-1,0,1',
  medium: '0,1',
  high: '1',
};

export function EconCalendar() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [importanceFilter, setImportanceFilter] = useState<ImportanceFilter>('all');

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Clear previous widget
    while (container.firstChild) container.removeChild(container.firstChild);

    const widgetDiv = document.createElement('div');
    widgetDiv.className = 'tradingview-widget-container__widget';
    widgetDiv.style.width = '100%';
    widgetDiv.style.height = '100%';
    container.appendChild(widgetDiv);

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-events.js';
    script.async = true;
    script.textContent = JSON.stringify({
      colorTheme: 'dark',
      isTransparent: true,
      width: '100%',
      height: '100%',
      locale: 'en',
      importanceFilter: FILTER_MAP[importanceFilter],
      countryFilter: 'us',
    });
    container.appendChild(script);

    return () => {
      while (container.firstChild) container.removeChild(container.firstChild);
    };
  }, [importanceFilter]);

  return (
    <div className="h-full flex flex-col bg-[var(--fintheon-bg)]">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-zinc-800/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-[var(--fintheon-accent)]" />
            <h2 className="text-sm font-semibold text-[var(--fintheon-accent)]">Economic Calendar</h2>
            <span className="text-[9px] text-zinc-500 uppercase tracking-wider">TradingView</span>
          </div>
          <div className="flex items-center gap-1 bg-zinc-900/50 rounded px-1 py-0.5">
            <Filter className="w-3 h-3 text-zinc-500" />
            {(['all', 'medium', 'high'] as ImportanceFilter[]).map(f => (
              <button
                key={f}
                onClick={() => setImportanceFilter(f)}
                className={`text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wider transition-colors ${
                  importanceFilter === f
                    ? 'bg-[var(--fintheon-accent)]/20 text-[var(--fintheon-accent)]'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {f === 'all' ? 'All' : f === 'medium' ? 'Med+' : 'High'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* TradingView Widget */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <div
          ref={containerRef}
          className="tradingview-widget-container w-full h-full"
        />
      </div>
    </div>
  );
}
