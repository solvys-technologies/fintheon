// [claude-code 2026-04-28] T6: Shared SVG source logos — added Globe, Official, Network,
//   ChartSource, and TradeIdea icons. Removed banned emoji glyph.
import {
  GlobeIcon,
  OfficialIcon,
  NetworkIcon,
  ChartSourceIcon,
  TradeIdeaIcon,
} from "../components/icons";

export function XLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-label="X"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export function YouTubeLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-label="YouTube"
    >
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

export function MarketWatchLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-label="MarketWatch"
    >
      <path
        d="M3 17l4-8 3 5 4-10 4 8 3-4"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Dispatches to the correct logo SVG based on source string */
export function SourceIcon({
  source,
  className,
}: {
  source: string;
  className?: string;
}) {
  const s = source.toLowerCase();

  // X / Twitter / Wire handles
  if (
    s === "rettiwt" ||
    s === "twitter-cli" ||
    s === "twittercli" ||
    s.includes("twitter") ||
    s === "financialjuice" ||
    s === "financial-juice" ||
    s === "osintsources" ||
    s === "osint" ||
    s.includes("osint") ||
    s === "curatedtimeline" ||
    s === "curated"
  ) {
    return <XLogo className={className} />;
  }

  // Trade idea
  if (s === "trade-idea") {
    return <TradeIdeaIcon className={className} />;
  }

  // MarketWatch
  if (s === "marketwatch" || s.includes("marketwatch")) {
    return <MarketWatchLogo className={className} />;
  }

  // Kalshi
  if (s === "kalshi-whale" || s === "kalshi") {
    return (
      <span
        className={`font-bold text-[8px] uppercase leading-none text-[var(--fintheon-accent)] ${className}`}
      >
        K
      </span>
    );
  }

  // Econ / Calendar
  if (
    s === "econcalendar" ||
    s === "econ" ||
    s.includes("economic") ||
    s.includes("calendar")
  ) {
    return <ChartSourceIcon className={className} />;
  }

  // Official / Government (BLS, Fed, etc.)
  if (
    s.includes("bls") ||
    s.includes("fed") ||
    s.includes("federal") ||
    s.includes("reserve") ||
    s.includes("government") ||
    s.includes("official") ||
    s.includes("treasury") ||
    s.includes("sec") ||
    s.includes("cftc")
  ) {
    return <OfficialIcon className={className} />;
  }

  // Custom / Agent-reach / Generic agent
  if (s === "custom" || s === "agentreach" || s.includes("agent")) {
    return <NetworkIcon className={className} />;
  }

  // RSS / Generic web
  if (s === "rss" || s.includes("rss") || s.includes("feed")) {
    return <GlobeIcon className={className} />;
  }

  // Chart / data providers
  if (
    s.includes("tradingview") ||
    s.includes("chart") ||
    s.includes("data") ||
    s.includes("quote")
  ) {
    return <ChartSourceIcon className={className} />;
  }

  // Fallback: first initial
  return (
    <span
      className={`font-bold text-[8px] uppercase leading-none ${className}`}
    >
      {source.charAt(0)}
    </span>
  );
}
