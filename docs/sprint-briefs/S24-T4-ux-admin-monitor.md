# Sprint Brief: S24-T4 — V4 UX + Admin Rebuild + Monitoring Loop (Instance D — current session)

## Context

This is the user-facing side of the V4 redesign. TP will interact with this track constantly. The backend pieces (T1/T2/T3) are plumbing; this track is the cockpit.

TP's diagnosed friction with the current admin:

- **40+ independent sliders.** Refinement Engine has 1 regime + ~20–30 weights + ~15–20 commentators + 11 source toggles. No grouping, no presets.
- **Silent saves.** `console.error` only; no toast, no post-save confirmation. TP can't tell if his tweak took. Combined with the MDB silently overriding him 10h later (T1 fixes this), his changes felt permanently lost.
- **Manual rescore coupled, easy to miss.** 8-second hint message after a regime change. Blink and miss it.
- **Commentator cache TTL 5 min** — tier tweak plus immediate rescore uses stale multiplier.
- **No approval surface.** Agent proposals (from T1/T2/T3) need a home on both desktop and mobile.

Inherit-from-current-session: T4 continues on the current `s20-agent-swarm-platform-ops` branch where the notification scaffolding already landed (`emit.ts`, `notifications_log` table, `NotificationBell.tsx`, `NotificationDrawer.tsx`, `useNotificationHistory.ts`, `quiet-hours.ts` with market-hours-only defaults). Do NOT re-implement those pieces.

## Branch Target

Continue on `s20-agent-swarm-platform-ops`. Final merge into `s24-unify` (unification branch) via the orchestrator.

## Scope — Included

### Refinement Engine UI Rebuild

- `frontend/components/refinement/RefinementEngine.tsx` (rewrite, keep <300 lines — split helpers if needed)
  - Replace 40 sliders with **5 group-sensitivity dials**: Macro / Geopolitical / Corporate / Technical / Speaker.
  - Each dial: -1.0 (conservative) → 0 (neutral) → +1.0 (aggressive). Backend applies as a group-scale multiplier across all weights in that category.
  - **Preset system** (`frontend/components/refinement/PresetSelector.tsx`, new): "Default" / "Conservative" / "Aggressive" / "Custom". One-click applies a preset profile. Save-as-preset button for super admin.
  - **Advanced pane** (collapsible): per-event weight fine-tune (the existing `QuickWeightEditor` gets moved here, hidden by default).
  - **Toast on save** (use existing `ToastContext` in mobile, add equivalent in frontend if missing).
  - **Inline rescore-impact preview**: before committing a change, show "N items would cross score bucket X". Use a dry-run endpoint if available, otherwise compute client-side estimation.
- `frontend/components/refinement/RegimeControl.tsx` — keep mostly as-is, but replace the direct `/api/regime/set` call with `POST /api/regime/proposals` (self-proposal for manual overrides, auto-approved since the user is super admin). The `locked_until=now()+24h` lock (T1) means MDB won't overwrite for 24h.
- New: `frontend/components/refinement/MatrixEditor.tsx` — super-admin edit surface for `classification_matrix`. Regime dropdown → rubric JSON editor (structured, not raw). Each regime's rubric: required keywords, forbidden keywords, stance per eventType, auto-walk-back rules.
- New: `frontend/components/refinement/LexiconEditor.tsx` — CRUD for `lexicon_keywords`. Filter pending proposals, approve/deny inline.

### Admin Approval Inbox

