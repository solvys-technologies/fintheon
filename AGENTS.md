## Learned User Preferences

- Use `--sandbox disabled` flag for Cursor CLI agent commands to bypass git write approval prompts
- Prefer `linear-ack-complete.sh` script for moving issues to Awaiting Review state
- All Linear issue prefixes must be uppercase (`S62-T1`, `S62-ORCH`, `S38-CHAT`)
- Agents should read AGENTS.md, CLAUDE.md, WORKSPACE.md, and `.cursor/rules/` before starting work

## Learned Workspace Facts

- Linear watcher state machine: `In Progress` → watcher detects → `In Progress (Cursor CLI)` → agent works → `linear-ack-complete.sh` → `Awaiting Review`
- Sprint branch naming format: `sprint/S{N}` (e.g., `sprint/S62`)
- ORCH tickets live under `sprint-md/S{SPRINT}-ORCH-{slug}.md` with child issues and execution waves
- Agent standard instructions injected by Linear watcher include: no classes, no enums, no emojis; keep files under 300 lines; read existing context files first
