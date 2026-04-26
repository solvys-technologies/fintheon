// [claude-code 2026-04-26] Desktop Econ Calendar tab now hosts the TradingView
// economic calendar via the same EmbeddedBrowserFrame the rest of the trading
// browser uses, so the user's TradingView session cookie carries through.
// Native EconCalendar component still ships in the bundle for mobile + chat
// surfaces; only the desktop tab gets swapped.
import { EmbeddedBrowserFrame } from "../layout/EmbeddedBrowserFrame";

const TRADINGVIEW_CALENDAR_URL = "https://www.tradingview.com/calendar/";

export function TradingViewCalendar() {
  return (
    <div className="h-full w-full bg-[var(--fintheon-bg)]">
      <EmbeddedBrowserFrame
        title="TradingView Economic Calendar"
        src={TRADINGVIEW_CALENDAR_URL}
        className="w-full h-full"
      />
    </div>
  );
}
