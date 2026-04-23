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

## Phase 1 -- Discovery (MANDATORY, AUTO-PILOT)

**Auto-behavior on skill invocation:**

1. **Immediately call `EnterPlanMode`** before asking anything else. This skill never runs in execution mode -- the whole discovery loop happens in plan mode so the user sees proposed track boundaries before any file is written.
2. **All discovery questions go through `AskUserQuestion`** (the multiple-choice modal). Do not free-text-interrogate the user one sentence at a time. Batch 2-4 related questions per `AskUserQuestion` call, each with 2-4 concrete options. The tool auto-appends an "Other" escape hatch -- you never add one.
3. **Three rounds are enforced.** R1 and R2 are MANDATORY and must always fire, even if the user's initial message seems complete. R3 is optional and fires only if R1+R2 answers leave real ambiguity. Do not collapse rounds into one mega-prompt -- the user needs to see the sprint shape evolve between rounds.

Between rounds, write a one-paragraph "what I heard" summary and then fire the next round. Never exit plan mode until briefs are written (Phase 3) and `ExitPlanMode` is called in Phase 4.

### Round 1 -- Scope & Surface (MANDATORY)

Fire an `AskUserQuestion` batch covering:

- **End-state:** what does the product look like when the sprint ships? (options = 2-4 plausible end-states derived from the user's prompt)
- **Net-new vs. refactor:** is this greenfield, a change to existing surfaces, or a mix? (single-select)
- **Surface scope:** which parts of the app get touched? (multi-select: Backend, Desktop frontend, Mobile PWA, Electron shell, Supabase schema, Agent instructions)
- **Track budget:** how many parallel Claude Code instances do you want to run? (single-select: 2 / 3 / 4 -- default 3, hard cap 4 per wave)

### Round 2 -- Architecture & Constraints (MANDATORY)

Fire a second `AskUserQuestion` batch covering:

- **Branch strategy:** shared branch vs. per-track branches? (single-select)
- **Ownership conflicts:** which existing agent-owned files must stay off-limits? Start from `src/lib/changelog.ts` recent entries and list the top 2-3 candidates.
- **Breakage tolerance:** what must NOT regress? (multi-select: Harper chat, RiskFlow feed, MDB/ADB/PMDB briefs, Aquarium, Mobile PWA, Desktop install flow, Supabase RLS)
- **Unification owner:** does the orchestrator Claude merge, or does a dedicated unification track? (single-select)

### Round 3 -- Validation & Aesthetic (OPTIONAL)

Fire a third `AskUserQuestion` batch ONLY if R1+R2 left gaps. Typical triggers: UI work landed in scope, deadline unclear, validation path undefined, or the user picked "Other" in a prior round.

- **Validation spec:** per-track acceptance signal? (multi-select: tsc clean, vite build clean, bun build clean, curl smoke, Playwright, manual TP review)
- **Design anchor:** for any UI track, reference source? (single-select: existing Fintheon surface, Figma link, `/solvys-feels` defaults, external reference via `browser-harness`)
- **Deadline:** is this tied to a release window? (single-select: this week / next deploy / no deadline / other)

If R1+R2 fully define the sprint, skip R3 and state "Round 3 skipped -- discovery complete" before moving to Phase 2.

### Between Rounds

After each round, repeat back a one-paragraph summary of the sprint shape so far ("Heard: {end-state}, {surface}, {N} tracks on {branch strategy}..."). Do not ask "is this right?" -- the next `AskUserQuestion` batch is the correction channel.

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

Save each brief to `sprint-md/S{SPRINT}-T{N}-{slug}.md` at the CURRENT workspace root. The orchestration doc goes to `sprint-md/S{SPRINT}-ORCHESTRATION.md`.

**Sprint-md folder rules:**

- `sprint-md/` lives at the TOP LEVEL of whatever repo we are working in -- never inside `docs/`, never inside a sub-app folder.
- Create it if it does not exist. Do not assume prior sprints used this path.
- If a legacy `docs/sprint-briefs/` folder exists in the repo, DO NOT write there. New plans always go to `sprint-md/`. Migration of legacy plans happens at deploy time via `/solvys-deploy` Phase 5a, not here.
- Shipped plans get archived to `sprint-changelog/` by `/solvys-deploy`. `sprint-md/` should only ever contain in-flight work.

**Sprint numbering:** Check existing files in `sprint-md/` AND `sprint-changelog/` (and any legacy `docs/sprint-briefs/`) for the highest S{N}. If the latest shipped is S26, the new sprint is S27. Always confirm with the user if unsure.

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
