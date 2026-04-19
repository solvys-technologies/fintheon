// [claude-code 2026-04-19] S27 skeleton stub. W1a (Claude-02) populates; T10 (Claude-10) consumes.
// See docs/sprint-briefs/S27-T10-skills-hub.md §1 for the agentskills.io schema spec.

import { z } from "zod";

export const SkillManifestSchema = z.object({
  schema_version: z.literal(1),
  id: z.string(),
  name: z.string(),
  version: z.string(),
  description: z.string(),
  entry_point: z.string(),
  soul: z.string().optional(),
  tools: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      input_schema: z.record(z.any()),
    }),
  ),
  permissions: z.array(
    z.enum([
      "read_market_data",
      "read_news",
      "read_filings",
      "write_notes",
      "browser_allowlist",
      "browser_universal",
    ]),
  ),
  security_scan: z
    .object({
      data_exfil_risks: z.array(z.string()).default([]),
      prompt_injection_vectors: z.array(z.string()).default([]),
      destructive_ops: z.array(z.string()).default([]),
    })
    .optional(),
  authors: z.array(z.string()),
  license: z.string(),
});

export type SkillManifest = z.infer<typeof SkillManifestSchema>;
