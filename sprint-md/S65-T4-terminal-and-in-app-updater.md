# Sprint Brief: T4 -- Terminal Reliability and In-App Updater CTA

## Context

The terminal should feel like a real CLI, not a slash-command launcher. It should open to a normal path prompt, without inserting `/` or showing the `>` chevron prompt, and it must run global system commands through the local backend/shell path. The updater also needs a real in-app flow: background download, bottom-left CTA saying a new version is available with the version number, and `Later` / `Install now` actions where install swaps the downloaded app and reopens it.

## Branch Target

`sprint/S65`

## Scope -- Included

- [ ] Update `frontend/components/layout/FooterToolbar.tsx` terminal UX: no auto-inserted `/`, no leading `>` prompt, show current working directory prompt, keep slash suggestions available only when the user types `/`.
- [ ] Fix terminal command streaming bugs in `frontend/components/layout/FooterToolbar.tsx`, including the duplicated `const exitVal` in the SSE exit handler.
- [ ] Update `backend-hono/src/routes/terminal/handlers.ts` so shell commands run from the actual project root and inherit a useful login-shell-style PATH for global commands such as `code`.
- [ ] Keep terminal endpoint local-only.
- [ ] Move the footer drawer expand/collapse button to the right of the version number in `frontend/components/layout/FooterToolbar.tsx`.
- [ ] Diagnose and replace the current manual updater path in `electron/main.cjs`, `electron/preload.cjs`, `frontend/types/electron.d.ts`, `frontend/components/VersionChecker.tsx`, and `frontend/lib/version-check.ts`.
- [ ] Add or modify scripts such as `scripts/fintheon-install-update.sh` only if needed for a downloaded-asset install flow.
- [ ] Ensure install/update script version behavior stays synced with `package.json`.

## Scope -- Excluded (DO NOT TOUCH)

- Header/sidebar chrome files owned by T3, except consuming any exported footer toggle event names if necessary.
- Settings/lockout files owned by T1.
- RiskFlow signal freshness owned by T5.
- Peer Chat removal owned by T2.
- Do not deploy or tag a release in this track.

## Reuse Inventory

- Terminal initial history and slash startup behavior in `frontend/components/layout/FooterToolbar.tsx:127`.
- Auto-insert `/` on panel open at `frontend/components/layout/FooterToolbar.tsx:213`.
- Backend terminal spawn path in `backend-hono/src/routes/terminal/handlers.ts:74`.
- Backend terminal project root currently resolves from `backend-hono/src/routes/terminal` at `backend-hono/src/routes/terminal/handlers.ts:13`.
- Electron shell command fallback in `electron/main.cjs:1397`; currently not used by FooterToolbar because cwd is unreliable inside packaged app.
- Existing manual updater note in `electron/main.cjs:13` says electron-updater was replaced with manual download/install handoff.
- `checkForDesktopUpdate` in `electron/main.cjs:690` only checks version.
- `update-download` in `electron/main.cjs:1303` opens GitHub releases instead of downloading in background.
- `update-install` in `electron/main.cjs:1312` downloads only after click by spawning `scripts/fintheon-install-update.sh`.
- Version toast in `frontend/components/VersionChecker.tsx:20` currently says "A new epoch..." with CTA label `Update`, not the requested copy.
- Version check in `frontend/lib/version-check.ts:77` polls production `/api/version/check`.
- Electron build publish config exists in `package.json:121`.

## Current Updater Diagnosis

- The current app path is not a true auto-updater. It is a manual version check plus script handoff.
- The CTA can fail to appear if `startVersionCheck` suppresses the version due dismissal/cooldown, if the production `/api/version/check` reports no delta, or if the packaged app build version already matches the backend.
- `update-download` opens the GitHub releases page instead of downloading in the background.
- `installUpdate` spawns `fintheon-install-update.sh`, and that script downloads after the user clicks, not before.
- The install script path uses `~/Documents/Fintheon` when packaged, while install/update memory indicates Fintheon normally lives under `/Users/tifos/Documents/Codebases/fintheon` or an install-path file. This likely breaks in-app install on real machines.

