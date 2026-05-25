import type { Context } from "hono";
import { z } from "zod";
import { buildSensemakingMap } from "../../services/narrative-sensemaking/sensemaker.js";

const sensemakingBodySchema = z.object({
  query: z.string().trim().max(1200).default(""),
  attachedHeadlineIds: z.array(z.string().trim().min(1)).min(1).max(12),
  orientation: z.enum(["horizontal", "vertical"]).default("horizontal"),
  renderMode: z.enum(["flow", "mermaid"]).default("flow"),
  reasoningLevel: z.enum(["quick", "standard", "deep", "max"]).default("standard"),
});

export async function createNarrativeSensemaking(c: Context) {
  const raw = await c.req.json().catch(() => ({}));
  const parsed = sensemakingBodySchema.safeParse(raw);
  if (!parsed.success) {
    return c.json(
      { error: "validation failed", issues: parsed.error.issues },
      400,
    );
  }

  try {
    const result = await buildSensemakingMap(parsed.data);
    return c.json(result);
  } catch (err) {
    console.error("[NarrativeSensemaking] map build failed", err);
    return c.json({ error: "Failed to build narrative sensemaking map" }, 500);
  }
}
