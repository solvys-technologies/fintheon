// [claude-code 2026-05-19] SOL-63: agent-handoff slot — pill card for in-flight desk handoffs.

import type { CustomRendererProps } from "streamdown";
import {
  AgentHandoffDataSchema,
  type AgentHandoffData,
} from "../../../../shared/harper-cards";
import { parseSlotBody } from "./parseSlotBody";
import { SlotShell, SlotSkeleton, SlotError, SlotReveal } from "./SlotShell";

const STATUS_COLOR: Record<string, string> = {
  pending: "rgba(240, 176, 85, 0.9)",
  complete: "var(--fintheon-accent, #c79f4a)",
  error: "rgba(216, 79, 79, 0.9)",
};

const AGENT_LABEL: Record<string, string> = {
  harper: "Harper",
  oracle: "Oracle",
  feucht: "Feucht",
  consul: "Consul",
  herald: "Herald",
};

export function AgentHandoffSlot({ code, isIncomplete }: CustomRendererProps) {
  const parsed = parseSlotBody<AgentHandoffData>(code, isIncomplete);
  if (parsed.status === "pending")
    return <SlotSkeleton label="handoff" lines={2} />;
  if (parsed.status === "error")
    return <SlotError label="handoff" reason={parsed.reason} />;

  const validated = AgentHandoffDataSchema.safeParse(parsed.data);
  if (!validated.success)
    return <SlotError label="handoff" reason="Schema mismatch" />;

  const d = validated.data;
  const fromLabel = AGENT_LABEL[d.from] ?? d.from;
  const toLabel = AGENT_LABEL[d.to] ?? d.to;
  const statusColor = STATUS_COLOR[d.status] ?? STATUS_COLOR.pending;

  return (
    <SlotReveal>
      <SlotShell label="handoff">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-data, ui-monospace, monospace)",
              fontSize: 11,
              color: "rgba(240, 234, 214, 0.7)",
              letterSpacing: "0.04em",
            }}
          >
            {fromLabel} → {toLabel}
          </div>
          <span
            style={{
              fontFamily: "var(--font-data, ui-monospace, monospace)",
              fontSize: 9,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: statusColor,
              padding: "2px 6px",
              border: `1px solid ${statusColor}`,
              borderRadius: 3,
              flexShrink: 0,
            }}
          >
            {d.status}
          </span>
        </div>
        <div
          style={{
            fontFamily: "var(--font-body, ui-sans-serif)",
            fontSize: 12,
            color: "rgba(240, 234, 214, 0.75)",
            marginTop: 6,
            lineHeight: 1.4,
          }}
        >
          {d.question}
        </div>
        {d.preview && d.status === "complete" && (
          <div
            style={{
              fontFamily: "var(--font-body, ui-sans-serif)",
              fontSize: 11,
              color: "rgba(240, 234, 214, 0.5)",
              marginTop: 6,
              lineHeight: 1.4,
              fontStyle: "italic",
            }}
          >
            {d.preview}
          </div>
        )}
      </SlotShell>
    </SlotReveal>
  );
}
