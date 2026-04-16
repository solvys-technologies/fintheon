// [claude-code 2026-04-16] Full-page economic calendar — dedicated tab, fills viewport, week view
import { useEffect, useRef, useState } from "react";

type ImportanceFilter = "all" | "high";

const FILTER_MAP: Record<ImportanceFilter, string> = {
  all: "-1,0,1",
  high: "1",
};

export function EconCalendarPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<ImportanceFilter>("all");

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

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
      height: "100%",
      locale: "en",
      importanceFilter: FILTER_MAP[filter],
      countryFilter: "us",
    });
    container.appendChild(script);

    return () => {
      while (container.firstChild) container.removeChild(container.firstChild);
    };
  }, [filter]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "var(--black)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 14,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--text-display)",
            fontWeight: 700,
          }}
        >
          ECONOMIC CALENDAR
        </span>
        <div style={{ display: "flex", gap: 0 }}>
          {(["all", "high"] as const).map((value) => {
            const isActive = filter === value;
            const label = value === "all" ? "ALL" : "HIGH";
            return (
              <button
                key={value}
                onClick={() => setFilter(value)}
                style={{
                  fontFamily: "var(--font-data)",
                  fontSize: 11,
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
                  padding: "8px 16px",
                  cursor: "pointer",
                  minHeight: 40,
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

      <div
        style={{
          width: "100%",
          height: 1,
          background: "var(--border)",
          flexShrink: 0,
        }}
      />

      {/* TradingView widget — fills all remaining space */}
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
