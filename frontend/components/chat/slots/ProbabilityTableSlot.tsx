// [claude-code 2026-05-19] SOL-63: probability-table slot — Oracle outcome rows with probability bars.

import type { CustomRendererProps } from "streamdown";
import {
  ProbabilityTableDataSchema,
  type ProbabilityTableData,
} from "../../../../shared/harper-cards";
import { parseSlotBody } from "./parseSlotBody";
import {
  SlotShell,
  SlotSkeleton,
  SlotError,
  SlotReveal,
  FADING_RULE,
} from "./SlotShell";

export function ProbabilityTableSlot({
  code,
  isIncomplete,
}: CustomRendererProps) {
  const parsed = parseSlotBody<ProbabilityTableData>(code, isIncomplete);
  if (parsed.status === "pending")
    return <SlotSkeleton label="probabilities" lines={3} />;
  if (parsed.status === "error")
    return <SlotError label="probabilities" reason={parsed.reason} />;

  const validated = ProbabilityTableDataSchema.safeParse(parsed.data);
  if (!validated.success)
    return <SlotError label="probabilities" reason="Schema mismatch" />;

  const d = validated.data;
  const metaLabel = [d.source, d.as_of].filter(Boolean).join(" · ");

  return (
    <SlotReveal>
      <SlotShell label="probabilities">
        <div
          style={{
            fontFamily: "var(--font-display, ui-sans-serif)",
            fontSize: 13,
            fontWeight: 500,
            color: "var(--fintheon-text, #f0ead6)",
            marginBottom: 4,
            lineHeight: 1.3,
          }}
        >
          {d.headline}
        </div>
        {metaLabel && (
          <div
            style={{
              fontFamily: "var(--font-data, ui-monospace, monospace)",
              fontSize: 9,
              letterSpacing: "0.1em",
              color: "rgba(240, 234, 214, 0.4)",
              marginBottom: 8,
              textTransform: "uppercase",
            }}
          >
            {metaLabel}
          </div>
        )}
        <div style={FADING_RULE} />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            marginTop: 6,
          }}
        >
          {d.rows.map((r, i) => (
            <div key={i}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  marginBottom: 3,
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-body, ui-sans-serif)",
                    fontSize: 12,
                    color: "rgba(240, 234, 214, 0.85)",
                  }}
                >
                  {r.label}
                </span>
                <div
                  style={{ display: "flex", alignItems: "baseline", gap: 6 }}
                >
                  {r.delta !== undefined && (
                    <span
                      style={{
                        fontFamily: "var(--font-data, ui-monospace, monospace)",
                        fontSize: 9,
                        color:
                          r.delta >= 0
                            ? "var(--fintheon-accent, #c79f4a)"
                            : "rgba(216, 79, 79, 0.9)",
                      }}
                    >
                      {r.delta >= 0 ? "+" : ""}
                      {(r.delta * 100).toFixed(0)}pp
                    </span>
                  )}
                  <span
                    style={{
                      fontFamily: "var(--font-data, ui-monospace, monospace)",
                      fontSize: 13,
                      color: "var(--fintheon-accent, #c79f4a)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {Math.round(r.p * 100)}%
                  </span>
                </div>
              </div>
              <div
                style={{
                  height: 2,
                  background: "rgba(199, 159, 74, 0.12)",
                  borderRadius: 1,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${Math.round(r.p * 100)}%`,
                    background: "var(--fintheon-accent, #c79f4a)",
                    borderRadius: 1,
                  }}
                />
              </div>
              {r.note && (
                <div
                  style={{
                    fontFamily: "var(--font-body, ui-sans-serif)",
                    fontSize: 10,
                    color: "rgba(240, 234, 214, 0.4)",
                    marginTop: 2,
                  }}
                >
                  {r.note}
                </div>
              )}
            </div>
          ))}
        </div>
      </SlotShell>
    </SlotReveal>
  );
}
