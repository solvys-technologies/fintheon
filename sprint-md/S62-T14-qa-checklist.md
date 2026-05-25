# Sprint Brief: S62-T14 — Pre-Release QA Checklist

- **Linear**: SOL-52
- **Parent ORCH**: @sprint-md/S62-ORCH-platform-qa-hygiene.md
- **Branch**: `sprint/S62`
- **Assignee**: Sam Frederique
- **Wave**: 1 (parallel — no dependencies)

## Context

Before Closed Beta ships, we need a comprehensive pre-release QA checklist covering build, smoke, and regression tests across all surfaces. This task creates the checklist document and runs through it once end-to-end. The checklist covers frontend build, backend build, type checks, key endpoint smoke tests, key UI surface smoke tests, visual regression for the Solvys industrial-luxe palette, and Electron smoke.

## Branch Target

`sprint/S62`

## Scope — Included

- [ ] Create `sprint-md/S62-T14-qa-checklist.md` with the full checklist
- [ ] Frontend build verification: `npx vite build`
- [ ] Backend build verification: `cd backend-hono && bun run build`
- [ ] Type check: `npx tsc --noEmit --project frontend/tsconfig.json`
- [ ] Key endpoint smoke tests (curl):
  - Health: `curl -s http://localhost:8080/api/health`
  - Auth: `curl -s http://localhost:8080/api/auth/status`
  - Chat: CAO chat endpoint
  - Briefs: MDB/ADB/PMDB/TWT brief endpoints
  - RiskFlow: riskflow endpoint
  - Arbitrum: arbitrum chamber endpoint
- [ ] Key UI surface smoke tests:
  - Consilium (main dashboard)
  - Sanctum (3-page chamber)
  - Chat drawer (CAO chat)
  - Strategium (refinement surface)
  - Refinement (admin controls)
  - Agent Desk panel (post-rename)
- [ ] Visual regression: Solvys industrial-luxe palette consistency
  - BG `#050402` — warm near-black canvas
  - Accent `#c79f4a` — Solvys Gold
  - Text `#f0ead6` — warm off-white
  - Frosted-glass surfaces where appropriate
  - No gradients, no AI sparkles, no Kanban borders
- [ ] Electron smoke:
  - Window creation
  - Webview loading
  - Popup allowlist
  - Dock menu (from S63 T3)
  - System notifications
- [ ] Run through checklist once end-to-end

## Scope — Excluded (DO NOT TOUCH)

- Mobile PWA surface — separate track
- Security/penetration testing — post-Closed Beta
- Performance benchmarking — non-blocking for Closed Beta
- Supabase RLS verification — handled in separate infra track
- Desktop DMG build — handled by `/solvys-beta`

## Checklist Document Format

The `S62-T14-qa-checklist.md` should use this structure:

```markdown
# S62-T14 — Pre-Release QA Checklist

## Build
- [ ] Frontend: `npx vite build`
- [ ] Backend: `cd backend-hono && bun run build`
- [ ] Type check: `npx tsc --noEmit --project frontend/tsconfig.json`

## Endpoint Smoke
- [ ] Health: `curl -s http://localhost:8080/api/health`
- [ ] Auth status
- [ ] CAO chat
- [ ] Briefs (MDB/ADB/PMDB/TWT)
- [ ] RiskFlow
- [ ] Arbitrum chamber

## UI Surface Smoke
- [ ] Consilium loads
- [ ] Sanctum 3-page chamber loads
- [ ] Chat drawer opens/closes
- [ ] Strategium loads
- [ ] Refinement admin loads
- [ ] Agent Desk panel loads

## Visual Regression
- [ ] Palette audit (BG #050402, Accent #c79f4a, Text #f0ead6)
- [ ] Frosted-glass surfaces present where appropriate
- [ ] No gradients, sparkles, or Kanban borders

## Electron Smoke
- [ ] Window creates
- [ ] Webview loads
- [ ] Popup allowlist
- [ ] Dock menu
- [ ] Notifications

## Notes / Findings
```
```

## Acceptance Criteria

- [ ] `sprint-md/S62-T14-qa-checklist.md` exists with complete checklist
- [ ] All checklist items are actionable (not vague)
- [ ] One full end-to-end run completed
- [ ] Findings documented in the checklist file
- [ ] Blocking issues escalated to TP

## Validation Commands

```bash
# Build
npx vite build
cd backend-hono && bun run build

# Type check
npx tsc --noEmit --project frontend/tsconfig.json

# Health
curl -s http://localhost:8080/api/health
```

## Commit Format

```
[v.6.0.27-s62-t14] docs: pre-release QA checklist for Closed Beta
```
