import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { MarketTickerCard } from "./MarketTickerCard";
import {
  fetchMarketTickerQuotes,
  formatSignedPct,
  normalizeTickerSymbol,
  type MarketTickerQuote,
} from "./market-ticker-types";

const TICKERS = [
  "US02Y",
  "US10Y",
  "US30Y",
  "RTY",
  "VIX",
  "DXY",
  "NQ",
  "ES",
  "YM",
  "GC",
  "CL",
];

const TICKER_PATTERN = new RegExp(
  `(^|[\\s([{>])([/$])?(${TICKERS.join("|")})(?=$|[\\s.,;:!?)}\\]<])`,
  "g",
);

export function enhanceTickerMentions(content: string): string {
  return content
    .split(/(```[\s\S]*?```)/g)
    .map((part) => {
      if (part.startsWith("```")) return part;
      return part.replace(TICKER_PATTERN, (match, prefix, marker, symbol) => {
        const label = `${marker ?? ""}${symbol}`;
        return `${prefix}<market-ticker symbol="${symbol}">${label}</market-ticker>`;
      });
    })
    .join("");
}

export function MarketTickerMention({
  symbol,
  children,
}: {
  symbol?: string;
  children?: ReactNode;
}) {
  const normalized = normalizeTickerSymbol(symbol);
  const [quote, setQuote] = useState<MarketTickerQuote | null>(null);
  const [open, setOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const triggerRef = useRef<HTMLSpanElement>(null);
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open || quote || !normalized) return;
    let cancelled = false;
    fetchMarketTickerQuotes().then((quotes) => {
      if (cancelled) return;
      setQuote(
        quotes.find((item) => item.label.toUpperCase() === normalized) ?? null,
      );
    });
    return () => {
      cancelled = true;
    };
  }, [normalized, open, quote]);

  const direction = useMemo(() => {
    if (!quote) return "flat";
    return quote.change >= 0 ? "up" : "down";
  }, [quote]);

  function showCard() {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    setIsClosing(false);
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setPosition({ left: rect.left, top: rect.bottom + 8 });
    setOpen(true);
  }

  function scheduleClose() {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => {
      setIsClosing(true);
      closeTimerRef.current = window.setTimeout(() => {
        setOpen(false);
        setIsClosing(false);
      }, 140);
    }, 120);
  }

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    };
  }, []);

  return (
    <span
      ref={triggerRef}
      className="relative inline-flex align-baseline"
      onMouseEnter={showCard}
      onMouseLeave={scheduleClose}
      onFocus={showCard}
      onBlur={scheduleClose}
    >
      <button
        type="button"
        className="fintheon-inline-ticker"
        data-direction={direction}
      >
        <span>{children}</span>
        {quote ? <span>{formatSignedPct(quote.changePercent)}</span> : null}
      </button>
      {open
        ? createPortal(
            <div
              className="fixed z-[1000]"
              style={{ left: position.left, top: position.top }}
              onMouseEnter={showCard}
              onMouseLeave={scheduleClose}
            >
              {quote ? (
                <MarketTickerCard quote={quote} isClosing={isClosing} />
              ) : (
                <span
                  className={`fintheon-popover-surface fintheon-popover-motion block w-[220px] p-3 text-[11px] text-[var(--fintheon-muted)] ${
                    isClosing ? "is-closing" : ""
                  }`}
                >
                  Loading {normalized}...
                </span>
              )}
            </div>,
            document.body,
          )
        : null}
    </span>
  );
}