- New page: `/admin/approvals` via `frontend/pages/admin/ApprovalsPage.tsx` (wired through `frontend/lib/router.tsx` or equivalent).
  - Three tabs: Regime Proposals / Lexicon Proposals / Walk-Back Reverts.
  - Each card shows:
    - Proposed change (e.g. "GEO_TENSIONS → BULL_TREND")
    - Reason text from the proposal
    - Evidence: inline chart screenshot (SPY/MQ), top 3 cited headlines, X sentiment snippet (pull from existing sentiment service if present)
    - Approve / Deny buttons with one-tap semantics
    - Shadow-mode status ("Agent graduated to auto-apply on this decision type" if T3's `shadow_stats` agreement rate > 0.85)
  - Deep-linkable: `/admin/approvals/{proposalId}` opens directly to that proposal.
- Sidebar nav entry in `frontend/components/layout/NavSidebar.tsx` — "Approvals" with an unread-count badge fed by `GET /api/regime/proposals?status=pending`.

### Mobile Approval Surface

- Extend existing `mobile/components/notifications/NotificationDrawer.tsx` (already shipped this session) to render approval cards inline for `category in [regimeProposals, lexiconProposals, walkBackReverts]`. Swipe-to-approve / swipe-to-deny action (extend `SwipeAction.tsx` already in mobile/components/shared).
- On approve/deny tap, POST to `/api/regime/proposals/:id/{approve|deny}`. Optimistic UI.
- Deep-link: tapping a push notification with `url=/admin/approvals/{id}` opens the drawer with that card expanded (desktop opens the full admin page).

### Monitoring Loop Scheduler

- `backend-hono/src/services/cron/monitoring-loop.ts` (new, <300 lines)
  - Runs every 2 hours. Wire via existing cron system at `backend-hono/src/services/cron/dispatch-scheduler.ts` pattern.
  - Steps:
    1. Fetch last-24h `scored_riskflow_items`. Compute L10 count, L9 count, regime vs market Δ.
    2. If L10 count > 5, flag regime rubric for review → create a `regime_proposals` row (proposed_by=`monitoring_loop`, proposed_regime=current, reason=`"L10 volume anomaly"`, severity=`medium`).
    3. Call `proposeLexiconUpdates()` from T2's `lexicon-proposer.ts`.
    4. Scan L9 flips in last 24h that haven't been reviewed — compute walk-back candidates via `walk-back-pairer.ts` from T2. File walk-back-revert proposals if found.
    5. Check regime match: use web-search helper (or defer if unavailable) to see if market is behaving consistent with `current_regime`. If divergent >0.5%, file a regime-change proposal.
  - All proposals go through `emit.ts` → push notifications.
- `backend-hono/src/services/cron/monitoring-config.ts` — super-admin-tunable schedule (default `0 */2 * * *`), on/off toggle, per-step enable/disable.

### Super Admin Controls

- `frontend/components/admin/MonitoringLoopCard.tsx` — show last run, next run, agreement rate per decision type (from T3's `/api/scoring/shadow-stats`), graduate button (confirms `canAutoApply[type] = true` with explicit super-admin confirmation).

### Shared UI Kit Additions

- `frontend/components/ui/Toast.tsx` (new, <150 lines) — single global toast bus. Replace all `console.error` in `refinement/*` with `toast.error(...)`.
- `frontend/components/ui/InlineDiff.tsx` (new, <150 lines) — for the "N items would change score" preview and the per-keyword lexicon diff approval.

## Scope — Excluded (DO NOT TOUCH)

- `backend-hono/src/services/analysis/iv-scorer.ts` — T2 + T3 own scoring math
- `backend-hono/src/routes/regime/proposals.ts`, `lexicon/*`, `classification-matrix/*` — T1 owns handlers
- `backend-hono/src/services/scoring/*` — T2 + T3 own
- `backend-hono/src/services/brief-generator.ts` — T1 owns
- All backend DB migrations — T1/T3 own
- `backend-hono/src/services/notifications/emit.ts` etc. — already shipped, this track only EXTENDS categories via existing API

## Known Issues to Preserve

- `mobile/components/notifications/NotificationBell.tsx` and `NotificationDrawer.tsx` already exist (shipped this session). Extend, don't rewrite.
- `backend-hono/src/services/notifications/quiet-hours.ts` defaults = 16:00 → 09:30 ET (outside RTH). Do not change.
- `src/lib/changelog.ts` — add entry per commit; never remove existing entries.
- Solvys palette: `#050402 / #c79f4a / #f0ead6`. No gradients, no colored emojis, no kanban borders (see global CLAUDE.md).

## Implementation Steps

1. Finalize + commit current uncommitted work (`quiet-hours.ts`). Push current branch.
2. Coordinate with T1 on when proposals API is live. Stub `/api/regime/proposals` locally if needed (mock with fixture data).
3. Build `frontend/components/ui/Toast.tsx` and `InlineDiff.tsx` first — everything else depends on them.
4. Rewrite `RefinementEngine.tsx` with 5 group dials + preset selector. Keep `QuickWeightEditor` + `CommentatorManager` + `SourceAccountsManager` in the Advanced pane.
5. Build `ApprovalsPage.tsx` + sub-components for each tab.
6. Build `MatrixEditor.tsx` + `LexiconEditor.tsx`.
7. Extend `NotificationDrawer.tsx` with approval-card rendering + swipe actions.
8. Build `monitoring-loop.ts` cron + `monitoring-config.ts`.
9. Add admin nav entries. Wire deep-links from push URLs.
10. Changelog entry per commit.

## Acceptance Criteria

- [ ] RefinementEngine loads with 5 group dials visible, Advanced pane collapsed. All existing sliders remain accessible under Advanced.
- [ ] Selecting a preset ("Conservative") updates all 5 dials + fires a single `PATCH /api/scoring/preset` that the backend applies.
- [ ] `/admin/approvals` displays pending proposals from T1 with chart screenshot + evidence inline.
- [ ] Approve/deny on desktop fires the correct backend call and removes the card optimistically; reappears red if the call fails.
- [ ] Mobile NotificationDrawer shows an approval card when category is `regimeProposals` or `lexiconProposals` or `walkBackReverts`. Swipe right approves, swipe left denies.
- [ ] Tapping a push notification with URL `/admin/approvals/{id}` on mobile opens the drawer to that card; on desktop opens the full admin page.
- [ ] Monitoring loop cron runs every 2h, creates proposals when thresholds breach.
- [ ] Toast appears on every save in Refinement Engine — success or failure, no more silent `console.error`.
- [ ] Live push test succeeds: `curl -X POST https://fintheon.fly.dev/api/notifications/web-push/test -H "Authorization: Bearer $JWT"` — TP's phone receives.

## Validation Commands

```bash
# Desktop frontend build
cd /Users/tifos/Desktop/Codebases/fintheon
rm -rf frontend/dist
npx tsc --noEmit --project frontend/tsconfig.json
cd frontend && npx vite build

# Mobile PWA build
cd /Users/tifos/Desktop/Codebases/fintheon/mobile
rm -rf dist
npx tsc --noEmit
npx vite build

# Backend (cron + monitoring loop)
cd /Users/tifos/Desktop/Codebases/fintheon/backend-hono
bun run build
launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist 2>/dev/null
launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist
curl -s http://localhost:8080/api/diagnostics

# Manual trigger of monitoring loop
curl -sX POST http://localhost:8080/api/scoring/monitoring/run-now \
  -H "Authorization: Bearer $JWT"

# Live push to TP's phone
curl -sX POST https://fintheon.fly.dev/api/notifications/web-push/test \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"title":"S24-T4 landed","body":"Refinement Engine rebuilt. Admin approvals live."}'
```

## Commit Format

```
[v.04.19.T4] feat: S24-T4 {component}: {description}

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```
