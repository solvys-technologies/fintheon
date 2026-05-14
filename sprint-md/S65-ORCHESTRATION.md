# S65 Orchestration -- Closed-Beta Product Tightening

## Sprint Goal

Tighten the app into a closed-beta-ready product experience: settings reflect actual user-customized platforms, lockout controls are real and correctly placed, runtime Peer Chat is stripped, toolbar/sidebar chrome is polished, the terminal behaves like a real CLI, in-app updating works through a real downloaded CTA, and Risk Signals stop looking stale or square-edged when expanded.

## Discovery Summary

- Current branch is `sprint/S64`; latest sprint docs/changelog are S64, so this plan uses S65.
- `src/lib/changelog.ts` shows S64 just touched Desk Plan, enhanced lockout, settings, Electron, day-plan routes, and agent briefing files. Preserve those changes.
- `git status --short` showed `.claude/feed-health.log` dirty before this plan; do not touch it.
- Live RiskFlow check on 2026-05-14 returned empty `/api/riskflow/risk-signals`, while `/api/diagnostics/feed-health` showed fresh feed data, `poller_stopped`, `scorerRunning: true`, and `unscoredBacklog: 326`.
- The current updater is not a true background auto-updater: Electron checks version, `update-download` opens GitHub, and `installUpdate` downloads only after click by spawning the install script.

## Track Definitions

### T1 -- Settings Platform Defaults and Lockout Policy

Scope: Settings platform defaults, Blocker tab lockout policy toggle, and Desk Plan lock/unlock row placement.

File Ownership:

- `frontend/contexts/SettingsContext.tsx`
- `frontend/components/settings/IframesTab.tsx`
- `frontend/components/settings/BlockerTab.tsx`
- `frontend/components/settings/TradingTab.tsx`
- `frontend/hooks/useLockout.ts`
- `backend-hono/src/services/lockout.ts`
- `backend-hono/src/routes/lockout/index.ts`
- `frontend/components/narrative/DayCard.tsx`
- `frontend/components/narrative/DayPlanChevronNav.tsx`

Acceptance: custom iFrame links appear in Default Platform; Blocker owns outside-window auto-lock toggle; Desk Plan lock/unlock and chevrons sit together and work.

### T2 -- Strip Peer Chat from Runtime App

Scope: Remove Peer Chat UI/API/service/runtime types while preserving non-chat peer registration, desk, voice, and worker coordination.

File Ownership:

- `frontend/components/consilium/ConsiliumTabConfig.ts`
- `frontend/components/consilium/ConsiliumHub.tsx`
- `frontend/components/peers/PeerChat.tsx`
- `frontend/hooks/useLocalPeer.ts` if dead after removal
- `backend-hono/src/routes/peers/index.ts`
- `backend-hono/src/services/peers/peer-chat.ts`
- `backend-hono/src/types/peers.ts`
- `.cursor/rules/agent-orchestration.md`

Acceptance: no runtime Peer Chat UI, no `/api/peers/chat/*`, dev-only coordination docs remain.

### T3 -- Header and Sidebar Chrome Polish

Scope: Left sidebar icon sizing, header pill grouping, icon-only shimmer active states, and left/right panel toggle relocation.

File Ownership:

- `frontend/components/layout/NavSidebar.tsx`
- `frontend/components/layout/TopHeader.tsx`
- `frontend/components/layout/PanelToggleGroup.tsx`

Acceptance: top sidebar icons match lower sizing; nametag+tier pill; call/anti-lag/lockout/time pill; browser/bulletin/chat/mic pill; icon-only shimmer; left/right panel toggles moved as requested.

### T4 -- Terminal Reliability and In-App Updater CTA

Scope: Terminal prompt/command behavior, footer drawer toggle placement, and true in-app update downloaded/install CTA.

File Ownership:

- `frontend/components/layout/FooterToolbar.tsx`
- `backend-hono/src/routes/terminal/handlers.ts`
- `electron/main.cjs`
- `electron/preload.cjs`
- `frontend/types/electron.d.ts`
- `frontend/components/VersionChecker.tsx`
- `frontend/lib/version-check.ts`
- `scripts/fintheon-install-update.sh` if needed
- `scripts/fintheon-update.sh` if needed
- `scripts/install-cli.sh` if needed
- `scripts/fintheon-cli.sh` if needed
- `package.json` / `bun.lock` if adding updater dependency

Acceptance: terminal opens empty with path prompt, global commands run, footer toggle sits right of version, update CTA appears after background download and installs/reopens.

### T5 -- Risk Signal Freshness and Card Polish

Scope: Risk-signal backend freshness/fallback metadata plus rounded expanded/hovered card backgrounds.

File Ownership:

- `backend-hono/src/services/riskflow/risk-signal-generator.ts`
- `backend-hono/src/routes/riskflow/handlers.ts`
- `frontend/components/narrative/RiskSignalCards.tsx`

Acceptance: endpoint exposes freshness; frontend stops presenting stale cache as current; expanded/hovered rows have rounded backgrounds.

### T6 -- Unification and Validation

Scope: Merge/integration validation, final changelog, regression checks.

File Ownership:

- `src/lib/changelog.ts`
- Any cross-track integration touch-ups after track owners finish.

Acceptance: frontend tsc passes, clean Vite build passes, backend build passes if backend changed, shell scripts pass syntax if touched, final runtime sweeps are clean.

## Execution Sequence

### Wave 1 (parallel)

```text
@sprint-md/S65-T1-settings-platform-lockout.md
```

```text
@sprint-md/S65-T2-peer-chat-runtime-strip.md
```

```text
@sprint-md/S65-T3-heading-sidebar-chrome.md
```

```text
@sprint-md/S65-T5-risk-signal-freshness-and-card-polish.md
```

### Wave 2 (after Wave 1)

```text
@sprint-md/S65-T4-terminal-and-in-app-updater.md
```

### Wave 3 (after Waves 1 and 2)

```text
@sprint-md/S65-T6-unification-validation.md
```

## Conflict Notes

- T3 does not own `FooterToolbar.tsx`; T4 owns it because terminal and footer drawer placement are coupled.
- T1 owns `DayCard.tsx`; T5 owns only `RiskSignalCards.tsx`, so dashboard/Sanctum polish should not collide.
- T2 must be surgical around "peer" references because Team, desks, voice, bulletin, and RiskFlow round-robin peer features are not the target.
- T4 is intentionally delayed until Wave 2 because it touches Electron/preload/types and `FooterToolbar.tsx`, which should integrate after header/sidebar grouping stabilizes.

## Validation Standard

Every implementation track must run:

```bash
npx tsc --noEmit --project frontend/tsconfig.json
rm -rf dist && npx vite build
```

Backend-changing tracks must also run:

```bash
cd backend-hono && bun run build
```

Script-changing tracks must run:

```bash
bash -n scripts/fintheon-install-update.sh scripts/fintheon-update.sh scripts/install-cli.sh scripts/fintheon-cli.sh
```
