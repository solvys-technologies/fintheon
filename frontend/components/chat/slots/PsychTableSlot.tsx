// [claude-code 2026-04-23] S32-T5 streamdown + TV charts
// Compact psych table: ER score, discipline score, infractions count. Columns
// separated by vertical fading rules per "fading rulers between cells/columns".

import type { CustomRendererProps } from "streamdown";
import { z } from "zod";
import { parseSlotBody } from "./parseSlotBody";
import {
  SlotShell,
  SlotSkeleton,
  SlotError,
  SlotReveal,
  FADING_RULE_V,
} from "./SlotShell";

const PsychRowSchema = z.object({
  label: z.string(),
  er: z.number(),
  discipline: z.number(),
  infractions: z.number().int().nonnegative(),
});

const PsychTableSchema = z.object({
  rows: z.array(PsychRowSchema).min(1),
  as_of: z.string().optional(),
});

type PsychTable = z.infer<typeof PsychTableSchema>;

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
  color: "rgba(240, 234, 214, 0.8)",
};

function colorForEr(er: number): string {
  if (er >= 8) return "rgba(216, 79, 79, 0.9)";
  if (er >= 6) return "rgba(240, 176, 85, 0.9)";
  if (er >= 4) return "var(--fintheon-accent, #c79f4a)";
  return "rgba(184, 176, 156, 0.7)";
}

export function PsychTableSlot({ code, isIncomplete }: CustomRendererProps) {
  const parsed = parseSlotBody<PsychTable>(code, isIncomplete);
  if (parsed.status === "pending")
    return <SlotSkeleton label="psych" lines={3} />;
  if (parsed.status === "error")
    return <SlotError label="psych" reason={parsed.reason} />;

  const validated = PsychTableSchema.safeParse(parsed.data);
  if (!validated.success)
    return <SlotError label="psych" reason="Schema mismatch" />;

  const { rows, as_of } = validated.data;

  return (
    <SlotReveal>
      <SlotShell
        label={`psych${as_of ? ` · ${as_of}` : ""}`}
        style={{ padding: "10px 4px" }}
      >
        <div style={{ overflowX: "auto" }}>
          <div
            role="table"
            style={{ display: "flex", flexDirection: "column", minWidth: 280 }}
          >
            <div
              role="row"
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1px 70px 1px 90px 1px 80px",
                alignItems: "center",
                padding: "0 8px 6px",
              }}
            >
              <span style={{ ...HEAD, textAlign: "left" }}>Session</span>
              <div style={FADING_RULE_V} />
              <span style={HEAD}>ER</span>
              <div style={FADING_RULE_V} />
              <span style={HEAD}>Discipline</span>
              <div style={FADING_RULE_V} />
              <span style={HEAD}>Infractions</span>
            </div>
            {rows.map((r, i) => (
              <div
                key={i}
                role="row"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1px 70px 1px 90px 1px 80px",
                  alignItems: "center",
                  borderTop:
                    i === 0 ? "none" : "1px solid rgba(199, 159, 74, 0.08)",
                }}
              >
                <span style={LABEL_CELL}>{r.label}</span>
                <div style={FADING_RULE_V} />
                <span style={{ ...CELL, color: colorForEr(r.er) }}>
                  {r.er.toFixed(1)}
                </span>
                <div style={FADING_RULE_V} />
                <span style={CELL}>{r.discipline.toFixed(1)}</span>
                <div style={FADING_RULE_V} />
                <span style={CELL}>{r.infractions}</span>
              </div>
            ))}
          </div>
        </div>
      </SlotShell>
    </SlotReveal>
  );
}
