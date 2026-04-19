// [claude-code 2026-04-19] S27-T2 — W1a schema layer for Hermes plugin manifests.
// See docs/sprint-briefs/S27-T2-context-sandbox.md for spec context.
// Mirrors the NousResearch Hermes Agent v0.9 plugin.yaml format so Fintheon-authored
// plugins round-trip with the upstream ecosystem (hermes-lcm, icarus-plugin, GEPA).
//
// Consumed by: hermes-sidecar/ boot loader (W1b), T11 GEPA loop (W2e) when it opens
// evolution PRs against `soul-evolution/` branch.

import { z } from "zod";

export const PLUGIN_MANIFEST_SCHEMA_VERSION = 1 as const;

// ─── Plugin type ──────────────────────────────────────────────────────────────
// Upstream Hermes v0.9 ships five first-class plugin surfaces. Fintheon uses all five:
//   context_engine → hermes-lcm (default) or in-house engine override
//   voice          → T5 voicebox / Qwen3-TTS bridge
//   tool           → T3 A2A handoff tools + T6 browser operator + T10 desks
//   skill          → agentskills.io manifests (see skill-manifest.ts)
//   routing        → T9 Smart Model Routing selector

export const PluginTypeSchema = z.enum([
  "context_engine",
  "voice",
  "tool",
  "skill",
  "routing",
]);
export type PluginType = z.infer<typeof PluginTypeSchema>;

// ─── Runtime ─────────────────────────────────────────────────────────────────
// Hermes loads plugins in either its native Python runtime (via uv) or delegates
// to a Node side-process through stdio when `runtime: node`. Fintheon plugins
// favor `node` so they share the backend-hono tsconfig; hermes-lcm stays `python`.

export const PluginRuntimeSchema = z.enum(["python", "node"]);
export type PluginRuntime = z.infer<typeof PluginRuntimeSchema>;

// ─── Plugin manifest ─────────────────────────────────────────────────────────

export const PluginManifestSchema = z.object({
  schema_version: z.literal(PLUGIN_MANIFEST_SCHEMA_VERSION),
  name: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+(?:[-+].+)?$/),
  plugin_type: PluginTypeSchema,
  runtime: PluginRuntimeSchema.default("python"),
  entry_point: z.string().min(1), // module:callable for python, path for node
  config_schema: z.record(z.string(), z.unknown()).optional(),
  // ─── Capability manifest ──────────────────────────────────────────────────
  // `provides` names capability keys this plugin exposes (e.g. "context.engine.lcm",
  // "routing.select", "voice.tts.qwen3"). `requires` names capability keys this
  // plugin needs another plugin to provide.
  provides: z.array(z.string()).min(1),
  requires: z.array(z.string()).default([]),
  // ─── Metadata ─────────────────────────────────────────────────────────────
  authors: z.array(z.string()).default([]),
  homepage: z.string().url().optional(),
  license: z.string().min(1),
  // Rollback flag — if set the sidecar boot loader will skip this plugin when
  // the matching env var is `false`. Lets us ship plugins dark.
  rollback_flag: z.string().optional(),
});
export type PluginManifest = z.infer<typeof PluginManifestSchema>;

// ─── Plugin registry entry (runtime projection of a loaded manifest) ─────────

export const PluginStatusSchema = z.enum([
  "loaded",
  "disabled",
  "error",
  "pending",
]);
export type PluginStatus = z.infer<typeof PluginStatusSchema>;

export const LoadedPluginSchema = z.object({
  manifest: PluginManifestSchema,
  status: PluginStatusSchema,
  loaded_at: z.string().optional(), // ISO 8601
  error: z.string().optional(),
});
export type LoadedPlugin = z.infer<typeof LoadedPluginSchema>;
