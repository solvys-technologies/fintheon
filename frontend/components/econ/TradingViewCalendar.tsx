// [claude-code 2026-03-11] TradingView Economic Calendar — iframe (full) or embed (mini)
import { useEffect, useRef } from 'react';

interface TradingViewCalendarProps {
  /** Widget height — defaults to '100%' */
  height?: string | number;
  /** Importance filter (embed only): '-1,0,1' = all, '0,1' = medium+, '1' = high only */
  importanceFilter?: string;
  /** Country filter (embed only) — defaults to US only */
  countryFilter?: string;
  /** Use full iframe with built-in filters instead of lightweight embed */
  fullIframe?: boolean;
}

export function TradingViewCalendar({
  height = '100%',
  importanceFilter = '-1,0,1',
  countryFilter = 'us',
  fullIframe = false,
}: TradingViewCalendarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const h = typeof height === 'number' ? `${height}px` : height;

  // Full iframe mode — TradingView's complete calendar page with all built-in filters
  if (fullIframe) {
    return (
      <iframe
        src="https://www.tradingview.com/economic-calendar/?theme=dark"
        title="TradingView Economic Calendar"
        style={{ width: '100%', height: h, border: 'none' }}
        allow="clipboard-write"
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      />
    );
  }

  // Lightweight embed mode for mini widgets
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    while (container.firstChild) container.removeChild(container.firstChild);

    const widgetDiv = document.createElement('div');
    widgetDiv.className = 'tradingview-widget-container__widget';
    widgetDiv.style.width = '100%';
    widgetDiv.style.height = h;
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
      importanceFilter,
      countryFilter,
    });
    container.appendChild(script);

    return () => {
      while (container.firstChild) container.removeChild(container.firstChild);
    };
  }, [height, importanceFilter, countryFilter]);

  return (
    <div
      ref={containerRef}
      className="tradingview-widget-container"
      style={{ width: '100%', height: h }}
    />
  );
}
