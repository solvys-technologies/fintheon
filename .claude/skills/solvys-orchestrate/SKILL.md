---
name: solvys-orchestrate
description: Multi-track orchestration planning AND live shepherding for parallel Claude Code instances. Use when the user needs to plan and run a sprint, large feature, or multi-file refactor requiring 2+ parallel agent tracks. Phases 1-4 plan the tracks; Phase 5 shepherds the dispatched peers via the claude-peers MCP through waves, validation, and unification.
---

# Solvys Orchestrate -- Multi-Track Sprint Planner + Shepherd

You are a sprint architect AND a live shepherd. Your job is:

1. Phases 1-4: decompose a large task into parallel execution tracks, produce standalone briefs per track, and output an execution sequence that prevents conflicts.
2. Phase 5: after the user dispatches the briefs to parallel Claude Code VS Code windows, watch every live peer, drive their validation, promote waves, and walk the sprint to unification.

**CRITICAL RULES (from operational history):**

- Never start a vite dev server -- all tracks verify via `tsc --noEmit` + `vite build` only
- All tracks must `rm -rf dist` before any vite build (stale bundle prevention)
- Backend is launchd-managed on port 8080 -- only one track should touch it at a time
- Deploy track (if included) must hit all 3 targets: backend (Fly.io), desktop (Vercel), mobile (Vercel)
- Check `src/lib/changelog.ts` before finalizing track ownership -- recent entries are intentional

## Phase 1 -- Discovery (MANDATORY, AUTO-PILOT)

**Auto-behavior on skill invocation:**

1. **Immediately call `EnterPlanMode`** before asking anything else. This skill's planning phases never run in execution mode -- the whole discovery loop happens in plan mode so the user sees proposed track boundaries before any file is written.
2. **All discovery questions go through `AskUserQuestion`** (the multiple-choice modal). Do not free-text-interrogate the user one sentence at a time. Batch 2-4 related questions per `AskUserQuestion` call, each with 2-4 concrete options. The tool auto-appends an "Other" escape hatch -- you never add one.
3. **Three rounds are enforced.** R1 and R2 are MANDATORY and must always fire, even if the user's initial message seems complete. R3 is optional and fires only if R1+R2 answers leave real ambiguity. Do not collapse rounds into one mega-prompt -- the user needs to see the sprint shape evolve between rounds.

Between rounds, write a one-paragraph "what I heard" summary and then fire the next round. Never exit plan mode until briefs are written (Phase 3) and `ExitPlanMode` is called in Phase 4.

### Round 1 -- Scope & Surface (MANDATORY)

Fire an `AskUserQuestion` batch covering:

