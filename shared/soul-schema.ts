// [claude-code 2026-04-19] S27 skeleton stub. W1d (Claude-05) populates.
// See docs/sprint-briefs/S27-T8-soul-conversion.md §1 for the full schema spec.

import { z } from "zod";

export const SoulSchema = z.object({
  schema_version: z.literal(1),
  agent_id: z.string(),
  identity: z.object({
    name: z.string(),
    role: z.string(),
  }),
  scope: z.array(z.string()),
  constraints: z.array(z.string()),
  grounding: z.object({
    source_of_truth: z.string(),
    extra: z.array(z.string()).optional(),
  }),
  tools: z.array(z.string()),
  handoff_rules: z.array(z.string()),
  voice_style: z.string(),
  memory_policy: z.object({
    writes: z.array(z.string()),
  }),
  model_preferences: z
    .object({
      prefer: z.string(),
      fallback: z.string().optional(),
    })
    .optional(),
});

export type Soul = z.infer<typeof SoulSchema>;
