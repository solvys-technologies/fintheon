# S27-T8 — SOUL.md Full Conversion (Absorbed S28-A)

## Ownership

Claude-05, Wave 1, branch `s27-w1d-soul-routing` (paired with T9 foundation), worktree `/Users/tifos/Desktop/Codebases/fintheon-s27-w1d`.

**Load-bearing**: T5 (voice assistant) + T9 (Smart Model Routing) + T11 (GEPA) all consume SOUL files. Blocks Wave 2.

## Inspiration + Decision

- [Hermes Agent v0.10 — SOUL.md + Smart Model Routing](https://blakecrosley.com/guides/hermes) — structured identity file per agent. Replaces hand-written system prompts with a schema-validated markdown format that the sidecar reads directly.
- TP's grounding directive: every CAO surface (main chat + voice assistant + API callers) must load the same SOUL set. Harper's `CLAUDE.md` is the **source of personal truth** — SOUL.md imports it literally, not copy-paste, so `CLAUDE.md` updates propagate without drift.

## Branch / Worktree / CWD

- **Worktree**: `/Users/tifos/Desktop/Codebases/fintheon-s27-w1d`
- **Branch**: `s27-w1d-soul-routing` off `v5.22`

## Scope — Included

### 1. SOUL schema

Create [`shared/soul-schema.ts`](shared/soul-schema.ts) (Zod + TS types). Every SOUL.md parses against this schema; invalid files fail to load with a console error.

Sections (all required unless noted):

- **identity** — agent name, role, one-paragraph self-description
- **scope** — what this agent decides on, what it defers
- **constraints** — hard rules (no PII exfil, no order placement, no destructive actions)
- **grounding** — relative path to the source-of-truth file imported verbatim (Harper → `CLAUDE.md`, others → `CLAUDE.md` + agent-specific dossier)
- **tools** — allowlist of tool names this agent may invoke
- **handoff_rules** — when to call `handoff_to_<desk>` (T3 reads this)
- **voice_style** — terse style hint for T5 (Harper: "confident, executive"; Feucht: "terse, trader-floor"; etc.)
- **memory_policy** — what types of `agent_memory` entries this agent writes (`deliberation_output`, `learned_pattern`, etc.)
- **model_preferences** (optional) — hint for T9 routing (e.g., "prefer Opus for probability reasoning")

### 2. Five SOUL files

Create `backend-hono/src/services/ai/soul/`:

- `harper.md` — CAO, canonical, imports `CLAUDE.md` as-is
- `oracle.md` — prediction markets, imports `CLAUDE.md` + `oracle.ts` dossier
- `feucht.md` — futures/risk, imports `CLAUDE.md` + `feucht.ts` dossier
- `consul.md` — macro, imports `CLAUDE.md` + `consul.ts` dossier
- `herald.md` — news, imports `CLAUDE.md` + `herald.ts` dossier

Each SOUL.md uses a YAML frontmatter + markdown body format. Example `harper.md`:

```markdown
---
schema_version: 1
agent_id: harper
identity:
  name: Harper
  role: CAO (Chief Agent Orchestrator)
scope:
  - Synthesize across desks
  - Call handoff_to_* for cross-desk reasoning
  - Render structured cards (T1)
constraints:
  - Never place orders
  - Never exfiltrate PII
  - Respect Solvys-Gold palette in UI output
grounding:
  source_of_truth: ../../../../CLAUDE.md
  extra:
    - ../agent-instructions/harper-extra.md # optional supplementary
tools:
  - handoff_to_oracle
  - handoff_to_feucht
  - handoff_to_consul
  - handoff_to_herald
  - browse_task
  - context_grep
  - context_describe
  - context_expand
  - hydrate_sandbox
handoff_rules:
  - When the question requires another desk's expertise, call handoff_to_<desk>
  - Max 3 handoffs per user turn
  - Max depth 2 in any chain
voice_style: confident, executive, Harper-voiced
memory_policy:
  writes:
    - deliberation_output
    - learned_pattern
model_preferences:
  prefer: opus
  fallback: sonnet
---

# Harper

Harper orchestrates Fintheon's desk agents. Call handoffs; don't paraphrase.
```

The `grounding.source_of_truth` path is **literal import** — the SOUL loader reads `CLAUDE.md` at load time and injects its full contents into the agent's system-prompt context. No copy-paste, no compilation step.

### 3. SOUL loader

Create [`backend-hono/src/services/ai/soul/loader.ts`](backend-hono/src/services/ai/soul/loader.ts):

```ts
export async function loadSoul(agentId: string): Promise<Soul> {
  const path = `./soul/${agentId}.md`;
  const raw = await readFile(path, "utf-8");
  const parsed = parseFrontmatter(raw);
  const validated = SoulSchema.parse(parsed); // Zod

  // Resolve grounding imports
  const grounding = await readFile(
    validated.grounding.source_of_truth,
    "utf-8",
  );
  const extras = await Promise.all(
    (validated.grounding.extra ?? []).map((p) => readFile(p, "utf-8")),
  );

  return { ...validated, grounding_text: grounding, extras_text: extras };
}
```

Cache SOULs per-process with TTL 5 minutes (matches existing `~/.hermes/memories/harper-handoff/agent-personas/` pattern). `reloadSouls()` helper for hot-reload during development.

### 4. Wire into every CAO surface

- [`backend-hono/src/services/harper-handler.ts`](backend-hono/src/services/harper-handler.ts) — replace hardcoded Harper system prompt with `loadSoul('harper')` output
- [`backend-hono/src/services/hermes-handler.ts`](backend-hono/src/services/hermes-handler.ts) — each agent path loads its SOUL
- [`backend-hono/src/services/ai/sidecar-client.ts`](backend-hono/src/services/ai/sidecar-client.ts) (W1b-created) — passes `system_overrides.soul` to sidecar on every `/v1/chat`
- `hermes-sidecar/config.yaml` — sidecar reads SOUL files directly from shared path `backend-hono/src/services/ai/soul/` (or mount as volume in Fly)

### 5. Legacy dossier migration

Existing [`backend-hono/src/services/ai/agent-instructions/*.ts`](backend-hono/src/services/ai/agent-instructions/) files (`harper.ts`, `oracle.ts`, `feucht.ts`, `consul.ts`, `herald.ts`) contain the current hand-written prompts. Strategy:

- **Keep the files.** They become "extra dossiers" — agent-specific supplementary context that SOUL's `grounding.extra` references.
- Extract the identity / scope / constraints chunks → move to SOUL frontmatter.
- What's left in each `*.ts` is agent-specific lore, few-shot examples, domain vocabulary. Export as a `.md` sibling (`harper-extra.md` etc.) so SOUL can import it without a compile step.
- Old `.ts` file becomes a compatibility shim that re-exports from the new `.md`:

```ts
// backend-hono/src/services/ai/agent-instructions/harper.ts
import { readFileSync } from "fs";
export const harperPrompt = readFileSync("./harper-extra.md", "utf-8");
```

T9 (Smart Model Routing foundation, same Claude) consumes this during Wave 1.

### 6. CLAUDE.md drift guard

Add a script [`scripts/soul-ground-check.ts`](scripts/soul-ground-check.ts) that:

- Loads every SOUL file
- Verifies `grounding.source_of_truth` paths resolve
- Verifies each SOUL.md + extras doesn't fork `CLAUDE.md` content (i.e., doesn't accidentally duplicate paragraphs that should be imported)

