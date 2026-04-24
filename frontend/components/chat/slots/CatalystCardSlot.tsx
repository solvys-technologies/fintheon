// [claude-code 2026-04-23] S32-T5 streamdown + TV charts
// Reuses the RiskFlagData schema from shared/harper-cards.ts so Harper can emit
// a RiskFlow catalyst through the same JSON contract the CardPartRenderer used.
// Severity → fuse palette color; headline + body with fading rule between.

import type { CustomRendererProps } from "streamdown";
import {
  RiskFlagDataSchema,
  type RiskFlagData,
} from "../../../../shared/harper-cards";
import { colorForSeverity, type FuseSeverity } from "../../../lib/fuse-palette";
import { parseSlotBody } from "./parseSlotBody";
import {
  SlotShell,
  SlotSkeleton,
  SlotError,
  SlotReveal,
  FADING_RULE,
} from "./SlotShell";

const SEVERITY_MAP: Record<string, FuseSeverity> = {
  low: "low",
  med: "medium",
  medium: "medium",
  high: "high",
  critical: "critical",
};

export function CatalystCardSlot({ code, isIncomplete }: CustomRendererProps) {
  const parsed = parseSlotBody<RiskFlagData>(code, isIncomplete);
  if (parsed.status === "pending")
    return <SlotSkeleton label="catalyst" lines={3} />;
  if (parsed.status === "error")
    return <SlotError label="catalyst" reason={parsed.reason} />;

  const validated = RiskFlagDataSchema.safeParse(parsed.data);
  if (!validated.success)
    return <SlotError label="catalyst" reason="Schema mismatch" />;

  const d = validated.data;
  const sev = SEVERITY_MAP[d.severity] ?? "neutral";
  const color = colorForSeverity(sev);

  return (
    <SlotReveal>
      <SlotShell label={`catalyst · ${d.severity}`}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: color,
              flexShrink: 0,
            }}
          />
          <div
            style={{
              fontFamily: "var(--font-display, ui-sans-serif)",
              fontSize: 14,
              fontWeight: 500,
              color: "var(--fintheon-text, #f0ead6)",
              lineHeight: 1.3,
            }}
          >
            {d.headline}
          </div>
        </div>
        <div style={FADING_RULE} />
        <div
          style={{
            fontFamily: "var(--font-body, ui-sans-serif)",
            fontSize: 12,
            color: "rgba(240, 234, 214, 0.75)",
            lineHeight: 1.5,
          }}
        >
          {d.body}
        </div>
        {d.iv_context && (
          <div
            style={{
              fontFamily: "var(--font-data, ui-monospace, monospace)",
              fontSize: 10,
              letterSpacing: "0.05em",
              color: "var(--fintheon-accent, #c79f4a)",
              marginTop: 6,
              opacity: 0.8,
            }}
          >
            IV · {d.iv_context}
          </div>
        )}
        {d.source && (
          <div
            style={{
              fontFamily: "var(--font-data, ui-monospace, monospace)",
              fontSize: 9,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "rgba(240, 234, 214, 0.4)",
              marginTop: 4,
            }}
          >
            {d.source}
          </div>
        )}
      </SlotShell>
    </SlotReveal>
  );
}
