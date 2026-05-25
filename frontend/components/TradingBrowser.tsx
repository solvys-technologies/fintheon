// [claude-code 2026-03-06] Phase 2A: Removed header — controls moved to FooterToolbar
// [claude-code 2026-04-03] Solvys Stone: fade iframe surroundings to black for seamless blend
import { EmbeddedBrowserFrame } from "./layout/EmbeddedBrowserFrame";
import { useSettings } from "../contexts/SettingsContext";
import { useTheme } from "../contexts/ThemeContext";
import { useEffect, useState } from "react";
import { DeskBlockOverlay } from "./blocker/DeskBlockOverlay";
import { useBlockedUrlOverlay } from "../hooks/useBlockedUrlOverlay";

export type BuiltinPlatform =
  | "topstepx"
  | "topstep-dashboard"
  | "mmt"
  | "kalshi"
  | "research"
  | "tradesea"
  | "tradovate"
  | "tradelocker"
  | "tradingview";

// Accepts builtin keys + custom source IDs (prefixed "custom:")
export type TradingPlatform = BuiltinPlatform | (string & {});

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
  const { iframeUrls, proposerIframeSources } = useSettings();
  const { theme } = useTheme();
  const isStone = theme.name === "solvys-stone";
  const frameBg = isStone ? "bg-black" : "bg-white";
  // [claude-code 2026-04-24] Resolution order: (1) user-managed iFrame catalogue
  // (Settings → iFrames) is authoritative — match by id; (2) the legacy
  // PLATFORM_URLS map is kept as a defensive fallback for any platform id that
  // was selected before the user pruned it from the catalogue. The "research"
  // override (env var) still lands via the catalogue's seed and the user's
  // iframeUrls.research field below.
  const resolveUrl = (platform: TradingPlatform): string => {
    const fromCatalogue = proposerIframeSources.find((s) => s.id === platform);
    if (fromCatalogue) {
      if (platform === "research" && iframeUrls.research) {
        return iframeUrls.research;
      }
      return fromCatalogue.url;
    }
    if (platform === "research") {
      return iframeUrls.research || PLATFORM_URLS.research;
    }
    return PLATFORM_URLS[platform] ?? "";
  };
  const resolveLabel = (platform: TradingPlatform): string => {
    const fromCatalogue = proposerIframeSources.find((s) => s.id === platform);
    return (
      fromCatalogue?.label ?? PLATFORM_LABELS[platform] ?? String(platform)
    );
  };
  const primaryUrl = resolveUrl(primaryPlatform);
  const secondaryUrl = resolveUrl(secondaryPlatform);

  return (
    <div
      className={`h-full w-full overflow-hidden ${isStone ? "bg-black" : "bg-[var(--fintheon-surface)]"}`}
    >
      <div className="flex h-full min-h-0">
        <div
          className="h-full min-w-0 transition-[flex-basis] duration-300 ease-out"
          style={{
            flex: `0 0 ${splitViewEnabled && allowSplitView ? "50%" : "100%"}`,
          }}
        >
          <BrowserPane
            activePlatform={primaryPlatform}
            activeUrl={primaryUrl}
            resolveUrl={resolveUrl}
            resolveLabel={resolveLabel}
            frameBg={frameBg}
          />
        </div>
        <div
          aria-hidden={!(splitViewEnabled && allowSplitView)}
          className={`h-full min-w-0 shrink-0 overflow-hidden border-l border-[var(--fintheon-accent)]/10 transition-[flex-basis,transform,opacity,border-color] duration-300 ease-out ${
            splitViewEnabled && allowSplitView
              ? ""
              : "pointer-events-none border-transparent"
          }`}
          style={{
            flex: `0 0 ${splitViewEnabled && allowSplitView ? "50%" : "0%"}`,
            opacity: splitViewEnabled && allowSplitView ? 1 : 0,
            transform:
              splitViewEnabled && allowSplitView
                ? "translateX(0)"
                : "translateX(100%)",
          }}
        >
          <BrowserPane
            activePlatform={secondaryPlatform}
            activeUrl={secondaryUrl}
            resolveUrl={resolveUrl}
            resolveLabel={resolveLabel}
            frameBg={frameBg}
          />
        </div>
      </div>
    </div>
  );
}

function BrowserPane({
  activePlatform,
  activeUrl,
  resolveUrl,
  resolveLabel,
  frameBg,
}: {
  activePlatform: TradingPlatform;
  activeUrl: string;
  resolveUrl: (platform: TradingPlatform) => string;
  resolveLabel: (platform: TradingPlatform) => string;
  frameBg: string;
}) {
  const [visitedPlatforms, setVisitedPlatforms] = useState<TradingPlatform[]>(
    () => (activeUrl ? [activePlatform] : []),
  );
  const { shouldOverlay } = useBlockedUrlOverlay(activeUrl);

  useEffect(() => {
    if (!activeUrl) return;
    setVisitedPlatforms((prev) =>
      prev.includes(activePlatform) ? prev : [...prev, activePlatform],
    );
  }, [activePlatform, activeUrl]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      {shouldOverlay ? <DeskBlockOverlay visible /> : null}
      {visitedPlatforms.map((platform) => {
        const url = resolveUrl(platform);
        if (!url) return null;
        const isActive = platform === activePlatform;
        return (
          <div
            key={platform}
            className="absolute inset-0"
            style={{
              display: isActive ? "block" : "none",
            }}
          >
            <EmbeddedBrowserFrame
              title={resolveLabel(platform)}
              src={url}
              className={`w-full h-full ${frameBg}`}
            />
          </div>
        );
      })}
    </div>
  );
}
