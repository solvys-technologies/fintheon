# Sprint Brief: T6 -- Unification and Closed-Beta Validation

## Context

This is the final integration pass for S65. The sprint touches settings, lockout, runtime peer-chat removal, heading/sidebar chrome, terminal/updater, and Risk Signals. The unification owner resolves cross-track interface mismatches, updates changelog, runs clean validation, and confirms the result feels like a closed-beta product instead of a science project.

## Branch Target

`sprint/S65`

## Scope -- Included

- [ ] Merge or reconcile T1 through T5 outputs.
- [ ] Resolve type/interface drift between settings, layout, Electron preload types, and backend route payloads.
- [ ] Add one consolidated S65 changelog entry in `src/lib/changelog.ts`.
- [ ] Verify no runtime Peer Chat UI/API remains.
- [ ] Verify settings default platform includes custom links.
- [ ] Verify lockout/blocker policy and Desk Plan lock/unlock controls work together.
- [ ] Verify header/sidebar/footer chrome positions match the requested layout.
- [ ] Verify terminal and updater CTA behavior as far as possible without publishing a new release.
- [ ] Verify Risk Signal freshness metadata and rounded expanded hover state.

## Scope -- Excluded (DO NOT TOUCH)

- Do not rewrite track implementations unless required for integration.
- Do not deploy, tag, publish a DMG, or prune releases unless the user explicitly moves into deploy.
- Do not revert unrelated dirty workspace changes.
- Do not touch `.claude/feed-health.log`; it was dirty before this sprint and has runtime/conflict-marker noise.

## Reuse Inventory

- Recent changelog entries in `src/lib/changelog.ts:1` are intentional S64 work and must be preserved.
- Validation gate from prior Fintheon memory: `npx tsc --noEmit --project frontend/tsconfig.json` plus clean `rm -rf dist && npx vite build` are the reliable frontend gates.
- Backend build gate is `cd backend-hono && bun run build`.
- Updater scripts that often need sync: `package.json`, `scripts/fintheon-update.sh`, `scripts/fintheon-install-update.sh`, `scripts/fintheon-setup.sh`, `scripts/install-cli.sh`, `scripts/fintheon-cli.sh`.

## Known Issues to Preserve

- S64 changes were just completed and include desk plan, enhanced lockout, and agent pricing literacy. Do not regress those.
- Backend is launchd-managed on port 8080. Do not restart in this unification pass unless a test explicitly requires it and the user approves.
- Keep Linear issue prefixes uppercase if this plan is loaded into Linear later.
- If creating Linear issues, every issue body must include an `@sprint-md/...` brief reference.

## Implementation Steps

1. Read `git status --short` and identify track outputs plus any unrelated dirty files.
2. Run `rg -n "PeerChat|peer-chat|peers/chat|Peer Chat" frontend backend-hono .cursor AGENTS.md CLAUDE.md WORKSPACE.md` and confirm any remaining hits are historical or dev-only.
3. Run `rg -n "Default Platform|proposerIframeSources|lockoutAutoBlock|Auto-lock from Desk Plan|toolbar-active|update-downloaded|risk-signals" frontend backend-hono electron scripts` to inspect the new integration points.
4. Add a single top changelog entry in `src/lib/changelog.ts` summarizing S65 and listing files changed by all tracks.
5. Run frontend type check.
6. Run clean frontend build with `rm -rf dist` first.
7. Run backend build if any backend/electron-adjacent route files changed.
8. Run shell syntax checks if any update scripts changed.
9. Run local curl checks for Risk Signals and feed health if backend is already running.
10. If browser verification is practical, inspect the settings iFrame default selector, Blocker tab toggle, header/sidebar/footer chrome, Terminal prompt, and Risk Signals expanded row. Do not start a Vite dev server.
11. Prepare final merge notes with failures or residual risks.

## Acceptance Criteria

- [ ] `npx tsc --noEmit --project frontend/tsconfig.json` passes.
- [ ] `rm -rf dist && npx vite build` passes.
- [ ] `cd backend-hono && bun run build` passes if backend files changed.
- [ ] `bash -n` passes for touched shell scripts.
- [ ] No runtime Peer Chat route/UI remains.
- [ ] Settings, lockout, chrome, terminal, updater, and risk signal acceptance criteria from T1-T5 are satisfied or explicitly documented as blocked.
- [ ] `src/lib/changelog.ts` has one concise S65 entry.

## Validation Commands

```bash
git status --short

rg -n "PeerChat|peer-chat|peers/chat|Peer Chat" frontend backend-hono .cursor AGENTS.md CLAUDE.md WORKSPACE.md

npx tsc --noEmit --project frontend/tsconfig.json

rm -rf dist && npx vite build

cd backend-hono && bun run build

bash -n scripts/fintheon-install-update.sh scripts/fintheon-update.sh scripts/install-cli.sh scripts/fintheon-cli.sh
```

## Commit Format

```text
[v6.1.0] chore: S65 unification and validation
```
