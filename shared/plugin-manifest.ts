// [claude-code 2026-04-19] S27 skeleton stub. W1a (Claude-02) populates.
// Hermes plugin manifest schema — mirrors NousResearch Hermes Agent v0.9 plugin.yaml format.

import { z } from "zod";

export const PluginManifestSchema = z.object({
  schema_version: z.literal(1),
  name: z.string(),
  version: z.string(),
  plugin_type: z.enum(["context_engine", "voice", "tool", "skill", "routing"]),
  entry_point: z.string(),
  config_schema: z.record(z.any()).optional(),
  provides: z.array(z.string()),
  requires: z.array(z.string()).default([]),
  license: z.string(),
});

export type PluginManifest = z.infer<typeof PluginManifestSchema>;
