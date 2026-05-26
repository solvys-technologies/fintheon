import { ExternalLink, X } from "lucide-react";
import type { MarketTickerQuote } from "./market-ticker-types";
import {
  formatPrice,
  formatSigned,
  formatSignedPct,
} from "./market-ticker-types";

export function MarketTickerCard({
  quote,
  onClose,
  isClosing,
}: {
  quote: MarketTickerQuote;
  onClose?: () => void;
  isClosing?: boolean;
}) {
  const positive = quote.change >= 0;
  const tvUrl = `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(quote.tvSymbol)}`;
  return (
    <div
      className={`fintheon-popover-surface fintheon-popover-motion w-[286px] p-3 ${
        isClosing ? "is-closing" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--fintheon-accent)]">
            {quote.label} · {quote.group}
          </p>
          <p className="mt-1 text-2xl font-semibold text-[var(--fintheon-text)]">
            {formatPrice(quote.price)}
          </p>
          <p
            className={
              positive ? "text-xs text-emerald-300" : "text-xs text-red-300"
            }
          >
            {formatSigned(quote.change)} ({formatSignedPct(quote.changePercent)}
            )
          </p>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--fintheon-muted)]/55"
            title="Close ticker card"
          >
            <X size={13} />
          </button>
        ) : null}
      </div>

      <Sparkline quote={quote} positive={positive} />

      <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
        <Metric label="Open" value={formatPrice(quote.open)} />
        <Metric
          label="Day range"
          value={`${formatPrice(quote.low)}-${formatPrice(quote.high)}`}
        />
        <Metric label="7D high" value={nullablePrice(quote.rolling7dHigh)} />
        <Metric label="7D low" value={nullablePrice(quote.rolling7dLow)} />
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--fintheon-muted)]/50">
          Live TV scanner · 7D{" "}
          {quote.historySource === "yahoo" ? "Yahoo" : "unverified"}
        </span>
        <a
          href={tvUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] text-[var(--fintheon-accent)]"
        >
          TV <ExternalLink size={11} />
        </a>
      </div>
    </div>
  );
}

function Sparkline({
  quote,
  positive,
}: {
  quote: MarketTickerQuote;
  positive: boolean;
}) {
  const points = quote.sparkline;
  if (points.length < 2) {
    return (
      <div className="mt-3 flex h-[74px] items-center justify-center rounded border border-[var(--fintheon-accent)]/10 bg-black/20 text-[10px] text-[var(--fintheon-muted)]/55">
        7D chart unavailable
      </div>
    );
  }
  const width = 260;
  const height = 74;
  const pad = 6;
  const values = points.map((point) => point.close);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const line = points
    .map((point, index) => {
      const x = pad + (index / (points.length - 1)) * (width - pad * 2);
      const y =
        height - pad - ((point.close - min) / span) * (height - pad * 2);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  const area = `${pad},${height - pad} ${line} ${width - pad},${height - pad}`;
  const color = positive ? "#34d399" : "#ef4444";
  const gradientId = `ticker-gradient-${quote.label}`;
  return (
    <svg
      className="mt-3 h-[74px] w-full overflow-visible"
      viewBox={`0 0 ${width} ${height}`}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.34" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={area} fill={`url(#${gradientId})`} stroke="none" />
      <polyline
        points={line}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-[var(--fintheon-accent)]/10 bg-black/20 p-2">
      <p className="text-[var(--fintheon-muted)]/45">{label}</p>
      <p className="mt-1 font-mono text-[var(--fintheon-text)]/70">{value}</p>
    </div>
  );
}

function nullablePrice(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value)
    ? formatPrice(value)
    : "N/A";
}
