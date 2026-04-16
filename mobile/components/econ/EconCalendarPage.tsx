// [claude-code 2026-04-16] Full-page economic calendar — seamless, no visible embed boundaries
export function EconCalendarPage() {
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: -1,
        right: -1,
        bottom: -60,
        overflow: "hidden",
      }}
    >
      <iframe
        src="https://s.tradingview.com/embed-widget/events/?locale=en&colorTheme=dark&isTransparent=false&width=100%25&height=100%25&importanceFilter=-1%2C0%2C1&countryFilter=us"
        title="Economic Calendar"
        style={{
          width: "calc(100% + 2px)",
          height: "calc(100% + 60px)",
          border: "none",
          display: "block",
          margin: 0,
          padding: 0,
        }}
      />
    </div>
  );
}