## Implementation Steps

1. In `FooterToolbar.tsx`, remove the automatic `setCliInput("/")` on panel open. Focus the input without opening suggestions.
2. Replace the terminal prompt display with a cwd-style prefix. Preferred: backend returns `cwd` from `/api/terminal/run` or a new `/api/terminal/session` endpoint; frontend shows a compact path like `.../fintheon`.
3. Remove the rendered `>` prompt span and input history `> command` prefix. Use `$ command` or path-prefixed command history to look like a regular CLI.
4. Keep slash commands, but open suggestions only when the user actually types `/`.
5. Fix the duplicated `const exitVal` in `FooterToolbar.tsx` SSE exit handler.
6. In `backend-hono/src/routes/terminal/handlers.ts`, confirm `PROJECT_ROOT` is repo root, not `backend-hono`. If wrong, change path resolution and return `cwd` in run responses.
7. Add a PATH builder for terminal commands. Include `process.env.PATH`, `/opt/homebrew/bin`, `/usr/local/bin`, `/usr/bin`, `/bin`, `/usr/sbin`, `/sbin`, and common app CLI locations if present. Do not hardcode destructive commands.
8. Keep local-only guard in `isLocalRequest`.
9. In `FooterToolbar.tsx`, split version text and drawer chevron so the expand/collapse button sits to the right of the version number.
10. Rework updater IPC into a two-phase flow: `check` -> start background download for latest asset -> emit renderer event when downloaded -> `installUpdate` installs the already-downloaded artifact.
11. Decide implementation path after checking package constraints. Preferred if adding dependency is acceptable: use `electron-updater` with `autoDownload=true`, `checkForUpdates()`, `update-downloaded`, and `quitAndInstall()`. Alternative: implement a custom GitHub asset downloader in Electron using the existing dual-route asset logic, save into `app.getPath("userData")/updates`, and hand that path to the install script.
12. Update `preload.cjs` and `frontend/types/electron.d.ts` to expose `onUpdateDownloaded` or equivalent.
13. Update `VersionChecker.tsx` toast copy exactly to: `A new version is available (${version})` with CTAs `Later` and `Install now`. Show it only when the app has downloaded the update and install is ready.
14. `Install now` should dispatch `fintheon:update-installing`, call `installUpdate`, close the app, replace the app, and reopen. If installation cannot proceed, show an error toast rather than silently failing.
15. Keep CLI update (`fintheon update`) as fallback, but it must not be the primary in-app path.
16. Run `bash -n` on touched shell scripts.

## Acceptance Criteria

- [ ] Opening Terminal focuses an empty prompt, not `/`.
- [ ] Terminal prompt looks like a normal CLI path prompt and does not render a right-facing chevron.
- [ ] Typing `code .` or another global command is passed to the shell path instead of rejected as unknown by app-specific parsing.
- [ ] Slash suggestions still work when the user types `/`.
- [ ] Footer drawer expand button sits to the right of the version number.
- [ ] App performs background update download before showing the install CTA.
- [ ] Bottom-left update CTA copy is `A new version is available (${version})`.
- [ ] CTA buttons are `Later` and `Install now`.
- [ ] `Install now` installs the already-downloaded update and reopens the app.
- [ ] CLI updater remains available as a fallback.

## Validation Commands

```bash
# Type check
npx tsc --noEmit --project frontend/tsconfig.json

# Clean build
rm -rf dist && npx vite build

# Backend build
cd backend-hono && bun run build

# Shell scripts if touched
bash -n scripts/fintheon-install-update.sh scripts/fintheon-update.sh scripts/install-cli.sh scripts/fintheon-cli.sh
```

## Commit Format

```text
[v6.1.0] fix: S65-T4 terminal and in-app updater readiness
```
