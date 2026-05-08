# Sprint Brief: T10 — Integration + Validation + Deploy

## Context

This is the unification pass. All 9 tracks merge here. The orchestrating Claude Code instance (running this brief) performs the merge, resolves interface mismatches, runs the full validation suite, and deploys to all 3 targets.

## Branch Target

`s20-agent-swarm-platform-ops`

## Scope — Included

- [ ] Merge all track changes (resolve any conflicts)
- [ ] Fix import path mismatches across track boundaries
- [ ] Verify agent dossiers compose correctly into system prompts
- [ ] Verify differentiated context feeding produces different headline sets per agent
- [ ] Verify Oracle research findings appear in Oracle's deliberation prompt
- [ ] Verify agent memory accumulates across deliberation cycles
- [ ] Verify outcome tracker captures predictions from deliberation
- [ ] Verify conversation persistence across mobile/desktop
- [ ] Verify mobile tool approval UX works end-to-end
- [ ] Run full ArbitrumChamber deliberation and inspect all 4 agent outputs for differentiation
- [ ] Full build verification (backend, frontend, desktop, mobile)
- [ ] Deploy to Fly.io (backend)
- [ ] Deploy to Vercel (desktop)
- [ ] Deploy to Vercel (mobile) — clean rebuild: `rm -rf dist` before build
- [ ] Restart local backend via launchctl
- [ ] Add changelog entries to `src/lib/changelog.ts`
- [ ] Verify all endpoints healthy on prod

## Scope — Excluded

- No new features. Integration and validation only.

## Known Issues to Preserve

- Memory: `feedback_flyio_deploy` — deploy from `backend-hono/` dir, never from repo root, deploy to app `fintheon`
- Memory: `feedback_vercel_mobile_deploy` — prebuilt from `mobile/` dir, git auto-builds disabled
- Memory: `feedback_clean_rebuild_mobile` — always `rm -rf dist` before mobile vite build
- Memory: `feedback_start_backend_after_deploy` — always restart local backend after deploy
- Memory: `feedback_test_before_done` — always redeploy + test endpoints before reporting complete
- Memory: `feedback_no_dev_server` — never start vite dev server, verify via tsc + build only

## Validation Checklist

### Agent Swarm

- [ ] Trigger ArbitrumChamber deliberation → 4 agents produce divergent scores and reasoning
- [ ] Oracle references prediction market data from scheduled research
- [ ] Feucht references specific price levels and playbook models
- [ ] Consul references specific mega-cap fundamentals (not narratives)
- [ ] Herald takes contrarian stance with risk framework
- [ ] Agent memory rows exist in `agent_memory` table after deliberation
- [ ] `deliberation_outcomes` row created for tracking

### Platform Operations

- [ ] Conversation persistence: mobile → desktop → same history
- [ ] Mobile tool approval: card renders, approve/deny works, stream resumes
- [ ] Push notification routes to correct tab
- [ ] REFLECT Routine fires at scheduled time
- [ ] Backend cold-start improved (server responds before all crons boot)
- [ ] `/health` includes service registry data
- [ ] `iv-scoring-v2.ts` and `central-scorer.ts` no longer exist (split into modules)

### Legacy Removal

- [ ] `grep "Alex Vane\|Priya Nair\|Marcus Webb" backend-hono/` returns 0
- [ ] `grep -ri "agentic chatroom" .` returns 0
- [ ] `SubAnalyst Context/` directory does not exist
- [ ] No active Notion service references

### Builds

- [ ] `cd backend-hono && bun run build` passes
- [ ] `npx tsc --noEmit --project frontend/tsconfig.json` passes
- [ ] `npx vite build` (desktop) passes
- [ ] `cd mobile && rm -rf dist && bun run build` passes

### Deploy

- [ ] `flyctl deploy` from `backend-hono/` succeeds
- [ ] Vercel desktop deploy succeeds
- [ ] Vercel mobile deploy succeeds (prebuilt)
- [ ] `curl https://fintheon.fly.dev/health` returns healthy
- [ ] `curl https://fintheon.fly.dev/api/diagnostics` shows all services
- [ ] Local backend restarted: `launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist && launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist`

## Validation Commands

```bash
cd backend-hono && bun run build
npx tsc --noEmit --project frontend/tsconfig.json
npx vite build
cd mobile && rm -rf dist && bun run build

# Deploy
cd backend-hono && flyctl deploy --app fintheon
# Vercel deploys via CLI or dashboard

# Verify
curl -s https://fintheon.fly.dev/health | jq .
curl -s https://fintheon.fly.dev/api/diagnostics | jq .
curl -s https://fintheon.fly.dev/api/riskflow/sources | jq .

# Cleanup verification
grep -r "Alex Vane\|MARKET_ANALYSTS" backend-hono/src/
grep -ri "agentic chatroom" .
grep -ri "notionservice\|pollnotion" backend-hono/src/ frontend/
ls "SubAnalyst Context/" 2>/dev/null && echo "FAIL: SubAnalyst still exists" || echo "OK: cleaned"
```
