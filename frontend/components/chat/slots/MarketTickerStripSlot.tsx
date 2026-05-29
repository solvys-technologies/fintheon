// [codex 2026-05-23] Streamdown futures ticker pills backed by TV scanner.
import { useEffect, useMemo, useState } from "react";
import type { CustomRendererProps } from "streamdown";
import { z } from "zod";
import { parseSlotBody } from "./parseSlotBody";
import { SlotError, SlotReveal, SlotShell, SlotSkeleton } from "./SlotShell";
import { MarketTickerCard } from "./MarketTickerCard";
import {
  fetchMarketTickerQuotes,
  formatPrice,
  formatSignedPct,
  MarketTickerQuoteSchema,
  type MarketTickerQuote,
} from "./market-ticker-types";

const TickerStripSchema = z.object({
  title: z.string().optional(),
  symbols: z.array(z.string()).optional(),
  quotes: z.array(MarketTickerQuoteSchema).optional(),
});

type TickerStripData = z.infer<typeof TickerStripSchema>;

export function MarketTickerStripSlot({
  code,
  isIncomplete,
}: CustomRendererProps) {
  const parsed = useMemo(
    () => parseSlotBody<TickerStripData>(code, isIncomplete),
    [code, isIncomplete],
  );
  const [quotes, setQuotes] = useState<MarketTickerQuote[]>([]);
  const [selected, setSelected] = useState<MarketTickerQuote | null>(null);
  const [isClosingSelected, setIsClosingSelected] = useState(false);
  const [loading, setLoading] = useState(false);
  const validated = useMemo(
    () =>
      parsed.status === "ok" ? TickerStripSchema.safeParse(parsed.data) : null,
    [parsed],
  );
  const data = validated?.success ? validated.data : null;

  useEffect(() => {
    if (!data) return;
    if (data.quotes?.length) {
      setQuotes(data.quotes);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchMarketTickerQuotes()
      .then((all) => {
        if (cancelled) return;
        const wanted = new Set(
          data.symbols?.map((symbol) => symbol.toUpperCase()),
        );
        setQuotes(
          wanted.size > 0
            ? all.filter((quote) => wanted.has(quote.label.toUpperCase()))
            : all,
        );
      })
      .catch(() => setQuotes([]))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [data]);

  if (parsed.status === "pending")
    return <SlotSkeleton label="tickers" lines={2} />;
  if (parsed.status === "error")
    return <SlotError label="tickers" reason={parsed.reason} />;
  if (!validated?.success)
    return <SlotError label="tickers" reason="Schema mismatch" />;

  function openTicker(quote: MarketTickerQuote) {
    setIsClosingSelected(false);
    setSelected(quote);
  }

  function closeTicker() {
    setIsClosingSelected(true);
    window.setTimeout(() => {
      setSelected(null);
      setIsClosingSelected(false);
    }, 140);
  }

  return (
    <SlotReveal>
      <SlotShell
        label={data?.title ?? "5d performance"}
        style={{
          background: "rgba(10, 9, 5, 0.59)",
          borderColor: "rgba(199, 159, 74, 0.105)",
        }}
      >
        {loading ? (
          <SlotSkeleton lines={1} />
        ) : quotes.length === 0 ? (
          <p className="text-[11px] text-[var(--fintheon-muted)]/55">
            No ticker data available.
          </p>
        ) : (
          <div className="relative">
            <div className="flex flex-wrap gap-1.5">
              {quotes.map((quote) => (
                <TickerPill
                  key={quote.label}
                  quote={quote}
                  active={selected?.label === quote.label}
                  onClick={() => openTicker(quote)}
                />
              ))}
            </div>
            {selected ? (
              <div className="absolute left-0 top-full z-20 mt-2">
                <MarketTickerCard
                  quote={selected}
                  onClose={closeTicker}
                  isClosing={isClosingSelected}
                />
              </div>
            ) : null}
          </div>
        )}
      </SlotShell>
    </SlotReveal>
  );
}

function TickerPill({
  quote,
  active,
  onClick,
}: {
  quote: MarketTickerQuote;
  active: boolean;
  onClick: () => void;
}) {
  const positive = quote.change >= 0;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`fintheon-ticker-pill ${active ? "is-active" : ""}`}
      data-direction={positive ? "up" : "down"}
      title={`${quote.label} ${formatPrice(quote.price)}`}
    >
      <span className="font-semibold">{quote.label}</span>
      <span>{formatPrice(quote.price)}</span>
      <span>{formatSignedPct(quote.changePercent)}</span>
    </button>
  );
}
