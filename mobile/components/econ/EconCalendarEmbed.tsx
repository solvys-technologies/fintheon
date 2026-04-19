// [claude-code 2026-04-19] Fix iframe height flat-render — TradingView embed reads height
//   from JSON on script load. Passing "100%" into a flex child produces an iframe that
//   renders at ~300px and leaves a dead gap above the Aquarium on dash page 2. We now
//   observe the wrapper with ResizeObserver and rebuild the script with an explicit
//   pixel height so the calendar actually fills its container.
// [claude-code 2026-04-16] TradingView economic calendar embed — Nothing-styled, full-height tab
import { useEffect, useRef, useState } from "react";

type ImportanceFilter = "all" | "medium" | "high";

const FILTER_MAP: Record<ImportanceFilter, string> = {
  all: "-1,0,1",
  medium: "0,1",
  high: "1",
};

const FILTER_LABELS: { label: string; value: ImportanceFilter }[] = [
  { label: "ALL", value: "all" },
  { label: "HIGH", value: "high" },
];

export function EconCalendarEmbed() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [importanceFilter, setImportanceFilter] =
    useState<ImportanceFilter>("all");
  const [measuredHeight, setMeasuredHeight] = useState(0);

  // Observe the container and feed real pixel height into the embed JSON.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const h = Math.round(entry.contentRect.height);
        if (h > 50)
          setMeasuredHeight((prev) => (Math.abs(prev - h) > 8 ? h : prev));
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || measuredHeight < 50) return;

    while (container.firstChild) container.removeChild(container.firstChild);

    const widgetDiv = document.createElement("div");
    widgetDiv.className = "tradingview-widget-container__widget";
    widgetDiv.style.width = "100%";
    widgetDiv.style.height = "100%";
    container.appendChild(widgetDiv);

    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-events.js";
    script.async = true;
    script.textContent = JSON.stringify({
      colorTheme: "dark",
      isTransparent: true,
      width: "100%",
      height: measuredHeight,
      locale: "en",
      importanceFilter: FILTER_MAP[importanceFilter],
      countryFilter: "us",
    });
    container.appendChild(script);

    return () => {
      while (container.firstChild) container.removeChild(container.firstChild);
    };
  }, [importanceFilter, measuredHeight]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "var(--black)",
      }}
    >
      {/* Header + filter strip */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 12,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--text-display)",
          }}
        >
          ECONOMIC CALENDAR
        </span>
        <div style={{ display: "flex", gap: 0 }}>
          {FILTER_LABELS.map(({ label, value }) => {
            const isActive = importanceFilter === value;
            return (
              <button
                key={value}
                onClick={() => setImportanceFilter(value)}
                style={{
                  fontFamily: "var(--font-data)",
                  fontSize: 10,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: isActive
                    ? "var(--text-display)"
                    : "var(--text-secondary)",
                  background: isActive
                    ? "var(--surface-raised)"
                    : "transparent",
                  border: "none",
                  borderBottom: isActive
                    ? "2px solid var(--text-display)"
                    : "2px solid transparent",
                  padding: "6px 12px",
                  cursor: "pointer",
                  minHeight: 32,
                  transition: "color 150ms, background 150ms",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* TradingView widget container — measured to feed explicit pixel height */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
        }}
      />
    </div>
  );
}
