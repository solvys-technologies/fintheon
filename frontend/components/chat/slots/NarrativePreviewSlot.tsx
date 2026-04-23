// [claude-code 2026-04-23] S32-T5 streamdown + TV charts
// NarrativeFlow preview card — title + one-line description + symbol chips.
// Links through to Sanctum when thread_id is present.

import type { CustomRendererProps } from "streamdown";
import {
  NarrativeThreadDataSchema,
  type NarrativeThreadData,
} from "../../../../shared/harper-cards";
import { parseSlotBody } from "./parseSlotBody";
import { SlotShell, SlotSkeleton, SlotError, SlotReveal } from "./SlotShell";

export function NarrativePreviewSlot({
  code,
  isIncomplete,
}: CustomRendererProps) {
  const parsed = parseSlotBody<NarrativeThreadData>(code, isIncomplete);
  if (parsed.status === "pending")
    return <SlotSkeleton label="narrative" lines={2} />;
  if (parsed.status === "error")
    return <SlotError label="narrative" reason={parsed.reason} />;

  const validated = NarrativeThreadDataSchema.safeParse(parsed.data);
  if (!validated.success)
    return <SlotError label="narrative" reason="Schema mismatch" />;

  const d = validated.data;
  const confidencePct = Math.round(d.confidence * 100);

  const content = (
    <SlotShell label={`narrative · ${confidencePct}% conf`}>
      <div
        style={{
          fontFamily: "var(--font-display, ui-sans-serif)",
          fontSize: 13,
          fontWeight: 500,
          color: "var(--fintheon-text, #f0ead6)",
          marginBottom: 4,
        }}
      >
        {d.catalyst}
      </div>
      {d.summary && (
        <div
          style={{
            fontFamily: "var(--font-body, ui-sans-serif)",
            fontSize: 12,
            color: "rgba(240, 234, 214, 0.7)",
            lineHeight: 1.5,
            marginBottom: 6,
          }}
        >
          {d.summary}
        </div>
      )}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {d.symbols.map((s) => (
          <span
            key={s}
            style={{
              fontFamily: "var(--font-data, ui-monospace, monospace)",
              fontSize: 10,
              letterSpacing: "0.06em",
              color: "var(--fintheon-accent, #c79f4a)",
              padding: "2px 6px",
              border: "1px solid rgba(199, 159, 74, 0.25)",
              borderRadius: 4,
            }}
          >
            {s}
          </span>
        ))}
      </div>
    </SlotShell>
  );

  if (d.thread_id) {
    return (
      <SlotReveal>
        <a
          href={`/sanctum/${d.thread_id}`}
          style={{ textDecoration: "none", color: "inherit", display: "block" }}
        >
          {content}
        </a>
      </SlotReveal>
    );
  }
  return <SlotReveal>{content}</SlotReveal>;
}
