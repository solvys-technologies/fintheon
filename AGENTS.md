## Learned User Preferences

- OpenCode CLI (DeepSeek v4 Pro) is the default local Solvys Agent runner; Cursor CLI is only the fallback runner
- Use `--sandbox disabled` flag for fallback Cursor CLI agent commands to bypass git write approval prompts
- Prefer `linear-ack-complete.sh` script for moving issues to Awaiting Review state
- All Linear issue prefixes must be uppercase (`S62-T1`, `S62-ORCH`, `S38-CHAT`)
- Agents should read AGENTS.md, CLAUDE.md, WORKSPACE.md, and `.cursor/rules/` before starting work
- Bug tickets are named after the bug itself, not sprint-track numbered
- Do NOT reiterate or summarize subagent results already visible to the user
- If nothing meaningful to add, end your turn silently — empty acknowledgments are not wanted
- Every Linear issue must include `@` file references to `sprint-md/` brief files in its description
- Use the `solvys-support` MCP server for Linear-backed support operations when available; its tools are prefixed `solvys_support_*`
- For Linear API fallback, source `scripts/.linear-env` and use `Authorization: $LINEAR_API_KEY`; never print or paste the token into tickets, logs, or responses
- End good sessions with "flush memory" to trigger the continual-learning / agents-memory-updater flow
- Implement first, then iterate from feedback — prefer direct action over over-planning
- Use compact text in UI labels, tooltips, and settings
- Feature/protocol code should be a standalone Solvys skill (`~/.claude/skills/`) rather than built directly into the Fintheon codebase

## Learned Workspace Facts

- Linear watcher state machine: `Todo/Backlog` → user moves issue to `In Progress (Solvys Agent)` → watcher dispatches Codex CLI locally → Cursor fallback only if Codex is unavailable → `linear-ack-complete.sh` or Codex equivalent → `Awaiting Review`
- Sprint branch naming format: `sprint/S{N}` (e.g., `sprint/S62`)
- ORCH tickets live under `sprint-md/S{SPRINT}-ORCH-{slug}.md` with child issues and execution waves
- Agent standard instructions injected by Linear watcher include: no classes, no enums, no emojis; keep files under 300 lines; read existing context files first
- Cursor skills live in `.cursor/skills/<name>/SKILL.md`; Claude Code agent skills in `.claude/skills/<name>/SKILL.md`
- Git tags follow `v{M.m.p}` format; release branches follow `v.{MONTH}.{DATE}.{PATCH}`
- Watcher script is `scripts/linear-watcher.sh`, polls every 5 seconds, uses `scripts/.linear-env`, and is opened at startup by `launchd/io.solvys.fintheon-linear-watcher.plist`
- Solvys Support MCP entry is `solvys-support` in `.mcp.json`; it launches `scripts/solvys-support-mcp.sh`, which maps `LINEAR_API_KEY` to `LINEAR_ACCESS_TOKEN` for `mcp-server-linear`
- Beta phases mapped to Linear Initiatives/cycles: Pre-Release, Closed Beta, Open Beta
- ORCH tickets are runbook/human items — the watcher automatically skips them
- Electron app uses CommonJS (`electron/main.cjs`, `electron/preload.cjs`), not ESM
- Local backend managed via launchd at `io.solvys.fintheon-backend` — must unload before restart
- RiskFlow scheduler has three independent tiers: FinancialJuice (5s real-time), Unified X (60s RTH / 600s AH), and Standard (5min)
