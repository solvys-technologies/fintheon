# Sprint Brief: S59-T4 — Unification + Full Stack Validation

## Context

T1 removed the Python Hermes sidecar and ported the runtime to native TypeScript. T2 unified agent personas under SOUL.md and activated REFLECT + GEPA self-learning loops. T3 built the agent health dashboard. This track merges all changes, resolves any conflicts, and runs the full validation suite — type checks, builds, API smoke tests, and Playwright browser verification. The sprint ships tonight.

## Branch Target

`s59-hermes-native` (shared)

## Scope — Included

### Merge & Conflict Resolution

- [ ] Pull all T1/T2/T3 changes from the shared branch
- [ ] Resolve any conflicts in `src/lib/changelog.ts` (all tracks add entries)
- [ ] Resolve conflicts in `backend-hono/src/boot/services.ts` if both T1 and T2 touched it (T1 removes sidecar init, T2 adds GEPA init)
- [ ] Verify no other file was touched by more than one track (the track definitions were designed for zero overlap)
- [ ] Run `git diff --stat` against main to confirm expected file count

### Backend Validation

- [ ] TypeScript check: `cd backend-hono && npx tsc --noEmit`
- [ ] Backend build: `cd backend-hono && bun run build`
- [ ] Restart backend: `launchctl unload/load`
- [ ] Smoke test Harper chat: `POST /api/harper/chat`
- [ ] Smoke test RiskFlow feed: `GET /api/riskflow/feed`
- [ ] Smoke test Arbitrum latest: `GET /api/arbitrum/latest`
- [ ] Smoke test agent health: `GET /api/apparatus/agent-health`
- [ ] Smoke test diagnostics: `GET /api/diagnostics`
- [ ] Verify REFLECT is enabled in logs (not "disabled")
- [ ] Verify GEPA startup in logs
- [ ] Verify sidecar removal: confirm `hermes-sidecar/` doesn't exist, no `HERMES_SIDECAR` env refs remain

### Frontend Validation

- [ ] TypeScript check: `npx tsc --noEmit --project frontend/tsconfig.json`
- [ ] Clean build: `rm -rf dist && npx vite build`
- [ ] Verify no build warnings from stale imports

### Mobile Validation

- [ ] TypeScript check: `npx tsc --noEmit --project mobile/tsconfig.json`
- [ ] Clean build: `cd mobile && rm -rf dist && npx vite build`

### Browser Verification (Playwright / Browser Harness)

- [ ] Verify Sanctum loads without errors
- [ ] Verify CAO chat (Harper) responds with Fintheon/PIC identity awareness — ask "who do you work for?"
- [ ] Verify Apparatus → Agent Health dashboard renders all 5 agents with status indicators
- [ ] Verify RiskFlow feed loads and displays scored items
- [ ] Verify Strategium panels load (mission control, economic calendar)
- [ ] Verify mobile PWA loads agent health view at responsive breakpoints

### Changelog Sweep

- [ ] Ensure all 3 tracks + unification have changelog entries in `src/lib/changelog.ts`
- [ ] Ensure no duplicate entries

## Scope — Excluded

- New feature development — this track only validates, merges, and ships
- Deploy to production — handled by `/solvys-deploy` after this track passes
- Any file modifications beyond merge conflict resolution and changelog entries

## Acceptance Criteria

- [ ] All 3 validation suites pass (backend, frontend, mobile)
- [ ] Zero merge conflicts remain
- [ ] Harper chat responds with PIC/Fintheon identity awareness
- [ ] Agent health endpoint returns data for all 5 agents
- [ ] REFLECT is running (not disabled in logs)
- [ ] GEPA is wired in boot
- [ ] `hermes-sidecar/` is fully removed
- [ ] No `HERMES_SIDECAR` references in codebase
- [ ] All 4 briefs have changelog entries
- [ ] Browser verification passes on all key surfaces

## Validation Commands

```bash
# ── Backend Validation ──────────────────────────────
cd backend-hono && npx tsc --noEmit
cd backend-hono && bun run build
launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist 2>/dev/null
launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist
sleep 3

# Harper chat — should respond with Fintheon/PIC identity
curl -s http://localhost:8080/api/harper/chat -X POST \
  -H "Content-Type: application/json" \
  -d '{"message":"who do you work for and what platform are you on?"}' | head -c 500

# RiskFlow feed
curl -s http://localhost:8080/api/riskflow/feed | head -c 200

# Arbitrum latest
curl -s http://localhost:8080/api/arbitrum/latest | head -c 200

# Agent health
curl -s http://localhost:8080/api/apparatus/agent-health | head -c 500

# Diagnostics
curl -s http://localhost:8080/api/diagnostics | head -c 500

# Check REFLECT status in logs
tail -30 /tmp/fintheon-backend.log | grep -i reflect

# Check GEPA status in logs
tail -30 /tmp/fintheon-backend.log | grep -i gepa

# Verify sidecar gone
test ! -d hermes-sidecar && echo "Sidecar removed" || echo "FAIL — sidecar still exists"
grep -r "HERMES_SIDECAR" backend-hono/src/ && echo "FAIL — stale refs" || echo "OK — no stale refs"

# ── Frontend Validation ─────────────────────────────
npx tsc --noEmit --project frontend/tsconfig.json
rm -rf dist && npx vite build

# ── Mobile Validation ───────────────────────────────
npx tsc --noEmit --project mobile/tsconfig.json
cd mobile && rm -rf dist && npx vite build

# ── Git Validation ──────────────────────────────────
git diff --stat main...HEAD
echo "---"
echo "If all above pass: sprint ready for /solvys-deploy"
```

## Commit Format

```
[v6.0.15] chore: S59-T4 unify tracks, resolve conflicts, full stack validation
```

## Post-Track Handoff

After this track passes all validation, the orchestrator runs `/solvys-deploy` to ship to all 3 targets:

1. Fly.io backend (`fintheon.fly.dev`)
2. Vercel desktop frontend
3. Vercel mobile PWA
