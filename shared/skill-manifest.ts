// [claude-code 2026-04-19] S27-T10 §1 — W1a schema layer for agentskills.io-compatible skill manifests.
// See docs/sprint-briefs/S27-T10-skills-hub.md §1-4 for spec.
// Consumed by: skills/{harper,oracle,feucht,consul,herald}/skill.yaml parsers (W2e),
// importer + security scanner (W2e), `GET /api/skills` registry (W2e), Hermes sidecar skills endpoint.

import { z } from "zod";

export const SKILL_MANIFEST_SCHEMA_VERSION = 1 as const;

// ─── Permissions ──────────────────────────────────────────────────────────────
// Coarse-grained capability tags. The security scanner uses these to cross-check
// declared intent against static scan findings.

export const SkillPermissionSchema = z.enum([
  "read_market_data",
  "read_news",
  "read_filings",
  "write_notes",
  "browser_allowlist",
  "browser_universal",
]);
export type SkillPermission = z.infer<typeof SkillPermissionSchema>;

// ─── Tool declaration ─────────────────────────────────────────────────────────

export const SkillToolSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  input_schema: z.record(z.string(), z.unknown()), // JSON-Schema blob; validated at invoke time
  output_schema: z.record(z.string(), z.unknown()).optional(),
});
export type SkillTool = z.infer<typeof SkillToolSchema>;

// ─── Static security-scan declaration ─────────────────────────────────────────
// Skill authors pre-declare known-risky surface area so the scanner can diff.
// Anything the scanner finds that is NOT declared here is treated as a violation.

export const SkillSecurityScanSchema = z.object({
  data_exfil_risks: z.array(z.string()).default([]),
  prompt_injection_vectors: z.array(z.string()).default([]),
  destructive_ops: z.array(z.string()).default([]),
});
export type SkillSecurityScanDeclaration = z.infer<typeof SkillSecurityScanSchema>;

// ─── Manifest ─────────────────────────────────────────────────────────────────

export const SkillManifestSchema = z.object({
  schema_version: z.literal(SKILL_MANIFEST_SCHEMA_VERSION),
  id: z.string().regex(/^[a-z0-9][a-z0-9._-]*$/), // e.g. "fintheon.harper"
  name: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+(?:[-+].+)?$/), // semver
  description: z.string().min(1),
  entry_point: z.string().min(1), // repo-relative path to handler module
  soul: z.string().optional(), // repo-relative path to SOUL.md
  tools: z.array(SkillToolSchema),
  permissions: z.array(SkillPermissionSchema),
  security_scan: SkillSecurityScanSchema.optional(),
  authors: z.array(z.string()).min(1),
  license: z.string().min(1),
  // ─── Hub-only metadata (populated by the importer, not authors) ─────────────
  source_url: z.string().url().optional(),
  homepage: z.string().url().optional(),
  tags: z.array(z.string()).default([]),
});
export type SkillManifest = z.infer<typeof SkillManifestSchema>;

// ─── Scan report (output of security-scanner, stored in skill_imports) ────────

export const SkillScanFindingSchema = z.object({
  category: z.enum([
    "data_exfil",
    "prompt_injection",
    "destructive_op",
    "supply_chain",
  ]),
  severity: z.enum(["info", "warn", "block"]),
  message: z.string(),
  file: z.string().optional(),
  line: z.number().int().positive().optional(),
  declared: z.boolean().default(false), // true if author pre-declared in security_scan
});
export type SkillScanFinding = z.infer<typeof SkillScanFindingSchema>;

export const SkillScanReportSchema = z.object({
  skill_id: z.string(),
  version: z.string(),
  scanned_at: z.string(), // ISO 8601
  status: z.enum(["passed", "warned", "rejected"]),
  findings: z.array(SkillScanFindingSchema),
});
export type SkillScanReport = z.infer<typeof SkillScanReportSchema>;

// ─── Import result (returned by `importSkillFromHub`) ─────────────────────────

export const SkillImportResultSchema = z.discriminatedUnion("imported", [
  z.object({
    imported: z.literal(true),
    manifest: SkillManifestSchema,
    report: SkillScanReportSchema,
  }),
  z.object({
    imported: z.literal(false),
    rejected_because: z.array(z.string()).min(1),
    report: SkillScanReportSchema.optional(),
  }),
]);
export type SkillImportResult = z.infer<typeof SkillImportResultSchema>;
