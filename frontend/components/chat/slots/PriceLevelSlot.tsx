// [claude-code 2026-05-19] SOL-63: price-level slot — Feucht desk support/resistance/trigger table.

import type { CustomRendererProps } from "streamdown";
import {
  PriceLevelDataSchema,
  type PriceLevelData,
} from "../../../../shared/harper-cards";
import { parseSlotBody } from "./parseSlotBody";
import {
  SlotShell,
  SlotSkeleton,
  SlotError,
  SlotReveal,
  FADING_RULE_V,
} from "./SlotShell";

const TYPE_COLOR: Record<string, string> = {
  support: "var(--fintheon-accent, #c79f4a)",
  resistance: "rgba(216, 79, 79, 0.9)",
  trigger: "rgba(240, 176, 85, 0.9)",
};

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

export function PriceLevelSlot({ code, isIncomplete }: CustomRendererProps) {
  const parsed = parseSlotBody<PriceLevelData>(code, isIncomplete);
  if (parsed.status === "pending")
    return <SlotSkeleton label="levels" lines={3} />;
  if (parsed.status === "error")
    return <SlotError label="levels" reason={parsed.reason} />;

  const validated = PriceLevelDataSchema.safeParse(parsed.data);
  if (!validated.success)
    return <SlotError label="levels" reason="Schema mismatch" />;

  const d = validated.data;
  const label = d.as_of ? `${d.symbol} · ${d.as_of}` : d.symbol;

  return (
    <SlotReveal>
      <SlotShell label={`levels · ${label}`} style={{ padding: "10px 4px" }}>
        {d.spot !== undefined && (
          <div
            style={{
              fontFamily: "var(--font-data, ui-monospace, monospace)",
              fontSize: 10,
              color: "rgba(240, 234, 214, 0.55)",
              letterSpacing: "0.06em",
              padding: "0 8px 6px",
            }}
          >
            spot {d.spot}
          </div>
        )}
        <div style={{ overflowX: "auto" }}>
          <div
            role="table"
            style={{ display: "flex", flexDirection: "column", minWidth: 240 }}
          >
            <div
              role="row"
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1px 80px 1px 70px 1px 64px",
                alignItems: "center",
                padding: "0 8px 6px",
              }}
            >
              <span style={{ ...HEAD, textAlign: "left" }}>Label</span>
              <div style={FADING_RULE_V} />
              <span style={HEAD}>Price</span>
              <div style={FADING_RULE_V} />
              <span style={HEAD}>Type</span>
              <div style={FADING_RULE_V} />
              <span style={HEAD}>Dist</span>
            </div>
            {d.levels.map((r, i) => (
              <div
                key={i}
                role="row"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1px 80px 1px 70px 1px 64px",
                  alignItems: "center",
                  borderTop:
                    i === 0 ? "none" : "1px solid rgba(199, 159, 74, 0.08)",
                }}
              >
                <span
                  style={{
                    ...CELL,
                    textAlign: "left",
                    color: "rgba(240, 234, 214, 0.85)",
                  }}
                >
                  {r.label}
                </span>
                <div style={FADING_RULE_V} />
                <span style={CELL}>{r.price}</span>
                <div style={FADING_RULE_V} />
                <span
                  style={{
                    ...CELL,
                    color: TYPE_COLOR[r.type] ?? "var(--fintheon-text)",
                    fontSize: 10,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                  }}
                >
                  {r.type}
                </span>
                <div style={FADING_RULE_V} />
                <span style={{ ...CELL, color: "rgba(240, 234, 214, 0.5)" }}>
                  {r.distance !== undefined
                    ? `${r.distance > 0 ? "+" : ""}${r.distance}`
                    : "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
        {d.note && (
          <div
            style={{
              fontFamily: "var(--font-body, ui-sans-serif)",
              fontSize: 11,
              color: "rgba(240, 234, 214, 0.55)",
              padding: "6px 8px 0",
              lineHeight: 1.4,
            }}
          >
            {d.note}
          </div>
        )}
      </SlotShell>
    </SlotReveal>
  );
}
