// [claude-code 2026-04-19] S27-T8 W1d: SOUL.md Zod schema — every SOUL file parses against this.
// See docs/sprint-briefs/S27-T8-soul-conversion.md §1 for the spec.

import { z } from "zod";

export const AgentIdSchema = z.enum([
  "harper",
  "oracle",
  "feucht",
  "consul",
  "herald",
]);

export type AgentId = z.infer<typeof AgentIdSchema>;

export const SoulSchema = z.object({
  schema_version: z.literal(1),
  agent_id: AgentIdSchema,

  identity: z.object({
    name: z.string().min(1),
    role: z.string().min(1),
    self_description: z.string().optional(),
  }),

  scope: z.array(z.string().min(1)).min(1),

  constraints: z.array(z.string().min(1)).min(1),

  grounding: z.object({
    source_of_truth: z.string().min(1),
    extra: z.array(z.string().min(1)).optional(),
  }),

  tools: z.array(z.string().min(1)),

  handoff_rules: z.array(z.string().min(1)),

  voice_style: z.string().min(1),

  memory_policy: z.object({
    writes: z.array(z.string().min(1)),
  }),

  model_preferences: z
    .object({
      prefer: z.string().min(1),
      fallback: z.string().min(1).optional(),
    })
    .optional(),
});

export type Soul = z.infer<typeof SoulSchema>;

export interface LoadedSoul extends Soul {
  grounding_text: string;
  extras_text: string[];
  soul_path: string;
}
