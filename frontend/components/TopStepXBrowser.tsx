// [claude-code 2026-03-06] Phase 2A: Removed header — controls moved to FooterToolbar
import { EmbeddedBrowserFrame } from './layout/EmbeddedBrowserFrame';
import { useSettings } from '../contexts/SettingsContext';

export type TradingPlatform = 'topstepx' | 'hyperliquid' | 'kalshi' | 'research' | 'tradesea';

export const PLATFORM_LABELS: Record<TradingPlatform, string> = {
  topstepx: 'TopStepX',
  hyperliquid: 'Hyperliquid',
  kalshi: 'Kalshi',
  research: 'Research',
  tradesea: 'TradeSea',
};

export const PLATFORM_URLS: Record<TradingPlatform, string> = {
  topstepx: 'https://www.topstepx.com',
  hyperliquid: 'https://app.hyperliquid.xyz',
  kalshi: 'https://kalshi.com/markets',
  research: import.meta.env.VITE_NOTION_RESEARCH_URL || 'https://www.notion.so',
  tradesea: 'https://app.tradesea.ai/trade',
};

interface TopStepXBrowserProps {
  primaryPlatform: TradingPlatform;
  onPrimaryPlatformChange?: (platform: TradingPlatform) => void;
  secondaryPlatform: TradingPlatform;
  onSecondaryPlatformChange?: (platform: TradingPlatform) => void;
  splitViewEnabled: boolean;
  onSplitViewEnabledChange?: (enabled: boolean) => void;
  allowSplitView: boolean;
}

export function TopStepXBrowser({
  primaryPlatform,
  secondaryPlatform,
  splitViewEnabled,
  allowSplitView,
}: TopStepXBrowserProps) {
  const { iframeUrls } = useSettings();
  const platformUrls = {
    ...PLATFORM_URLS,
    research: iframeUrls.research || PLATFORM_URLS.research,
  };
  const primaryUrl = platformUrls[primaryPlatform];
  const secondaryUrl = platformUrls[secondaryPlatform];

  return (
    <div className="h-full w-full bg-[var(--fintheon-surface)] overflow-hidden">
      <div className={`h-full ${splitViewEnabled && allowSplitView ? 'grid grid-cols-2 gap-0' : ''}`}>
        <EmbeddedBrowserFrame
          title={PLATFORM_LABELS[primaryPlatform]}
          src={primaryUrl}
          className="w-full h-full bg-white"
        />
        {splitViewEnabled && allowSplitView && (
          <EmbeddedBrowserFrame
            title={PLATFORM_LABELS[secondaryPlatform]}
            src={secondaryUrl}
            className="w-full h-full bg-white"
          />
        )}
      </div>
    </div>
  );
}