Run in CI on every PR that touches `CLAUDE.md` or `backend-hono/src/services/ai/soul/**`. Fails PR if drift detected.

## Known Issues to Preserve

Per `src/lib/changelog.ts`:

- S26 mobile revisions (v.26.1, v.26.2) — do not touch `mobile/`
- v5.22 mobile beta polish — intentional
- agent_context_bank + agent_memory tables (S20 / 2026-03-28) — SOUL loading must coexist with these, not replace them

## Scope — Excluded (DO NOT TOUCH)

- `mobile/**`
- `frontend/**` (SOUL is backend/sidecar only)
- T1 card schemas in `shared/` (W1a-owned, read-only)
- T4 browser primitives (W1c-owned)
- Hermes sidecar code (W1b-owned; T8 only writes files the sidecar reads)

## Files to touch

- NEW `shared/soul-schema.ts`
- NEW `backend-hono/src/services/ai/soul/harper.md`
- NEW `backend-hono/src/services/ai/soul/oracle.md`
- NEW `backend-hono/src/services/ai/soul/feucht.md`
- NEW `backend-hono/src/services/ai/soul/consul.md`
- NEW `backend-hono/src/services/ai/soul/herald.md`
- NEW `backend-hono/src/services/ai/soul/loader.ts`
- NEW `backend-hono/src/services/ai/agent-instructions/{harper,oracle,feucht,consul,herald}-extra.md`
- NEW `scripts/soul-ground-check.ts`
- EDIT `backend-hono/src/services/ai/agent-instructions/{harper,oracle,feucht,consul,herald}.ts` (shim)
- EDIT `backend-hono/src/services/harper-handler.ts` (loadSoul integration)
- EDIT `backend-hono/src/services/hermes-handler.ts` (loadSoul integration)
- EDIT `.github/workflows/*.yml` (add soul-ground-check step) — or skip if CI is elsewhere
- EDIT `src/lib/changelog.ts`

## Validation Commands

```bash
# Type check
cd backend-hono && bun run build

# Run drift guard
cd /Users/tifos/Desktop/Codebases/fintheon && bun run scripts/soul-ground-check.ts

# Frontend still compiles
cd frontend && find dist -mindepth 1 -delete && npx vite build
```

Live smoke:

1. `curl http://localhost:8080/api/harper/chat -d '{"message":"what's your identity?"}'` — response references Harper's CAO role + Solvys-Gold palette (proving `CLAUDE.md` was injected).
2. Modify `CLAUDE.md` (add "TP prefers cucumber sandwiches"), restart backend, re-query — agent references cucumber sandwiches. Revert.
3. Intentionally break a SOUL file (remove `identity.name`), restart backend → loader throws Zod validation error, backend fails to boot (fail-fast).
4. `scripts/soul-ground-check.ts` passes against clean tree, fails when a SOUL duplicates a paragraph from `CLAUDE.md`.

## Commit Format

```
[v.27.4] feat: T8 SOUL.md full conversion — 5 agents grounded on CLAUDE.md as source of personal truth
```

## Ship

`v.27.4` when W1d merges. Coordinates with T9 foundation on same branch.
