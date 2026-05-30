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

### Sprint Numbering

- Read `sprint-md/SPRINT-NUMBERING.md` before creating sprint docs or Linear issues.
- S100+ is a post-beta/deferred milestone lane, not the active sprint chronology.
- The active sprint lane resumes from S83: S84 is App Store readiness, and S85 is Infisical/Portless security infra.
- Do not infer the next active sprint by taking the highest numeric `S{N}` filename.

### Deployment Flow

1. **Frontend**: Automatic on push to `main` (Vercel).
2. **Backend**: Manual deploy to Fly.io AFTER PR review.

## Quality Gates (No Exceptions)

- No TypeScript errors.
- No build failures.
- No duplicate imports.
- Run `npx vite build` before merge.
- Desktop releases must pass `bun run release:preflight` before publish and `bun run release:verify-dmg` after upload/deploy. Do not leave a release active unless the deployed updater endpoint produces a downloadable, checksum-verified GitHub DMG.

## Post-Ship Hook: Install Maintenance

**After every `/solvys-ship` or deploy**, run the install maintenance audit:
→ Load `.cursor/skills/install-maintenance/SKILL.md` and execute the checklist.

This ensures `fintheon update` never breaks for users after new code ships. The audit checks for undocumented env vars, missing dependency backfills, and script drift. If any install files need updating, include `INSTALL-UPDATE:` in the commit message.
