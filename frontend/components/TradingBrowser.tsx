// [claude-code 2026-03-06] Phase 2A: Removed header — controls moved to FooterToolbar
// [claude-code 2026-04-03] Solvys Stone: fade iframe surroundings to black for seamless blend
import { EmbeddedBrowserFrame } from "./layout/EmbeddedBrowserFrame";
import { useSettings } from "../contexts/SettingsContext";
import { useTheme } from "../contexts/ThemeContext";

export type TradingPlatform =
  | "topstepx"
  | "topstep-dashboard"
  | "mmt"
  | "kalshi"
  | "research"
  | "tradesea"
  | "tradovate"
  | "tradelocker"
  | "tradingview";

export const PLATFORM_LABELS: Record<TradingPlatform, string> = {
  topstepx: "TopStepX",
  "topstep-dashboard": "TopStep Dashboard",
  mmt: "MMT",
  kalshi: "Kalshi",
  research: "Research",
  tradesea: "TradeSea",
  tradovate: "Tradovate",
  tradelocker: "TradeLocker",
  tradingview: "TradingView",
};

export const PLATFORM_URLS: Record<TradingPlatform, string> = {
  topstepx: "https://www.topstepx.com",
  "topstep-dashboard": "https://dashboard.topstep.com",
  mmt: "https://app.mmt.gg",
  kalshi: "https://kalshi.com/category/economics",
  research:
    import.meta.env.VITE_RESEARCH_URL ||
    "https://www.notion.so/solvys/344141b0da7d809ab3dff394c5c0aecc?v=344141b0da7d80ba935d000c9bda216f",
  tradesea: "https://app.tradesea.ai/trade",
  tradovate: "https://trader.tradovate.com",
  tradelocker: "https://app.tradelocker.com",
  tradingview: "https://www.tradingview.com/chart",
};

interface TradingBrowserProps {
  primaryPlatform: TradingPlatform;
  onPrimaryPlatformChange?: (platform: TradingPlatform) => void;
  secondaryPlatform: TradingPlatform;
  onSecondaryPlatformChange?: (platform: TradingPlatform) => void;
  splitViewEnabled: boolean;
  onSplitViewEnabledChange?: (enabled: boolean) => void;
  allowSplitView: boolean;
}

export function TradingBrowser({
  primaryPlatform,
  secondaryPlatform,
  splitViewEnabled,
  allowSplitView,
}: TradingBrowserProps) {
  const { iframeUrls } = useSettings();
  const { theme } = useTheme();
  const isStone = theme.name === "solvys-stone";
  const frameBg = isStone ? "bg-black" : "bg-white";
  const platformUrls = {
    ...PLATFORM_URLS,
    research: iframeUrls.research || PLATFORM_URLS.research,
  };
  const primaryUrl = platformUrls[primaryPlatform];
  const secondaryUrl = platformUrls[secondaryPlatform];

  return (
    <div
      className={`h-full w-full overflow-hidden ${isStone ? "bg-black" : "bg-[var(--fintheon-surface)]"}`}
    >
      <div
        className={`h-full ${splitViewEnabled && allowSplitView ? "grid grid-cols-2 gap-0" : ""}`}
      >
        <EmbeddedBrowserFrame
          title={PLATFORM_LABELS[primaryPlatform]}
          src={primaryUrl}
          className={`w-full h-full ${frameBg}`}
        />
        {splitViewEnabled && allowSplitView && (
          <EmbeddedBrowserFrame
            title={PLATFORM_LABELS[secondaryPlatform]}
            src={secondaryUrl}
            className={`w-full h-full ${frameBg}`}
          />
        )}
      </div>
    </div>
  );
}
