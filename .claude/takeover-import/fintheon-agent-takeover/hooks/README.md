# Fintheon Claude Code Hooks — README

Hook scripts that wrap every Claude Code session in the Fintheon repo. They protect destructive commands, log activity, auto-commit checkpoints, and surface RiskFlow feed health on session end.

## What's in this folder

| Script                                                 | Trigger (in `settings.json`) | Purpose                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------------ | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`block-dangerous.sh`](./block-dangerous.sh)           | `PreToolUse` matcher `Bash`  | Blocks destructive shell commands (`rm -rf`, `git reset --hard`, `git push --force`, `DROP TABLE`, `mkfs`, fork-bombs, `BYPASS_AUTH`, etc.). Use `find -delete` or `/bin/rm -R -f` for legitimate directory cleanup.                                                                                   |
| [`require-tests-for-pr.sh`](./require-tests-for-pr.sh) | `PreToolUse` matcher `Bash`  | Runs `bun run build` before any `gh pr create` or `git push`. Blocks PRs if the build is red. **Note**: it builds `$CLAUDE_PROJECT_DIR`, not your worktree. Fails silently if `CLAUDE_PROJECT_DIR` is unset or the main tree's build is broken from a parallel sprint.                                 |
| [`protect-files.sh`](./protect-files.sh)               | `PreToolUse` matcher `Write  | Edit`                                                                                                                                                                                                                                                                                                  | Blocks writes to `.env.production`, `.env.local`, `bun.lockb`, `.claude/settings.json`, `.claude/settings.local.json`, `tool-permissions.json`, anything under `server_secrets/`. |
| [`log-commands.sh`](./log-commands.sh)                 | `PostToolUse` matcher `Bash` | Appends every Bash command (UTC timestamped) to `.claude/command-log.txt`.                                                                                                                                                                                                                             |
| [`auto-commit.sh`](./auto-commit.sh)                   | `Stop`                       | If working tree is dirty when Claude stops, stages everything and commits as `auto: Claude Code task checkpoint [HH:MM]` with `--no-verify`. Default-resolves `feed-health.log` conflicts with `--theirs`.                                                                                             |
| [`harper-feed-health.sh`](./harper-feed-health.sh)     | `Stop`                       | Curls `http://localhost:8080/api/diagnostics/feed-health` + `/api/riskflow/sources`. Logs to `.claude/feed-health.log`. Shouts to stderr if the cache is empty, the poller/scorer is stopped, the unscored backlog is >50, the newest item is >2h old, the cache is stale, or Twitter is rate-limited. |
| `settings.example.json`                                | —                            | Copy of the project `.claude/settings.json` showing how every hook is wired (PreToolUse / PostToolUse / Stop). Drop into `.claude/settings.json` to install.                                                                                                                                           |

## How they fit together

- **Pre-flight guards** (`block-dangerous`, `protect-files`, `require-tests-for-pr`) run BEFORE the tool executes. Exit code `2` blocks the call and the message goes back to Claude.
- **Activity log** (`log-commands`) runs AFTER every Bash. Always exits `0`.
- **Stop hooks** run when Claude finishes a turn. They can run in parallel; the project also chains a backgrounded `fintheon-update.sh` here.

## Required environment

- `bash` (zsh on macOS is fine — scripts use `#!/bin/bash` shebangs)
- `python3` (used as a `jq` fallback for parsing tool-input JSON)
- `jq` (optional but preferred — install with `brew install jq`)
- `curl` (Apple-stock works)
- `git` (any modern version)
- `bun` for the build check (or `npm`; the script falls back to `npm run build` if `bun` isn't on PATH)

## Environment variables

- `CLAUDE_PROJECT_DIR` — Claude Code injects this. The hooks `cd` into it for git operations and the build check. **If it's unset, `require-tests-for-pr.sh` silently passes.** Verify before relying on the gate.
- `CLAUDE_FILE_PATH` — Claude Code injects this for `Write|Edit` PostToolUse hooks. The project's settings pipe it through Prettier, then a `bun run build` (tail), then ESLint --fix.
- `FINTHEON_BACKEND_URL` — Override for `harper-feed-health.sh`. Defaults to `http://localhost:8080`.

## Logs

- `.claude/command-log.txt` — every shell command, UTC timestamped (one line each).
- `.claude/feed-health.log` — feed health snapshot at every Stop event. Conflicts auto-resolve to the local copy via the `auto-commit.sh` flow.

See [`SETUP.md`](./SETUP.md) for installation steps.
