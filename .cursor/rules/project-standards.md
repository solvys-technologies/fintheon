# Fintheon Project Standards

## Identity
- **Platform**: Fintheon (by Priced In Capital)
- **Agent Roster**: Harper-Hermes, Oracle, Feucht, Consul, Herald, Claude Code

## Core Engineering Principles
1. **TypeScript First**: Clean, typed, documented code. Enforce strict mode.
2. **Docs Reference**: Always check official API documentation before implementing integrations.
3. **Observability**: Implement robust error handling and logging.
4. **Modularity**: Files must be <= 300 lines. Split logic early.
5. **Declarative**: Use functional patterns. Avoid classes.

## Workflow & Hygiene

### Branching Convention (Mandatory)
Format: `v.{MONTH}.{DATE}.{PATCH}`
Example: `v.5.28.1` (5th month, 28th day, 1st patch)

### Commit Format
`[v.X.Y.Z] type: description`

### Deployment Flow
1. **Frontend**: Automatic on push to `main` (Vercel).
2. **Backend**: Manual deploy to Fly.io AFTER PR review.

## Quality Gates (No Exceptions)
- No TypeScript errors.
- No build failures.
- No duplicate imports.
- Run `npx vite build` before merge.
