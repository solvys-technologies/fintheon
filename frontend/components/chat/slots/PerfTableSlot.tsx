// [claude-code 2026-04-23] S32-T5 streamdown + TV charts
// Per-symbol / per-session performance table. PnL colored via fuse palette
// bullish/bearish; win rate as % with fading rule separators.

import type { CustomRendererProps } from "streamdown";
import { z } from "zod";
import { DEFAULT_TRADE_COLORS } from "../../../lib/fuse-palette";
import { parseSlotBody } from "./parseSlotBody";
import {
  SlotShell,
  SlotSkeleton,
  SlotError,
  SlotReveal,
  FADING_RULE_V,
} from "./SlotShell";

const PerfRowSchema = z.object({
  label: z.string(),
  pnl: z.number(),
  trades: z.number().int().nonnegative(),
  win_rate: z.number().min(0).max(1),
  avg_r: z.number().optional(),
});

const PerfTableSchema = z.object({
  rows: z.array(PerfRowSchema).min(1),
  scope: z.string().optional(),
  as_of: z.string().optional(),
});

type PerfTable = z.infer<typeof PerfTableSchema>;

const HEAD: React.CSSProperties = {
  fontFamily: "var(--font-data, ui-monospace, monospace)",
  fontSize: 9,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "rgba(240, 234, 214, 0.5)",
  textAlign: "right",
};

const CELL: React.CSSProperties = {
  fontFamily: "var(--font-data, ui-monospace, monospace)",
  fontSize: 12,
  color: "var(--fintheon-text, #f0ead6)",
  textAlign: "right",
  padding: "4px 8px",
};

const LABEL_CELL: React.CSSProperties = {
  ...CELL,
  textAlign: "left",
  color: "rgba(240, 234, 214, 0.85)",
};

function fmtPnl(pnl: number): string {
  const sign = pnl >= 0 ? "+" : "";
  return `${sign}${pnl.toFixed(2)}`;
}

export function PerfTableSlot({ code, isIncomplete }: CustomRendererProps) {
  const parsed = parseSlotBody<PerfTable>(code, isIncomplete);
  if (parsed.status === "pending")
    return <SlotSkeleton label="performance" lines={3} />;
  if (parsed.status === "error")
    return <SlotError label="performance" reason={parsed.reason} />;

  const validated = PerfTableSchema.safeParse(parsed.data);
  if (!validated.success)
    return <SlotError label="performance" reason="Schema mismatch" />;

  const { rows, scope, as_of } = validated.data;
  const hasAvgR = rows.some((r) => r.avg_r !== undefined);
  const columns = hasAvgR
    ? "1fr 1px 88px 1px 60px 1px 70px 1px 60px"
    : "1fr 1px 88px 1px 60px 1px 70px";

  const label = [scope, as_of].filter(Boolean).join(" · ") || "performance";

  return (
    <SlotReveal>
      <SlotShell label={label} style={{ padding: "10px 4px" }}>
        <div role="table" style={{ display: "flex", flexDirection: "column" }}>
          <div
            role="row"
            style={{
              display: "grid",
              gridTemplateColumns: columns,
              alignItems: "center",
              padding: "0 8px 6px",
            }}
          >
            <span style={{ ...HEAD, textAlign: "left" }}>Symbol</span>
            <div style={FADING_RULE_V} />
            <span style={HEAD}>PnL</span>
            <div style={FADING_RULE_V} />
            <span style={HEAD}>Trades</span>
            <div style={FADING_RULE_V} />
            <span style={HEAD}>Win %</span>
            {hasAvgR && (
              <>
                <div style={FADING_RULE_V} />
                <span style={HEAD}>Avg R</span>
              </>
            )}
          </div>
          {rows.map((r, i) => (
            <div
              key={i}
              role="row"
              style={{
                display: "grid",
                gridTemplateColumns: columns,
                alignItems: "center",
                borderTop:
                  i === 0 ? "none" : "1px solid rgba(199, 159, 74, 0.08)",
              }}
            >
              <span style={LABEL_CELL}>{r.label}</span>
              <div style={FADING_RULE_V} />
              <span
                style={{
                  ...CELL,
                  color:
                    r.pnl >= 0
                      ? DEFAULT_TRADE_COLORS.bullishColor
                      : DEFAULT_TRADE_COLORS.bearishColor,
                }}
              >
                {fmtPnl(r.pnl)}
              </span>
              <div style={FADING_RULE_V} />
              <span style={CELL}>{r.trades}</span>
              <div style={FADING_RULE_V} />
              <span style={CELL}>{Math.round(r.win_rate * 100)}%</span>
              {hasAvgR && (
                <>
                  <div style={FADING_RULE_V} />
                  <span style={CELL}>
                    {r.avg_r !== undefined ? r.avg_r.toFixed(2) : "—"}
                  </span>
                </>
              )}
            </div>
          ))}
        </div>
      </SlotShell>
    </SlotReveal>
  );
}
