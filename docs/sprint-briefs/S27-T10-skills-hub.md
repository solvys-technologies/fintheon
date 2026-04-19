# S27-T10 — Skills Hub Full Adoption (Absorbed S28-C)

## Ownership

Claude-10, Wave 2, branch `s27-w2e-routing-hub-gepa` (paired with T9 live + T11), worktree `/Users/tifos/Desktop/Codebases/fintheon-s27-w2e`.

## Inspiration + Decision

- [Skills Hub — Hermes Agent](https://hermes-agent.nousresearch.com/docs/skills/) — open skill standard compatible with `agentskills.io`. Skills are portable, shareable, and scanned for security (data exfiltration, prompt injection, destructive commands).
- TP's decision: **full adoption** — not foundation-only. Expose Harper / Oracle / Feucht / Consul / Herald as `agentskills.io`-compatible skills. Wire the hub importer so external skills (Google Workspace, Linear, Close CRM) drop in. Security scanner active.

## Branch / Worktree / CWD

- **Worktree**: `/Users/tifos/Desktop/Codebases/fintheon-s27-w2e`
- **Branch**: `s27-w2e-routing-hub-gepa` off `v5.22` (rebased on W1d merge + W1b sidecar merge)

## Scope — Included

### 1. Skill manifest schema (foundation — imported from W1a)

W1a (Claude-02) created `shared/skill-manifest.ts` with the `agentskills.io` Zod schema. T10 consumes it.

Schema essentials:

```ts
export const SkillManifest = z.object({
  schema_version: z.literal(1),
  id: z.string(), // e.g. "fintheon.harper"
  name: z.string(),
  version: z.string(), // semver
  description: z.string(),
  entry_point: z.string(), // relative path to handler
  soul: z.string().optional(), // relative path to SOUL.md
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
```

### 2. Expose 5 desks as skills

Create `skills/` at repo root. Five subdirectories:

- `skills/harper/skill.yaml` + `skills/harper/entry.ts`
- `skills/oracle/skill.yaml` + `skills/oracle/entry.ts`
- `skills/feucht/skill.yaml` + `skills/feucht/entry.ts`
- `skills/consul/skill.yaml` + `skills/consul/entry.ts`
- `skills/herald/skill.yaml` + `skills/herald/entry.ts`

Each `skill.yaml` conforms to the manifest schema, references the matching SOUL.md from T8, and lists the desk's tools + permissions.

Each `entry.ts` is a thin wrapper that routes to the existing `harper-handler.ts` / `hermes-handler.ts` code paths via Smart Model Routing (T9). Zero behavior change — just a new consumption surface.

### 3. Hub importer for external skills

Create [`backend-hono/src/services/skills/importer.ts`](backend-hono/src/services/skills/importer.ts):

```ts
export async function importSkillFromHub(
  hub_url: string, // agentskills.io URL or git repo
  options?: { version?: string; trust_unsigned?: boolean },
): Promise<SkillImportResult>;
```

Implementation:

- Resolve `hub_url` → tarball of the skill repo
- Extract + parse `skill.yaml` against the manifest schema
- Run security scanner (§4) before storing
- On pass: write to `skill_manifests` table + copy skill files to `skills/imported/{id}/`
- On fail: return `{ imported: false, rejected_because: [...] }`

Expose CLI: `bun run skills:import <hub_url>` for TP to run ad-hoc.

### 4. Security scanner

Create [`backend-hono/src/services/skills/security-scanner.ts`](backend-hono/src/services/skills/security-scanner.ts). Checks:

- **Data exfiltration** — static scan of `entry.ts` for network calls to non-allowlisted domains. Block on hit unless declared in `security_scan.data_exfil_risks`.
- **Prompt injection vectors** — look for user-input interpolation into system prompts without sanitization. Block on hit unless declared.
- **Destructive operations** — scan for `rm -rf`, `DROP TABLE`, `DELETE FROM`, `unlink`, shell exec. Block on hit.
- **Supply-chain signals** — check `package.json` deps against a known-bad list (reuse or port a simple audit — don't reinvent npm-audit). Warn + require TP confirmation.

Scanner produces a report stored with the skill import:

```sql
-- supabase/migrations/20260419_08_skill_imports.sql
create table public.skill_imports (
  id uuid primary key default gen_random_uuid(),
  skill_id text not null,
  version text not null,
  source_url text not null,
  imported_at timestamptz default now(),
  scan_report jsonb not null,
  status text not null,           -- 'imported' | 'rejected' | 'warned'
  imported_by text,                -- user_id who triggered import
  unique (skill_id, version)
);
```

### 5. Skill registry surface

Backend route `GET /api/skills` returns all registered skills (local + imported) with their manifests, scan reports, and status. Harper consumes this to know what tools exist (the existing tool-call infrastructure is the execution path; `/api/skills` is the introspection path).

### 6. Sidecar integration

Hermes sidecar v0.9 has native skill support via `POST /v1/skills/invoke`. backend-hono's [`ai/sidecar-client.ts`](backend-hono/src/services/ai/sidecar-client.ts) already exposes `skills.invoke(id, args, context)`. T10 registers every local skill's entry point with the sidecar at backend boot so cross-agent skill invocation works identically whether the caller is Harper (via MCP) or the sidecar (via `/v1/chat` tool call).

### 7. Import 3 real external skills for smoke

TP's ecosystem already uses Close CRM, Notion, and Google Workspace — port each into a fintheon-branded skill that wraps the existing integration:

- `skills/imported/close-crm/` — wraps existing Close CRM MCP tools into an `agentskills.io` manifest
- `skills/imported/notion/` — wraps existing Notion integration
- `skills/imported/google-workspace/` — wraps existing Gmail/Calendar hooks (audit current wiring)

These are imports for smoke-test purposes, not new integrations. Proves the importer + scanner round-trip.

## Known Issues to Preserve

- S26 mobile work (v.26.1, v.26.2) — no mobile changes
- `agent_memory` + `agent_context_bank` tables (S20) — skills access them via existing sidecar bridge, no new direct access
- Existing Close CRM MCP tools (referenced in user memory) — wrap, don't replace

## Scope — Excluded (DO NOT TOUCH)

- T8 SOUL files (read-only; skill.yaml references them)
- T9 routing table (read-only; skills invoke through routing)
- T11 GEPA loop files (same branch, sequenced after)
- `mobile/**`, `frontend/**` (T10 is backend + manifests only)

## Files to touch

- NEW `skills/harper/skill.yaml` + `entry.ts`
- NEW `skills/oracle/skill.yaml` + `entry.ts`
- NEW `skills/feucht/skill.yaml` + `entry.ts`
- NEW `skills/consul/skill.yaml` + `entry.ts`
- NEW `skills/herald/skill.yaml` + `entry.ts`
- NEW `backend-hono/src/services/skills/importer.ts`
- NEW `backend-hono/src/services/skills/security-scanner.ts`
- NEW `backend-hono/src/routes/skills.ts` (registry endpoint)
- NEW `supabase/migrations/20260419_08_skill_imports.sql`
- NEW `backend-hono/scripts/skills-import-cli.ts`
- NEW `skills/imported/close-crm/skill.yaml` (wraps existing)
- NEW `skills/imported/notion/skill.yaml` (wraps existing)
- NEW `skills/imported/google-workspace/skill.yaml` (wraps existing)
- EDIT `backend-hono/src/services/ai/sidecar-client.ts` (register skills at boot)
- EDIT `backend-hono/src/index.ts` or equivalent route registration
- EDIT `src/lib/changelog.ts`

## Validation Commands

```bash
cd backend-hono && bun run build
cd frontend && find dist -mindepth 1 -delete && npx vite build

# Scanner smoke — known-bad payload
bun run backend-hono/scripts/skills-import-cli.ts --url=./backend-hono/test/fixtures/malicious-skill
# Expect: status=rejected, scan_report shows destructive_ops hit
```

Live smoke:

1. `curl http://localhost:8080/api/skills` returns 8 skills (5 desks + 3 imported).
2. Harper invokes `close.find_lead` via skill path → same result as existing Close CRM MCP call.
3. Import a test skill with an `rm -rf` in `entry.ts` → scanner blocks, `skill_imports` row has `status=rejected`.
4. Diagnostics shows per-skill invocation count under a skills panel.

## Commit Format

```
[v.27.9] feat: T10 Skills Hub full adoption — 5 desks + 3 imports + security scanner + hub CLI
```

## Ship

`v.27.9` bundled with T9 live + T11.
