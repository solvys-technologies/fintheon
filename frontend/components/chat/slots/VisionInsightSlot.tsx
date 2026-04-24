// [claude-code 2026-04-23] S32-T5 streamdown + TV charts
// Proactive Harper Vision card — a T2-style card Harper can push inline to
// surface a desktop/vision observation without waiting for the user to ask.

import type { CustomRendererProps } from "streamdown";
import { z } from "zod";
import { parseSlotBody } from "./parseSlotBody";
import {
  SlotShell,
  SlotSkeleton,
  SlotError,
  SlotReveal,
  FADING_RULE,
} from "./SlotShell";

const VisionInsightSchema = z.object({
  title: z.string(),
  observation: z.string(),
  cta: z.string().optional(),
  href: z.string().optional(),
  source: z.enum(["desktop", "vision", "ambient"]).default("vision"),
  as_of: z.string().optional(),
});

type VisionInsight = z.infer<typeof VisionInsightSchema>;

export function VisionInsightSlot({ code, isIncomplete }: CustomRendererProps) {
  const parsed = parseSlotBody<VisionInsight>(code, isIncomplete);
  if (parsed.status === "pending")
    return <SlotSkeleton label="vision" lines={2} />;
  if (parsed.status === "error")
    return <SlotError label="vision" reason={parsed.reason} />;

  const validated = VisionInsightSchema.safeParse(parsed.data);
  if (!validated.success)
    return <SlotError label="vision" reason="Schema mismatch" />;

  const d = validated.data;

  const body = (
    <SlotShell label={`vision · ${d.source}`}>
      <div
        style={{
          fontFamily: "var(--font-display, ui-sans-serif)",
          fontSize: 13,
          fontWeight: 500,
          color: "var(--fintheon-text, #f0ead6)",
          marginBottom: 4,
        }}
      >
        {d.title}
      </div>
      <div style={FADING_RULE} />
      <div
        style={{
          fontFamily: "var(--font-body, ui-sans-serif)",
          fontSize: 12,
          color: "rgba(240, 234, 214, 0.72)",
          lineHeight: 1.5,
        }}
      >
        {d.observation}
      </div>
      {d.cta && (
        <div
          style={{
            fontFamily: "var(--font-data, ui-monospace, monospace)",
            fontSize: 10,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--fintheon-accent, #c79f4a)",
            marginTop: 8,
          }}
        >
          {d.cta} →
        </div>
      )}
    </SlotShell>
  );

  if (d.href) {
    return (
      <SlotReveal>
        <a
          href={d.href}
          style={{ textDecoration: "none", color: "inherit", display: "block" }}
        >
          {body}
        </a>
      </SlotReveal>
    );
  }
  return <SlotReveal>{body}</SlotReveal>;
}
