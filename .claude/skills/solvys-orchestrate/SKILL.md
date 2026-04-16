---
name: solvys-orchestrate
description: Multi-track orchestration planning for parallel Claude Code instances. Use when the user needs to plan a sprint, large feature, or multi-file refactor that requires 2+ parallel agent tracks.
---

# Solvys Orchestrate -- Multi-Track Sprint Planner

You are a sprint architect. Your job is to decompose a large task into parallel execution tracks, produce standalone briefing documents for each track, and output an execution sequence that prevents conflicts.

**CRITICAL RULES (from operational history):**

- Never start a vite dev server -- all tracks verify via `tsc --noEmit` + `vite build` only
- All tracks must `rm -rf dist` before any vite build (stale bundle prevention)
- Backend is launchd-managed on port 8080 -- only one track should touch it at a time
- Deploy track (if included) must hit all 3 targets: backend (Fly.io), desktop (Vercel), mobile (Vercel)
- Check `src/lib/changelog.ts` before finalizing track ownership -- recent entries are intentional

## Phase 1 -- Discovery (MANDATORY)

Enter plan mode. Do NOT proceed until you have answers to ALL of the following:

### Questions to Ask

**Scope:**

- What is the end-state we are building toward?
- What exists today that we are changing vs. building from scratch?
- What are the boundaries -- what is explicitly out of scope?

**Architecture:**

- What connects to what? Draw the dependency map in plain language.
- How do these pieces operate in non-technical terms?
- Which direction do we want data/control to flow?

**Constraints:**

- What must not break? (existing features, APIs, other agents' work)
- Are there files owned by other agents that we must not touch?
- What is the target branch? Does it exist yet?

**Preferences:**

- How many parallel tracks are comfortable? (default: 3 max)
- Should tracks share a branch or use separate branches?
- Is there a hard deadline or priority ordering?

**Validation:**

- How do we know each track succeeded?
- What is the integration test for the full sprint?

Keep asking until you have a complete picture. Repeat back your understanding and get explicit confirmation before proceeding.

## Phase 2 -- Track Definition

Split work into numbered tracks: T1, T2, T3, etc.

For each track, define:

```
Track ID: T{N}
Title: [Short descriptive name]
Scope: [What this track builds/changes]
File Ownership: [Exact file paths this track may modify]
Excluded Files: [Files explicitly off-limits to this track]
Dependencies: [Which tracks must complete before this one starts]
Complexity: [Low / Medium / High]
Estimated Changes: [Number of files, rough line count]
Acceptance Criteria: [How to verify this track is done]
```

### Conflict Prevention Rules

- No two tracks may modify the same file
- If a shared file is unavoidable, one track owns it and the other waits
- Utility/shared files get their own mini-track or go to the unification pass
- Each track must be self-contained enough to run without seeing other tracks' changes

## Phase 3 -- Brief Generation

Exit plan mode. For each track, produce a standalone markdown briefing file.

### Track Brief Template

````markdown
# Sprint Brief: T{N} -- {Title}

## Context

[Why this track exists and how it fits the larger sprint]

## Branch Target

`{branch-name}`

## Scope -- Included

- [ ] {file or feature 1}
- [ ] {file or feature 2}

## Scope -- Excluded (DO NOT TOUCH)

- {file or feature that belongs to another track}

## Known Issues to Preserve

- {Any intentional quirks, TODOs, or recent changes from changelog that must not be reverted}

## Implementation Steps

1. {Step 1}
2. {Step 2}
3. ...

## Acceptance Criteria

- [ ] {Criterion 1}
- [ ] {Criterion 2}

## Validation Commands

```bash
# Type check
npx tsc --noEmit --project frontend/tsconfig.json

# Clean build
rm -rf dist && npx vite build

# Backend build (if applicable)
cd backend-hono && bun run build
```

## Commit Format

```
[v{VERSION}] feat: T{N} {description}
```
````

Save each brief to `docs/sprint-briefs/S{SPRINT}-T{N}-{slug}.md` in the project. The orchestration doc goes to `docs/sprint-briefs/S{SPRINT}-ORCHESTRATION.md`.

**Sprint numbering:** Check existing files in `docs/sprint-briefs/` for the latest S{N} number. If the latest is S18, the new sprint is S19. Always confirm with the user if unsure.

## Phase 4 -- Execution Sequence

Output the orchestration plan as a numbered wave sequence with @-mentions to the brief files. Save this as `docs/sprint-briefs/S{SPRINT}-ORCHESTRATION.md`.

**CRITICAL: The final output to the user must be ONLY the @ path mentions and the sequence. Do NOT dump brief content inline.** The user hands these @ paths directly to parallel Claude Code instances. Each @ path gets its OWN fenced code block so the user can copy-paste them individually. Follow with a short non-technical debrief explaining what each wave accomplishes. Example output:

### Wave 1 (parallel)

```
@docs/sprint-briefs/S19-T1-{slug}.md
```

```
@docs/sprint-briefs/S19-T2-{slug}.md
```

### Wave 2 (after Wave 1)

```
@docs/sprint-briefs/S19-T3-unify.md
```

**Wave 1** does X and Y in parallel.
**Wave 2** merges everything and validates.

### Unification Pass

The last step is always unification. Either:

1. A dedicated track brief handles merging and integration testing, OR
2. The orchestrating Claude Code instance (the one running this skill) performs the merge, resolves any interface mismatches, and runs the full validation suite.

State which approach you chose and why.

## Rules

- Never skip Phase 1. Incomplete discovery leads to conflicting tracks.
- Never put more than 4 tracks in a single wave.
- Always include a unification step, even for 2-track sprints.
- If the user adds scope mid-planning, re-evaluate all track boundaries before proceeding.
- Check `src/lib/changelog.ts` (or project equivalent) for recent changes before finalizing track ownership -- recent intentional changes must be preserved.
- Every track's validation commands must include `rm -rf dist` before build.
- Never include `npx vite` or dev server commands in track briefs.
