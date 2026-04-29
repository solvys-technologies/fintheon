# Sprint Brief: S50-T5 — Unification + Mobile Port + Deploy Gate

## Context

T1-T4 land foundation, performance migration, Arbitrum overlays, and backend endpoints on shared branch `s50-charts`. T5 is the final wave: resolve any merge conflicts, port the Performance Tab charts to the Mobile PWA (NO Arbitrum overlays on mobile per TP), run end-to-end smoke across desktop + mobile + backend, verify nothing in the off-limits list moved, and bundle screenshots for TP sign-off. T5 does NOT fire `/solvys-deploy` — that's TP-invoked.

## Orchestration Context

**Sprint:** S50 — Charts Refactor (Solvys-skinned Recharts). See `sprint-md/S50-ORCHESTRATION.md` for the full sprint plan.

**Your wave:** Wave 3 (final unification). You run alone. T1-T4 must all merge before you start.

**What you inherit:**

- T1: Recharts foundation kit at `frontend/components/charts/**` + `frontend/lib/charts/**`. Port the shape to mobile, but read tokens from `mobile/index.css` (mobile token system divergence per memory `reference_catalyst_image_primitives.md`).
- T2: 5 migrated Performance Tab charts + `ChartToggle.tsx`. Port consumer files to `mobile/components/journal/**` with same prop signatures.
- T3: Arbitrum chart overlays (desktop only — **DO NOT port to mobile**, per TP).
- T4: 3 backend endpoints. Smoke them via curl during desktop validation.

**Your job is unification, not redesign.** If a cross-track regression appears, bounce it back to the owning track — T5 only resolves merge conflicts and ports to mobile.