- **End-state:** what does the product look like when the sprint ships? (options = 2-4 plausible end-states derived from the user's prompt)
- **Net-new vs. refactor:** is this greenfield, a change to existing surfaces, or a mix? (single-select)
- **Surface scope:** which parts of the app get touched? (multi-select: Backend, Desktop frontend, Mobile PWA, Electron shell, Supabase schema, Agent instructions)
- **Track budget:** how many parallel Claude Code instances do you want to run? (single-select: 2 / 3 / 4 / 5+ -- default 3, hard cap 4 per wave unless the sprint is a pure per-file rename where non-overlapping ownership makes larger waves safe)

### Round 2 -- Architecture & Constraints (MANDATORY)

Fire a second `AskUserQuestion` batch covering:

- **Branch strategy:** shared branch vs. per-track branches? (single-select)
- **Ownership conflicts:** which existing agent-owned files must stay off-limits? Start from `src/lib/changelog.ts` recent entries and list the top 2-3 candidates.
- **Breakage tolerance:** what must NOT regress? (multi-select: CAO chat, RiskFlow feed, MDB/ADB/PMDB/TWT briefs, Sanctum, Mobile PWA, Desktop install flow, Supabase RLS)
- **Unification owner:** does the orchestrator Claude merge, or does a dedicated unification track? (single-select)

### Round 3 -- Validation & Aesthetic (OPTIONAL)

Fire a third `AskUserQuestion` batch ONLY if R1+R2 left gaps. Typical triggers: UI work landed in scope, deadline unclear, validation path undefined, or the user picked "Other" in a prior round.

- **Validation spec:** per-track acceptance signal? (multi-select: tsc clean, vite build clean, bun build clean, curl smoke, Browser Harness, manual TP review)
- **Design anchor:** for any UI track, reference source? (single-select: existing Fintheon surface, Figma link, `/solvys-feels` defaults, external reference via Browser Harness)
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

### Live Backchannel (Claude Peers)

Phase 5 REQUIRES `claude-peers` to be registered in the project `.mcp.json`. Check for a `claude-peers` entry before finishing Phase 2. If it is missing, state this clearly and either (a) ask the user to install it before proceeding, or (b) explicitly skip Phase 5 and note the sprint will be unshepherded.

When `claude-peers` is registered, every parallel track Claude already has these tools: `list_peers`, `send_message`, `set_summary`, `check_messages`. Each track brief will include a **Coordination** section instructing the track Claude to:

1. Call `set_summary` on startup with: `T{N} -- {Title} -- files: {comma-separated owned paths}`
2. Call `list_peers` before any cross-cutting change to confirm no other live track is mid-edit on the same file
3. Use `send_message` to ask another track Claude or the orchestrator a quick question rather than blocking
4. Respond promptly to shepherd pings from the orchestrator (see Phase 5) -- treat them like a coworker tapping your shoulder

File ownership declarations remain authoritative. The backchannel is for live coordination, not license to cross ownership lines.

## Phase 3 -- Brief Generation (AUTO, while still in plan mode)

**Stay in plan mode.** Do NOT call `ExitPlanMode` yet. As soon as Phase 2 track definitions are settled, auto-write one standalone markdown briefing file per track directly from the `AskUserQuestion` answers. The user should not have to prompt "now write the briefs" -- that is the whole point of this phase firing automatically.

Before writing any brief, fact-check identifiers against the live tree and Supabase REST:

- `grep` every table, route, service, and component name that will appear in a track brief against the current repo
- If a referenced file does not exist, flag it in the brief as `[NEW -- to create]`
- If a referenced table/route does not exist, list it under "Open questions" in the brief rather than hallucinating its shape

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

## Coordination (only included if claude-peers MCP is registered)

On startup:

1. `set_summary` with: `T{N} -- {Title} -- files: {owned paths}`
2. `list_peers` -- confirm no other live track owns any file you're about to touch
3. If a peer is mid-edit on a shared/adjacent file, `send_message` first; do NOT race
4. Expect periodic `send_message` pings from the orchestrator asking status. Reply within 2 minutes in 1-3 lines: what you've written, what you're doing, what's next. Never ignore a shepherd ping.

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

**Sprint numbering:** Check existing files in `sprint-md/` AND `sprint-changelog/` (and any legacy `docs/sprint-briefs/`) for the highest S{N}. Also scan: live git branches (`git branch -a | grep -oE 's[0-9]+'`), recent commits (`git log --oneline | head -40`), and any untracked sprint-\* files. If the latest shipped is S32, the new sprint is S33. Always confirm with the user if unsure.

## Phase 4 -- Execution Sequence (EXIT PLAN MODE HERE)

Once all track briefs are written and the orchestration doc is drafted, call `ExitPlanMode`. This is the only phase that exits plan mode for the planning portion of the skill -- everything upstream (discovery, track definition, brief writing) stays inside the plan so the user can course-correct without losing context.

Output the orchestration plan as a numbered wave sequence with @-mentions to the brief files. Save this as `sprint-md/S{SPRINT}-ORCHESTRATION.md` (NOT `docs/sprint-briefs/` -- that path is legacy).

**CRITICAL: The final output to the user must be ONLY the @ path mentions and the sequence. Do NOT dump brief content inline.** The user hands these @ paths directly to parallel Claude Code instances. Each @ path gets its OWN fenced code block so the user can copy-paste them individually. Follow with a short non-technical debrief explaining what each wave accomplishes. Example output:

### Wave 1 (parallel)

```
@sprint-md/S33-T1-{slug}.md
```

```
@sprint-md/S33-T2-{slug}.md
```

### Wave 2 (after Wave 1)

```
@sprint-md/S33-T3-unify.md
```

**Wave 1** does X and Y in parallel.
**Wave 2** merges everything and validates.

### Unification Pass

The last step is always unification. Either:

1. A dedicated track brief handles merging and integration testing, OR
2. The orchestrating Claude Code instance (the one running this skill) performs the merge, resolves any interface mismatches, and runs the full validation suite.

State which approach you chose and why.

### Phase 4 -> Phase 5 handoff

After `ExitPlanMode` + the @-mentions are posted, print a single line:

```
Standing by to shepherd. Paste the briefs into your VS Code windows; I'll pick the peers up on my next tick.
```

Then enter Phase 5.

## Phase 5 -- Shepherding Loop (post-dispatch)

Phase 4 ends when the user has the wave @-mentions. The user then pastes each brief into a fresh Claude Code VS Code window and kicks off the track agents. **You (the orchestrator) do not exit.** You enter a shepherd loop that watches every live track, drives validation, and walks each wave to completion.

### Pre-requisites

- `claude-peers` MCP must be registered in the project `.mcp.json`. If Phase 2 established it is not registered, do NOT enter Phase 5 -- instead tell the user the sprint will run unshepherded and the skill ends here.
- Use `ScheduleWakeup` (dynamic `/loop` self-pacing) to drive the tick cadence. You are not billing a stalled session -- each wake re-enters Phase 5 at the Tick Loop step.

### Shepherd Registry

On entering Phase 5, initialize an in-memory registry keyed by track ID:

```
T{N}: {
  peerId:      null until discovered
  wave:        1..N
  state:       'pending' | 'working' | 'validating' | 'blocked' | 'done'
  lastSeen:    timestamp of most recent message from this peer
  lastAction:  short label of what we last told them to do
  artifacts:   list of file paths / URLs the peer reported producing
}
```

Repopulate `peerId` and `state` on every tick by calling `list_peers` (scope: `repo`) and reconciling against the registry. A peer binds to T{N} when its working directory matches the project repo AND its summary starts with `T{N}`. If no peer has bound to a track after 10 minutes of Phase 5, ping the user: `T{N} has no live peer -- did you dispatch the brief?`

Drop bindings whose peers have gone dark (cleaned up by the broker) and mark that track `blocked` until the user restarts it.

### Tick Loop

Pick a `delaySeconds` per tick:

- Active wave (any peer in `working` or `validating`): **180-270s**. Keeps the orchestrator prompt cache warm.
- All peers in `validating` only (waiting on Browser Harness or user review): **600-1200s**.
- All peers `done`, waiting on unification: **300-900s**.
- All peers `blocked` or dark: **900-1800s**, and include a user-facing escalation in the `reason`.

Each tick:

1. **Refresh** -- `list_peers` + `check_messages`. Update the registry. Reconcile any new peer summaries.
2. **Status ping** -- for any peer whose `lastSeen` is older than the current tick interval, `send_message`: `status: where are you in T{N}? list what you have written + what's next.` Do not double-ping within a single tick.
3. **Advance** -- for each peer that reports a step complete, reply with the next instruction. Concrete patterns:
   - "wrote {file}" -> `good. run {validation command} and paste the exit code.`
   - "tsc clean, build clean" -> `commit with the format in your brief, then stand by.`
   - UI track reports "done" -> spawn Browser Harness validation (see below) BEFORE marking `done`.
4. **Unstick** -- any peer that reports an error: reply with diagnosis if the fix is obvious, or `send_message` to a sibling peer if the answer lives in that track. Never tell a peer to redo a previous track's work -- the wave boundary exists for a reason.
5. **Promote waves** -- when every peer in the current wave hits `done`, `send_message` to each Wave N+1 peer: `Wave {N} clear, your turn. Start T{N+1}.`
6. **Unify** -- when the last wave reports `done`, either run unification yourself (per the Phase 4 decision) or tell the dedicated unification peer to start.

### Browser Harness validation (UI tracks only)

Any track whose Acceptance Criteria include visible UI behavior MUST pass Browser Harness before the shepherd marks it `done`. The track's self-report is not sufficient.

1. When the peer reports done, spawn Browser Harness against the relevant local URL (desktop: the Vercel preview or Fly URL -- DO NOT run a local dev server per CLAUDE.md rules; mobile: the Vercel preview URL).
2. Walk the exact acceptance steps from the brief. Screenshot on each assertion.
3. If harness passes: `send_message` the peer `browser-harness clean, mark T{N} done`. Set state `done`.
4. If harness fails: `send_message` the peer `browser-harness failed on step {X}: {observation}. fix and re-report.` Leave state `validating`.

Tracks with no UI acceptance criteria skip this sub-step and move straight from `validating` to `done` on tsc+build clean.

### Shepherd banner

On Phase 5 entry, call `set_summary` with: `Shepherding S{SPRINT} -- {M} tracks, wave {W}/{TOTAL}`. Update it every time a wave completes or a peer's state changes materially.

### Escalation rules

- Peer `lastSeen` > 15 min AND you have pinged within the last tick: mark `blocked`. In your next user-facing update say: `T{N} silent 15+ min -- probably needs your attention`.
- Peer reports a scope question not answered in its brief: do NOT make the call. Surface it to the user in your next turn.
- Two peers report conflicting edits to the same file: `send_message` both with `halt -- ownership conflict on {file}, stand by`, then flag to the user.
- Peer reports a destructive action (rm -rf, git reset --hard, git push --force): `send_message` the peer `stop -- confirm with TP before any destructive op`. Surface to the user.

### Exit condition

Shepherd exits when ANY of:

- Every track is `done` AND unification has reported clean validation, OR
- User issues an explicit stop, OR
- Three consecutive ticks produce zero state changes AND every track is `blocked` (total stall -- surface to user and exit).

On exit, post a final summary listing each track, its commits/files, outstanding items, and whether unification passed.

### Shepherd communication style

- All shepherd-to-peer comms happen via `claude-peers` `send_message`. Never rely on user-facing text reaching a peer.
- Keep peer messages under 3 lines. Peers are mid-work -- be a coworker tapping a shoulder, not a memo writer.
- Do not re-plan the sprint during shepherding. If the user changes scope mid-flight, stop the loop cleanly and re-enter Phase 1.
- User-facing status updates (outside peer messages) come at wave boundaries and on escalations -- not every tick.

## Rules

- **Always auto-enter plan mode** (`EnterPlanMode`) as the first tool call of the skill. No exceptions.
- **Always use `AskUserQuestion` for discovery**, never free-text Q&A. Batch 2-4 questions per call.
- **R1 and R2 are mandatory.** Fire them even if the user's opening prompt seems self-explanatory. R3 only fires when real gaps remain.
- **Write briefs automatically** after Phase 2, before `ExitPlanMode`. The user should not need to say "write the briefs".
- **Only call `ExitPlanMode` in Phase 4**, once every brief + the orchestration doc exist on disk.
- **Phase 5 is mandatory when claude-peers is registered.** Do not end the skill at Phase 4 with live peers to coordinate.
- **The shepherd is the ONLY phase that spans multiple turns via `ScheduleWakeup`.** Planning phases are single-plan, single-exit.
- Never put more than 4 tracks in a single wave EXCEPT for pure per-file rename sprints where ownership is non-overlapping -- those can go wider.
- Always include a unification step, even for 2-track sprints.
- If the user adds scope mid-planning, re-evaluate all track boundaries and (if needed) re-fire the affected `AskUserQuestion` round.
- Check `src/lib/changelog.ts` (or project equivalent) for recent changes before finalizing track ownership -- recent intentional changes must be preserved.
- Every track's validation commands must include `rm -rf dist` before build.
- Never include `npx vite` or dev server commands in track briefs.
- **Design tracks obey `/solvys-feels`**: no gradients, no emojis, no Kanban borders, no AI sparkles. State this banned-ornaments list inside any brief that includes UI work.
- **UI tracks MUST clear Browser Harness in Phase 5 before `done`.** Never trust a peer's self-reported UI completion.
- **Shepherd pings live in `send_message`, not user-facing text.** Peers do not read your prose to the user.
