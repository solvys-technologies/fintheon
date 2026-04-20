# Fintheon Backend (Hono)

This is a sub-project of [Fintheon](../CLAUDE.md). Read the parent CLAUDE.md for full context.

## Quick Reference

- **Build**: `bun run build` (not just tsc)
- **Deploy (main backend)**: `fly deploy --yes` from this directory — app `fintheon`, fintheon.fly.dev, uses `fly.toml` + `Dockerfile`
- **Deploy (news-worker)**: `fly deploy --config fly.news-worker.toml --yes` from this directory — app `fintheon-news-worker`, fintheon-news-worker.fly.dev, uses `Dockerfile.news-worker`
- **Local**: launchd-managed `io.solvys.fintheon-backend` on port 8080
- **Never** deploy from the repo root — there is no root Dockerfile or fly.toml anymore (they were a gostatic footgun that silently replaced Hono with a static server when anyone ran `fly deploy --app fintheon` from root)
- **Never** deploy to `pulse-api-*` (deleted legacy app)
- **Required env**: `OPENROUTER_API_KEY` — everything else has fallbacks

## Routines — restoring news-worker to operational state

If fintheon-news-worker is down or serving the wrong image, the restore command is:

```bash
cd backend-hono && fly deploy --config fly.news-worker.toml --yes
```

The `fly.news-worker.toml` pins `dockerfile = "Dockerfile.news-worker"` and `app = "fintheon-news-worker"`. As long as you run it from `backend-hono/` (not repo root) it cannot accidentally target the main `fintheon` app or use the wrong Dockerfile.

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