**Gate to deploy:** All acceptance criteria green + screenshot bundle posted + TP signed off. Then **TP fires `/solvys-deploy`** (you do NOT run deploy — it's TP-invocable only per memory `feedback_solvys_skills_user_invocable.md`).

**Owner pool:** non-Claude-Code (Cursor / Codex / junior) OR the orchestrator Claude on TP's machine.

## Branch Target

`s50-charts` (after T1-T4 land)

**Wave:** 3
**Complexity:** High
**Estimated:** Mobile port (~400 LOC) + integration smoke + screenshot regression

## Scope — Included

- [ ] **Merge resolution.** Pull `s50-charts` HEAD; if any track left a conflict, resolve favoring T1's wrapper interface and T2/T3's consumer order. Do NOT re-do any track's work.
- [ ] **Pre-port iframe baseline:**
  - Run `grep -rn iframe frontend/ mobile/ --include="*.tsx" | wc -l` BEFORE making any changes; record the count for regression check.
- [ ] **Mobile port (Performance Tab charts ONLY):**
  - [ ] `cd mobile && bun add recharts@^2.13.0` → commit `mobile/bun.lock`.
  - [ ] Create `mobile/components/charts/` — port T1's wrappers. Read tokens from `mobile/index.css` instead of `frontend/index.css` (mobile token system divergence per memory `reference_catalyst_image_primitives.md`).
  - [ ] Create `mobile/components/journal/` — port BloombergChart, PnLChart, EquityCurveDrawer, ERTrendChart, HybridChart consumers. Layout: stacked vertical for narrow screens; subsection toggles default to ON.
  - [ ] Wire into existing mobile journal/performance routes (search `mobile/components/home/` and `mobile/components/` for journal entry points).
  - [ ] **Do NOT port Arbitrum chart overlays to mobile.** TP scoped Arbitrum as desktop-only.
- [ ] **End-to-end smoke (desktop):**
  - `tsc --noEmit` clean.
  - `rm -rf frontend/dist && cd frontend && bun run build && cd ..` clean.
  - `cd backend-hono && bun run build && cd ..` clean.
  - `launchctl unload && launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist`.
  - `curl http://localhost:8080/api/diagnostics` → healthy.
  - Manual verify each migrated chart in dev (NOT vite dev — open the built `frontend/dist/index.html` via Electron or a static preview).
- [ ] **End-to-end smoke (mobile):**
  - `tsc --noEmit --project mobile/tsconfig.json` clean.
  - `rm -rf mobile/dist && cd mobile && bun run build && cd ..` clean.
- [ ] **Off-limits regression check:**
  - `git diff main..s50-charts -- <off-limits paths>` → empty diff (see Validation Commands).
  - `grep -rn iframe frontend/ mobile/ --include="*.tsx" | wc -l` → equals pre-port baseline.
  - Manual: open Sanctum chart-mode side-by-side; confirm TV iframe renders, ArbitrumChamber visible, overlay toggle works (default OFF).
- [ ] **Screenshot regression:** before/after of:
  - Performance Tab (charts visible + each subsection toggled hidden then restored)
  - ERTrendChart in PsychAssist consumer
  - EquityCurveDrawer open
  - Sanctum chart-mode (overlays OFF)
  - Sanctum chart-mode (each Arbitrum overlay ON)
  - Mobile journal performance views
- [ ] Append one final changelog entry consolidating T1-T5.
- [ ] **Deploy:** TP fires `/solvys-deploy` after sign-off. T5 owner does NOT run deploy (per memory `feedback_solvys_skills_user_invocable.md`).

## Scope — Excluded (DO NOT TOUCH)

- Re-doing any of T1/T2/T3/T4's work — only resolve conflicts and port to mobile.
- Adding Arbitrum overlays to mobile.
- Net-new features.
- Schema migrations.
- Anything in the global off-limits list.

## Off-Limits (hard ban)

- `frontend/components/chat/slots/TVChartSlot.tsx`
- `frontend/components/narrative/SanctumChart.tsx`
- `frontend/components/RiskFlow*.tsx`
- `frontend/components/IV*` / `NothingFuse*` / `IVStack*`
- `frontend/components/SolvysLoader*.tsx` + `frontend/components/icons/*`
- `frontend/components/regimes/ConfidenceBar.tsx`
- `frontend/components/consilium/DAGProgressBar.tsx`
- Any `<iframe>` anywhere in `frontend/` or `mobile/`
- `frontend/index.css` and `mobile/index.css` (read-only — no new tokens)
- `backend-hono/src/services/arbitrum/engine.ts`, `seats.ts`, `event-trigger.ts`
- News pollers (per memory `feedback_news_pollers_locked.md`)

## Reuse Inventory

- All T1 wrappers at `frontend/components/charts/` — port shape to mobile.
- T2 migrated chart files — port to mobile with same prop signatures.
- `mobile/index.css` — read existing tokens; do not redefine.
- Mobile RiskFlowCard pattern (memory `feedback_riskflow_card_anatomy.md`) for layout discipline.

## Known Issues to Preserve

- Mobile uses a different token system than frontend (memory `reference_catalyst_image_primitives.md`). Always read mobile's own `index.css` and v4 CSS config; never copy from frontend.
- "Clean rebuild mobile" rule (memory `feedback_clean_rebuild_mobile.md`): `rm -rf mobile/dist` before every build — stale bundles deploy otherwise.
- T5 does NOT cut releases. TP fires `/solvys-deploy` after sign-off.

## Implementation Steps

1. Pull `s50-charts` after T1-T4 are all merged.
2. Run desktop validation block (tsc + builds + curl). If a cross-track regression appears: T5 only resolves merge conflicts; bounce real bugs back to the owning track.
3. Capture pre-port iframe count + screenshots of every affected desktop surface.
4. Mobile port:
   1. `cd mobile && bun add recharts@^2.13.0`
   2. Create `mobile/components/charts/` mirroring frontend wrappers, but reading tokens from `mobile/index.css`.
   3. Create `mobile/components/journal/` chart consumers.
   4. Wire into mobile entry points.
   5. Build mobile: `rm -rf mobile/dist && cd mobile && bun run build`.
5. Off-limits regression check — run grep + git diff commands below.
6. Capture post-port screenshots on mobile (use a phone or a narrow browser window).
7. Append final changelog entry.
8. Bundle screenshots, post to TP. Wait for sign-off.
9. TP fires `/solvys-deploy`.

## Acceptance Criteria

- [ ] All T1-T4 tracks merged and conflict-free.
- [ ] Desktop tsc + frontend build + backend build all clean.
- [ ] Mobile tsc + mobile build all clean.
- [ ] Backend reachable via launchd; `/api/diagnostics` healthy.
- [ ] Off-limits diff is empty.
- [ ] Iframe count unchanged from pre-port baseline.
- [ ] Mobile has Performance Tab charts (no Arbitrum overlays).
- [ ] All screenshots captured and posted to TP.
- [ ] TP signed off.
- [ ] **`/solvys-deploy` fired by TP** — Fly.io backend + Vercel desktop + Vercel mobile all green.

## Validation Commands

```bash
# Desktop full
npx tsc --noEmit --project frontend/tsconfig.json
rm -rf frontend/dist && cd frontend && bun run build && cd ..
cd backend-hono && bun run build && cd ..
launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist
launchctl load   ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist
curl -s http://localhost:8080/api/diagnostics | head -c 200

# Mobile
npx tsc --noEmit --project mobile/tsconfig.json
rm -rf mobile/dist && cd mobile && bun run build && cd ..

# Off-limits diff (MUST be empty)
git diff main..s50-charts -- \
  frontend/components/chat/slots/TVChartSlot.tsx \
  frontend/components/narrative/SanctumChart.tsx \
  frontend/components/RiskFlow*.tsx \
  frontend/components/IV*.tsx \
  frontend/components/regimes/ConfidenceBar.tsx \
  frontend/components/consilium/DAGProgressBar.tsx \
  frontend/components/SolvysLoader*.tsx \
  | head -50

# Iframe count (MUST equal pre-port baseline)
grep -rn iframe frontend/ mobile/ --include="*.tsx" | wc -l
```

## Commit Format

```
[v5.36.0] feat: S50 charts refactor — T1+T2+T3+T4 unified, mobile parity, screenshots logged
```
