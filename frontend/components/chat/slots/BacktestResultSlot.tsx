// [claude-code 2026-05-19] SOL-63: backtest-result slot — strategy metrics grid (PnL, win rate, max DD, trades).

import type { CustomRendererProps } from "streamdown";
import {
  BacktestResultDataSchema,
  type BacktestResultData,
} from "../../../../shared/harper-cards";
import { DEFAULT_TRADE_COLORS } from "../../../lib/fuse-palette";
import { parseSlotBody } from "./parseSlotBody";
import {
  SlotShell,
  SlotSkeleton,
  SlotError,
  SlotReveal,
  FADING_RULE,
  FADING_RULE_V,
} from "./SlotShell";

const SUBLABEL: React.CSSProperties = {
  fontFamily: "var(--font-data, ui-monospace, monospace)",
  fontSize: 9,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "rgba(240, 234, 214, 0.5)",
  marginBottom: 2,
};

const METRIC: React.CSSProperties = {
  fontFamily: "var(--font-data, ui-monospace, monospace)",
  fontSize: 13,
  color: "var(--fintheon-text, #f0ead6)",
  fontVariantNumeric: "tabular-nums",
};

export function BacktestResultSlot({ code, isIncomplete }: CustomRendererProps) {
  const parsed = parseSlotBody<BacktestResultData>(code, isIncomplete);
  if (parsed.status === "pending")
    return <SlotSkeleton label="backtest" lines={3} />;
  if (parsed.status === "error")
    return <SlotError label="backtest" reason={parsed.reason} />;

  const validated = BacktestResultDataSchema.safeParse(parsed.data);
  if (!validated.success)
    return <SlotError label="backtest" reason="Schema mismatch" />;

  const d = validated.data;
  const pnlColor =
    d.pnl >= 0
      ? DEFAULT_TRADE_COLORS.bullishColor
      : DEFAULT_TRADE_COLORS.bearishColor;

  return (
    <SlotReveal>
      <SlotShell label={`backtest · ${d.period}`}>
        <div
          style={{
            fontFamily: "var(--font-display, ui-sans-serif)",
            fontSize: 13,
            fontWeight: 500,
            color: "var(--fintheon-text, #f0ead6)",
            marginBottom: 8,
          }}
        >
          {d.strategy}
        </div>
        <div style={FADING_RULE} />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1px 1fr 1px 1fr 1px 1fr",
            alignItems: "start",
            marginTop: 8,
          }}
        >
          <div style={{ padding: "0 8px" }}>
            <div style={SUBLABEL}>PnL</div>
            <div style={{ ...METRIC, color: pnlColor }}>
              {d.pnl >= 0 ? "+" : ""}
              {d.pnl.toFixed(2)}
            </div>
          </div>
          <div style={FADING_RULE_V} />
          <div style={{ padding: "0 8px" }}>
            <div style={SUBLABEL}>Win %</div>
            <div style={METRIC}>{Math.round(d.win_rate * 100)}%</div>
          </div>
          <div style={FADING_RULE_V} />
          <div style={{ padding: "0 8px" }}>
            <div style={SUBLABEL}>Max DD</div>
            <div style={{ ...METRIC, color: DEFAULT_TRADE_COLORS.bearishColor }}>
              {d.max_dd.toFixed(2)}
            </div>
          </div>
          <div style={FADING_RULE_V} />
          <div style={{ padding: "0 8px" }}>
            <div style={SUBLABEL}>Trades</div>
            <div style={METRIC}>{d.trades_shown}</div>
          </div>
        </div>
        {d.sharpe !== undefined && (
          <div
            style={{
              marginTop: 8,
              fontFamily: "var(--font-data, ui-monospace, monospace)",
              fontSize: 10,
              color: "rgba(240, 234, 214, 0.55)",
              letterSpacing: "0.06em",
            }}
          >
            Sharpe {d.sharpe.toFixed(2)}
          </div>
        )}
        {d.notes && (
          <div
            style={{
              fontFamily: "var(--font-body, ui-sans-serif)",
              fontSize: 11,
              color: "rgba(240, 234, 214, 0.5)",
              marginTop: 6,
              lineHeight: 1.4,
            }}
          >
            {d.notes}
          </div>
        )}
      </SlotShell>
    </SlotReveal>
  );
}
