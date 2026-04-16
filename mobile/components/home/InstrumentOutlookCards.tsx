// [claude-code 2026-04-15] Instrument outlook cards — 5 instruments with IV bars, lean, range, drivers
import {
  useInstrumentOutlook,
  type InstrumentOutlook,
} from "../../hooks/useInstrumentOutlook";
import { SegmentedBar } from "../shared/SegmentedBar";

const LEAN_COLORS: Record<string, string> = {
  bullish: "var(--success)",
  bearish: "var(--error)",
  neutral: "var(--text-secondary)",
};

const LEAN_ARROWS: Record<string, string> = {
  bullish: "\u25B2",
  bearish: "\u25BC",
  neutral: "\u25C6",
};

function InstrumentCard({ item }: { item: InstrumentOutlook }) {
  const leanColor = LEAN_COLORS[item.lean] || "var(--text-secondary)";

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {/* Header: symbol + lean arrow */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 20,
            color: "var(--text-display)",
          }}
        >
          {item.symbol}
        </span>
        <span
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 12,
            color: leanColor,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          {LEAN_ARROWS[item.lean]} {item.lean}
        </span>
      </div>

      {/* IV heat bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 10,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--text-secondary)",
            width: 16,
          }}
        >
          IV
        </span>
        <div style={{ flex: 1 }}>
          <SegmentedBar
            value={Math.round(item.ivScore * 10)}
            segments={10}
            size="compact"
          />
        </div>
        <span
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 11,
            color: "var(--text-primary)",
            width: 24,
            textAlign: "right",
          }}
        >
          {item.ivScore.toFixed(1)}
        </span>
      </div>

      {/* Range + conviction */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 11,
            color: "var(--text-secondary)",
            letterSpacing: "0.04em",
          }}
        >
          {item.range[0] > 0 ? "+" : ""}
          {item.range[0]} to {item.range[1] > 0 ? "+" : ""}
          {item.range[1]} pts
        </span>
        <span
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 10,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--text-disabled)",
          }}
        >
          {item.conviction}
        </span>
      </div>

      {/* Top 2 drivers */}
      {item.drivers.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {item.drivers.slice(0, 2).map((d, i) => (
            <span
              key={i}
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 12,
                color: "var(--text-secondary)",
                lineHeight: 1.4,
              }}
            >
              {d}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function InstrumentOutlookCards() {
  const { instruments, isLoading } = useInstrumentOutlook();

  if (isLoading) {
    return (
      <span
        style={{
          fontFamily: "var(--font-data)",
          fontSize: 11,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--text-disabled)",
        }}
      >
        [LOADING INSTRUMENTS...]
      </span>
    );
  }

  if (instruments.length === 0) {
    return (
      <span
        style={{
          fontFamily: "var(--font-data)",
          fontSize: 11,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--text-disabled)",
        }}
      >
        [NO INSTRUMENT DATA]
      </span>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span
        style={{
          fontFamily: "var(--font-data)",
          fontSize: 11,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--text-secondary)",
        }}
      >
        INSTRUMENT OUTLOOK
      </span>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {instruments.map((item) => (
          <InstrumentCard key={item.symbol} item={item} />
        ))}
      </div>
    </div>
  );
}
