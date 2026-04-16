# Fintheon Backend (Hono)

This is a sub-project of [Fintheon](../CLAUDE.md). Read the parent CLAUDE.md for full context.

## Quick Reference

- **Build**: `bun run build` (not just tsc)
- **Deploy**: `fly deploy --yes` (app `fintheon`, fintheon.fly.dev)
- **Local**: launchd-managed `io.solvys.fintheon-backend` on port 8080
- **Never** deploy from the repo root -- use this directory
- **Never** deploy to `pulse-api-*` (deleted legacy app)
- **Required env**: `OPENROUTER_API_KEY` -- everything else has fallbacks

## Key Paths

- `src/routes/` -- API route handlers
- `src/services/` -- Business logic, agent services
- `src/services/ai/agent-instructions/` -- Agent system prompts
- `src/boot/services.ts` -- Service initialization
- `src/services/harper-handler.ts` -- Harper chat handler

## After Changes

1. `bun run build`
2. Restart local: `launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist 2>/dev/null; launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist`
3. Test: `curl -s http://localhost:8080/api/diagnostics`
4. Deploy: `fly deploy --yes`
5. Verify: `curl -s https://fintheon.fly.dev/api/diagnostics`

## Solvys Skills

All 7 Solvys skills are available globally. Run `/solvys-audit` for pre-ship checks or `/solvys-deploy` for full 3-target deploy.
