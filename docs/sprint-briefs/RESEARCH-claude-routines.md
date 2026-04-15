# Research: Claude Code Routines vs Hooks

**Date:** 2026-04-15
**Status:** Feature EXISTS — shipped as research preview (April 2026)
**Conclusion:** Keep existing hooks active. Routines are complementary, not a replacement.

## What Are Routines?

Routines are cloud-based autonomous prompts that run on Anthropic infrastructure, triggered by schedules, API calls, or GitHub webhooks. They are NOT a replacement for hooks.

## Key Differences

| Aspect        | Hooks (current)                           | Routines (new)                         |
| ------------- | ----------------------------------------- | -------------------------------------- |
| Scope         | Local, event-based during active sessions | Cloud-based, autonomous                |
| Execution     | Runs on your machine during tool calls    | Runs on Anthropic infrastructure       |
| Triggers      | PreToolUse, PostToolUse, Stop, etc.       | Scheduled (cron), API, GitHub webhooks |
| Configuration | Shell scripts in `settings.json`          | Web UI, CLI (`/schedule`), Desktop app |
| Availability  | Always (Desktop/CLI)                      | Pro+ plans, web Claude Code            |

## Our Current Hooks

1. **PreToolUse/Bash:** `block-dangerous.sh`, `require-tests-for-pr.sh`
2. **PreToolUse/Write|Edit:** `protect-files.sh`
3. **PostToolUse/Write|Edit:** Prettier, build check, ESLint
4. **PostToolUse/Bash:** `log-commands.sh`
5. **Stop:** `auto-commit.sh`, `harper-feed-health.sh`

## Migration Assessment

**Do NOT migrate hooks to routines.** They solve different problems:

- **Hooks** = real-time validation during active sessions (protect files, format on edit, block dangerous commands)
- **Routines** = autonomous unattended work (scheduled maintenance, GitHub PR automation, nightly audits)

### Potential Routine Use Cases (additive, not replacement)

1. **Nightly feed quality audit** — Routine runs daily to analyze dismissed items patterns and suggest content guard updates
2. **GitHub PR review** — Routine triggers on PR open to run test coverage analysis
3. **Scheduled scoring recalibration** — Routine runs weekly to review IV scoring accuracy

### Limits

- Pro: 5 routine runs/day
- Max: 15 routine runs/day
- Feature is in research preview — behavior may change

## Action Items

- [x] Keep existing hooks active (no migration)
- [ ] Consider adding a nightly feed-quality Routine once feature stabilizes
- [ ] Monitor Routines feature for GA announcement

## Sources

- https://code.claude.com/docs/en/routines
- https://claude.com/blog/introducing-routines-in-claude-code
