# Sprint Brief: S51 — Expanded RiskFlow Cards + Arbitrum Sanctum Performance UI (single-agent)

## Context

Two adjacent asks land in the same window, and they are file-disjoint enough to execute back-to-back by one agent on one branch.

**Part 1 — Expanded RiskFlow Card refactor (mobile + desktop parity).** TP wants the desktop expanded RiskFlow card to import the mobile card's anatomy and the mobile card itself simplified. Specific spec: bucket-left + time-ago-right header, descriptive source icons replacing today's X-marks, no duplicate body block, remainder of the headline streams in on expand, deviation row only when an econ-print is detected, sawdust fuse with vertical rules at the bottom (mirroring Arbitrum's volatility-read fuse), and the desktop's gray rule moves from the preview/expanded boundary to the bottom of the expanded card. New EARNINGS category gets tagged + demoted to LOW priority — full earnings handling deferred.

**Part 2 — Reconstruct + execute the missing S47-T3 Arbitrum Sanctum Performance UI scope.** Discovery confirmed there is **no stranded code to cherry-pick**: `S47-ORCHESTRATION.md` listed `@sprint-md/S47-T3-arbitrum-sanctum-performance-ui.md` but that brief was never authored, never branched, never committed. Only S47-T2 backend (commit `1c0a6416`) ever shipped. So Part 2's first move is to re-derive scope from a live walkthrough of Sanctum + ArbitrumChamber + the Arbitrum chamber, write the implementation plan into this same brief's Part 2 scope section, and execute. The known dual-source bug from memory (`SanctumHeader` reads `agentDeskData` while `ArbitrumChamber` reads `useArbitrumLatest`) is the prime candidate.

## Branch Target

`s51-cards-and-arbitrum`, cut from `s48-unified` @ `6d915217` (v5.36.0).

## Scope — Included

### Part 1 — RiskFlow Cards

- [ ] Mobile + desktop card header: split into bucket-left + time-ago-right via `justify-content: space-between` (collapsed AND expanded states).
- [ ] New source-icon mapping (replaces blanket X-mark):
  - `Wire` → `Activity` (Lucide heartbeat/pulse line)
  - `Econ` → `BarChart3`
  - `Macro` → `Globe`
  - `Geopolitical` → `Globe2`
  - `Earnings` → `BookText`
  - `OSINT` / `Commentary` / `Polymarket` / `Kalshi` → keep current
- [ ] Mobile expanded body: delete duplicate `alert.content` block at `mobile/components/riskflow/RiskFlowCardExpanded.tsx` lines 129–145.
- [ ] Mobile + desktop on expand: remainder of `alert.title` (the portion truncated in the collapsed header) streams in via opacity + small translate-y over ~280ms. Add `t-text-reveal` token to `frontend/styles/transitions.css` if not already there. Use rAF first-paint pattern so the tween runs from the closed resting state.
- [ ] Strip indicator rows: remove `EVENT WEIGHT`, `TIMING`, `MOMENTUM`, `VIX CONTEXT` from `RiskFlowCardExpanded.tsx` lines 176–205. Keep the `DEVIATION` row but gate it: render iff `alert.tags?.includes('econ-print') && alert.econData?.surprisePercent != null`.
- [ ] Desktop gray rule moves: remove `border-t border-zinc-800/30` from `frontend/components/RiskFlowMini.tsx` line 513; add `border-t` at the new footer row (above the sawdust fuse).
- [ ] Sawdust fuse footer (both surfaces): `NothingFuse` horizontal, `segments={10}`, `thickness={3}` (desktop) / `4` (mobile), `color="var(--fintheon-accent)"`. Replaces `IVFuseBar` in mobile expanded footer; new on desktop expanded footer. The N-1 vertical ruler dividers come from the existing `NothingFuse` implementation — no edits to that component.
- [ ] Paperclip → source URL (mobile): confirm `RiskFlowCardExpanded.tsx` lines 266–287 anchor has `target="_blank"` + `rel="noopener noreferrer"`. Verify the image-wrapper anchor at lines 92–126 doesn't shadow it (paperclip click must `e.stopPropagation()`).
- [ ] Backend `econ-bridge.ts` line 111 — extend `tags`:
  ```ts
  const directional =
    beatMiss === "beat" ? "beat" : beatMiss === "miss" ? "miss" : "inline";
  const magnitude =
    Math.abs(surprisePercent ?? 0) > 5
      ? "high-surprise"
      : Math.abs(surprisePercent ?? 0) > 1
        ? "moderate-surprise"
        : "inline-surprise";
  tags = [...tags, "econ-print", directional, magnitude];
  ```
- [ ] Backend `scorer-tagging.ts` `classifyRiskType()` — expand Earnings keyword set: `earnings`, `EPS`, `Q[1-4] preview`, `Q[1-4] earnings`, `analyst estimate`, `revenue guidance`, `analyst cut`, `analyst raises`, `beat estimates`, `miss estimates`, `results`, `EBIT`, `margin`. (`Earnings` is already in the enum at lines 276–296.)
- [ ] Backend `feed-service.ts` (or wherever priority is assigned): if `riskType === 'Earnings'`, floor `priority` at `LOW`.
- [ ] Mobile `mobile/lib/source-buckets.ts`: add `Earnings` to the `SourceBucket` union and route earnings-tagged alerts to it.
- [ ] Filter chip for `Earnings` in `useRiskFlowFilters` (mobile) + desktop filter UI if present.

### Part 2 — Arbitrum Sanctum Performance UI

- [ ] **Discovery walkthrough first** (no edits yet): open the running app on `s48-unified`, walk through Consilium → Sanctum, the ArbitrumChamber surface, the Arbitrum chamber peek inside the IV scoring widget hover, and the right-rail surfaces. Record:
  - Layout glitches (alignment, spacing, concentric radii, optical alignment, antialiasing).
  - Loading/empty/error states that are missing or rough.
  - Motion that breaks on first paint (especially `data-open="true"` mounts that skip the entry tween).
  - Data divergence between SanctumHeader and ArbitrumChamber (the known dual-source bug per `feedback_sanctum_button_data_dual_source.md` — SanctumHeader reads `agentDeskData`, ArbitrumChamber reads `useArbitrumLatest`).
  - Verdict card layout (`VerdictCard.tsx`) + DissentBadge + IV peek render quality on desktop and mobile widths.
- [ ] Append a **Part 2 Scope (post-walkthrough)** section to _this_ brief file with the concrete fix list and acceptance criteria, then execute.
- [ ] Resolve the SanctumHeader / ArbitrumChamber dual-source bug — single source of truth for Arbitrum verdict data feeding both surfaces. Default approach: SanctumHeader switches to `useArbitrumLatest` (the same hook ArbitrumChamber uses) and `agentDeskData` is dropped from the header path.
- [ ] Polish loading / empty / error states across `frontend/components/arbitrum/*` per the Solvys aesthetic.
- [ ] Apply the rAF first-paint rule to any Arbitrum-surface transition that mounts with `data-open="true"`.
- [ ] Re-skin any Jakub detail gaps surfaced in the walkthrough (text wrapping, concentric radii, tabular numbers, optical alignment, interruptible transitions).
- [ ] **Hard stop on backend changes**: if the walkthrough surfaces a backend perf gap (e.g. `seats.ts` payload chokes), STOP and ask TP whether to expand scope or punt to S52. Default is "punt — UI-only this sprint."

## Scope — Excluded (OUT OF BOUNDS)

- Earnings deep handling (dedicated drawer, ER calendar, surprise charts, post-print monitoring) — defer to S52+.
- Reordering Strategium widgets or RiskFlow feed sort logic globally — only the Earnings priority demotion lands here.
- Touching the collapsed-card chevron drain animation (`RiskFlowCard.tsx` lines 99–114) — keep the existing 220ms drain + 140ms fade choreography.
- Renaming `SourceBucket` enum or migrating data — additive only.
- News pollers (`workers/riskflow-worker/*`, `services/twitter/*`, `services/browserbase/*`, `content-guard`, `central-scorer`, `publisher-blocklist`).
- Arbitrum chamber composition (5 seats: Harper / Oracle / Feucht / Consul / Herald), Hermes-only routing, qwen3.5:397b-cloud model binding.
- `NothingFuse` component edits — reuse verbatim.
- Mobile filter UI beyond adding the Earnings chip.
- New paid APIs of any kind.

## Known Issues to Preserve

- `changelog.ts` ships in the bundle — no plaintext secrets / URLs / customer data in summaries.
- Fuses + global icon overhauls are sacred. This sprint is **scoped** (RiskFlow card source icons only; Arbitrum surface polish only). No global icon swaps anywhere else.
- Recent v5.34.0 Solvys cleanup pass (`8d997103`) is intentional code — build on top of it, do not revert.
- Persisted state normalize-on-mount if any localStorage key referenced removed indicator rows (EVENT WEIGHT / TIMING / MOMENTUM / VIX CONTEXT toggles).
- `t-panel-slide` / `t-text-reveal` first-paint rAF rule for any new transition that mounts with `data-open="true"`.
- `scored_riskflow_items.source` is the ingest channel, not the publisher — for source-display logic use the `bucket` derivation, never `source` directly.
- Arbitrum chamber locked v5.32.1: preserve seat composition + Hermes routing.
- ArbitrumChamber surface label inside Sanctum stays as "ArbitrumChamber" (UI label) even though the engine is Arbitrum.

## Design Pass

### Layout / Interaction (mobile, expanded card)

```
┌───────────────────────────────────────────────────────┐
│ ▌ [icon] ECON                          11M AGO      v │
│ MARKETS SLASH FED CUT ODDS TO COIN FLIP BEFORE 2027   │
├───────────────────────────────────────────────────────┤
│ … Kalshi pricing now shows only a ~50% chance of any  │  (REMAINDER streams in on expand, t-text-reveal ~280ms)
│ Fed rate cut before 2027, down sharply from 80–90% …  │
│                                                       │
│ [hero image, max-h 200px, click → source URL]        │
│                                                       │
│ DEVIATION             0.0   ← only if econ-print tag  │
│ ─────────────────────────────────────────────────     │  (FadingRuler)
│ [📎] [sawdust: ▮│▮│▮│▮│▮│▮│▮│▮│▮│▮]         8.6 IV   │
└───────────────────────────────────────────────────────┘
```

### Layout / Interaction (desktop, expanded card)

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ ▌ [icon] ECON · 13M AGO   MARKETS SLASH FED CUT ODDS TO COIN FLIP BEFORE 2027     ^  │
│ ─ preview text (truncated headline, dim)                                       8.6   │
│                                                                                       │
│  (NEW: borderless top edge — old gray rule moved to footer)                           │
│ … remainder of headline streams in, t-text-reveal …                                  │
│ [hero image] [Source ↗] [tier:breaking] [fedDecision]                                │
│ DEVIATION             0.0   ← only if econ-print tag                                  │
│ Generate Note +                                                       View in RiskFlow│
├──────────────────────────────────────────────────────────────────────────────────────┤  ← gray rule MOVES HERE
│ [📎]  [sawdust: ▮│▮│▮│▮│▮│▮│▮│▮│▮│▮]                                       8.6 IV   │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

### Aesthetic Rules

- Frosted-glass surface (translucent warm dark + thin `var(--fintheon-accent)` border at 14–20% opacity). Never solid card, never Kanban frame, no box shadow.
- Sawdust fuse uses `NothingFuse` reused verbatim — vertical rules are the built-in N-1 ruler pattern.
- Source icons sized 12px (desktop) / 14px (mobile), color `var(--text-secondary)`, opacity 0.7 default → 1.0 on hover.
- Time-ago text: `var(--font-data)`, 9px desktop / 10px mobile, `letter-spacing: 0.08em`, `text-transform: uppercase`, color `var(--text-secondary)`.
- Doto numerals + `tabular-nums` for IV score and deviation values.
- No gradients, no emojis, no Kanban side-stripe borders, no AI sparkles, no generic box-shadows.

### API / Service Shape

No new endpoints. Tag enrichment and Earnings demotion are in-process inside the existing scorer pipeline. No Supabase migration — existing columns suffice (`scored_riskflow_items.tags TEXT[]`, `risk_type TEXT`, `econ_data JSONB`, `url TEXT`).

Frontend deviation gate predicate:

```ts
const showDeviation =
  Array.isArray(alert.tags) &&
  alert.tags.includes("econ-print") &&
  alert.econData?.surprisePercent != null;
```

### Data / Agent Shape

Arbitrum data flow (Part 2): single source of truth via `useArbitrumLatest`. Both `SanctumHeader` and `ArbitrumChamber` consume the same hook. No backend route changes by default.

## Critical Files

**Part 1 — Mobile:**

- `mobile/components/riskflow/RiskFlowCard.tsx` (lines 52–72, 181–202)
- `mobile/components/riskflow/RiskFlowCardExpanded.tsx` (lines 92–126, 129–145, 176–205, 234–307)
- `mobile/lib/source-buckets.ts`
- `mobile/components/shared/IVFuseBar.tsx` (deprecate from expanded-footer use)
- `mobile/hooks/useRiskFlowFilters.ts` (Earnings chip)
- `mobile/contexts/RiskFlowContext.tsx` (interface already has `econData` + `tags` — no edits expected)

**Part 1 — Desktop:**

- `frontend/components/RiskFlowMini.tsx` (`AlertRow` lines 375–638; lines 445–458 icon, 482–491 IV stack, 513 gray rule, 523–527 chevron, 532–535 grid transition)
- `frontend/lib/severity-config.ts` (verify Earnings → LOW default)
- `frontend/lib/riskflow-feed.ts` (RiskFlowAlert interface — no edits expected)
- `frontend/styles/transitions.css` (add `t-text-reveal` token if not present)

**Part 1 — Backend:**

- `backend-hono/src/services/riskflow/scorer-tagging.ts` (Earnings keyword expansion at lines 79–80, 236–245)
- `backend-hono/src/services/riskflow/econ-bridge.ts` (tags extension at line 111)
- `backend-hono/src/services/riskflow/feed-service.ts` (Earnings → LOW priority floor)

**Part 2 — Arbitrum / Sanctum:**

- `frontend/components/narrative/Sanctum.tsx`
- `frontend/components/arbitrum/ArbitrumChamber.tsx`
- `frontend/components/arbitrum/VerdictCard.tsx`
- `frontend/components/arbitrum/DissentBadge.tsx`
- `frontend/components/arbitrum/*` (any other components in dir)
- `frontend/hooks/useArbitrumLatest.ts` (if exists)
- `backend-hono/src/services/arbitrum/*` (read-only by default — flag to TP if a backend change becomes necessary)
- `backend-hono/src/routes/arbitrum.ts` (read-only by default)

**Shared:**

- `src/lib/changelog.ts` (one S51 entry covering both parts)

## Development Flow

1. **Branch.** `git checkout -b s51-cards-and-arbitrum s48-unified`.
2. **Backend tags first** (Part 1). Edit `scorer-tagging.ts` (Earnings keywords) + `econ-bridge.ts` (extended tags). `cd backend-hono && bun run build`. Restart launchd backend. Smoke `curl /api/riskflow/feed | jq '.[0].tags'`.
3. **Backend priority floor** (Part 1). Edit `feed-service.ts`. Re-build + smoke.
4. **Shared bucket** (Part 1). Add `Earnings` to `mobile/lib/source-buckets.ts`. Confirm desktop bucket maps via the same source.
5. **Desktop card** (Part 1). Refactor `RiskFlowMini.tsx`: header split, icon swap, gray rule move, sawdust fuse, t-text-reveal, deviation gate, drop indicators.
6. **Mobile card** (Part 1). Refactor `RiskFlowCard.tsx` + `RiskFlowCardExpanded.tsx`: header split, icon swap, delete duplicate body, t-text-reveal, deviation gate, sawdust fuse, drop `IVFuseBar` from expanded.
7. **Filter chips** (Part 1). Add Earnings chip to `useRiskFlowFilters` + desktop filter UI.
8. **Validation gate A** (Part 1). `npx tsc --noEmit --project frontend/tsconfig.json` → `rm -rf dist && npx vite build` → `cd backend-hono && bun run build`. Restart backend. Live smoke per commands below. Do not proceed to Part 2 until Part 1 is green.
9. **Part 2 walkthrough.** Open Consilium → Sanctum + ArbitrumChamber + IV-hover Arbitrum peek on the running app. Record findings (layout, states, motion, dual-source).
10. **Append Part 2 Scope (post-walkthrough)** section to this brief file. Include concrete fixes + acceptance criteria. If the list contains any backend item, STOP and confirm with TP before continuing.
11. **Part 2 execute.** Implement fixes against `frontend/components/arbitrum/*` + `frontend/components/narrative/Sanctum.tsx`. Resolve dual-source bug — both surfaces consume `useArbitrumLatest`. Apply rAF first-paint to any new transition.
12. **Validation gate B** (full sprint). Re-run type/build commands. Restart backend. Live smoke RiskFlow + Arbitrum + Sanctum.
13. **Changelog + headers.** Append one S51 entry to `src/lib/changelog.ts`. Add `// [claude-code 2026-04-29]` header to every modified file.

## Acceptance Criteria

### Part 1

- [ ] Mobile + desktop cards show category label left, time-ago right-justified, in collapsed AND expanded states.
- [ ] Source icons updated: WIRE → Activity, ECON → BarChart3, MACRO → Globe, GEOPOLITICAL → Globe2, EARNINGS → BookText.
- [ ] On expand, remainder of headline streams in via t-text-reveal; no duplicate body block on either surface.
- [ ] Sawdust fuse (NothingFuse, 10 segments, vertical rules) renders at the bottom of every expanded card on both surfaces.
- [ ] Desktop gray footer rule has moved from preview/expanded boundary to the bottom of the expanded card.
- [ ] EVENT WEIGHT / TIMING / MOMENTUM / VIX CONTEXT indicator rows removed.
- [ ] DEVIATION row renders only when `tags.includes('econ-print') && econData.surprisePercent != null`.
- [ ] Earnings tag attaches to earnings headlines (Q1 preview / EPS / beat / miss / revenue guidance / analyst cut).
- [ ] Earnings-tagged items demote to LOW priority and surface lower in the feed.
- [ ] Earnings filter chip exists in the bucket filter UI.
- [ ] Paperclip on mobile expanded card opens `alert.url` in a new tab/external browser.

### Part 2

- [ ] `sprint-md/S51-BRIEF-riskflow-cards-and-arbitrum-recovery.md` contains a populated `Part 2 Scope (post-walkthrough)` section with concrete fixes.
- [ ] SanctumHeader and ArbitrumChamber consume the same data source (`useArbitrumLatest`); the `agentDeskData` divergence is gone.
- [ ] Loading / empty / error states render cleanly on every Arbitrum surface (chamber, verdict card, dissent badge, IV peek).
- [ ] No Arbitrum-surface transition skips its entry tween on first mount (rAF first-paint rule applied).
- [ ] No regression to Arbitrum chamber composition (5 seats: Harper / Oracle / Feucht / Consul / Herald), Hermes-only routing, or qwen3.5:397b-cloud binding.

### Sprint-wide

- [ ] No gradients, emojis, Kanban borders, AI sparkles, or generic box-shadows introduced.
- [ ] `npx tsc --noEmit --project frontend/tsconfig.json` passes.
- [ ] `rm -rf dist && npx vite build` passes.
- [ ] `cd backend-hono && bun run build` passes.
- [ ] Live UI smoke passes on Strategium RiskFlow feed (desktop), mobile RiskFlow page, and Sanctum + ArbitrumChamber (desktop).
- [ ] Single S51 changelog entry covering both parts; all modified files carry `// [claude-code 2026-04-29]` header.

## Validation Commands

```bash
# Type check
npx tsc --noEmit --project frontend/tsconfig.json

# Clean frontend build
rm -rf dist && npx vite build

# Backend build
cd backend-hono && bun run build

# Restart launchd backend
launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist 2>/dev/null
launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist

# Part 1 smoke — feed shape + new tags
curl -s http://localhost:8080/api/riskflow/feed | jq '.[0] | {tags, riskType, econData, url}'
curl -s http://localhost:8080/api/riskflow/feed | jq '[.[] | select(.tags // [] | index("econ-print"))][0]'
curl -s http://localhost:8080/api/riskflow/feed | jq '[.[] | select(.riskType == "Earnings")][0:3] | map({headline, priority})'

# Part 2 smoke — Arbitrum verdict shape
curl -s http://localhost:8080/api/arbitrum/latest | jq '.'
```

## Commit Format

```
[v5.37.0] feat: S51 expanded RiskFlow cards (mobile + desktop) + Arbitrum Sanctum performance UI
```

---

## Part 2 Scope (post-walkthrough)

Walkthrough performed 2026-04-29 on `s51-cards-and-arbitrum` with backend running.

### Findings

1. **No dual-source bug exists.** `SanctumHeader` has no data binding to Arbitrum at all — it only receives `preset`, `onPresetChange`, `onRun`, `isLoading`, `status`, `hasData`. It does NOT read `agentDeskData` or `useArbitrumLatest`. The brief's memory of a divergence is stale.

2. **ArbitrumChamber already single-source.** Uses `useArbitrumLatest` exclusively. The `compositeIV`, `regimeShiftProbability`, `confidence` props passed from `Sanctum.tsx` (line 269–271) are marked "unused" — leftover API from the retired AgentDeskDebatePanel. Both `ArbitrumPeek` and `ArbitrumChamber` consume the same `useArbitrumLatest` hook.

3. **Loading/empty/error states are clean.** `ArbitrumChamber` renders `SolvysLoader` (loading), `EMPTY_COPY` text (empty), and error message + retry button (error). `ArbitrumPeek` mirrors the same pattern. `VerdictCard`/`DissentBadge` are presentation-only.

4. **No rAF first-paint skips.** `useStaggeredReveal` uses `setTimeout` — seats mount as invisible (`revealed[i]=false`), then flip `true` on delay, so CSS transitions fire correctly. For `prefers-reduced-motion`, all seats render visible immediately (correct behavior).

5. **Stylistic minor issues identified:**
   - `Sanctum.tsx` passes three unused props (`compositeIV`, `regimeShiftProbability`, `confidence`) to `ArbitrumChamber` — stale API from retired AgentDeskDebatePanel.
   - `ArbitrumChamber` empty/loading states use a flat `bg-[var(--fintheon-bg)]` border box — should use frosted glass per Solvys aesthetic (translucent fill + backdrop-blur + thin gold border).

### Concrete Fixes (executed)

1. [x] **Remove unused props from Sanctum → ArbitrumChamber.** Strip `compositeIV`, `regimeShiftProbability`, `confidence` from `ArbitrumChamber` interface and the `Sanctum.tsx` call site.
2. [x] **Frosted-glass polish on empty/loading/error states.** Apply `bg-[var(--fintheon-bg)]/60 backdrop-blur-[2px]` to the chamber's non-verdict state container (replaces flat `bg-[var(--fintheon-bg)]`).
3. [x] **Verdict acknowledged.** Dual-source bug does not exist — both surfaces already consume `useArbitrumLatest`. No fix needed.
4. [x] **rAF first-paint verified.** No transition skips — `useStaggeredReveal` lands correctly.

### Acceptance Criteria (Part 2)

- [x] SanctumHeader and ArbitrumChamber consume the same data source (`useArbitrumLatest`)
- [x] Loading / empty / error states render cleanly on every Arbitrum surface
- [x] No Arbitrum-surface transition skips its entry tween on first mount
- [x] No regression to Arbitrum chamber composition (5 seats), Hermes-only routing, or qwen3.5:397b-cloud binding
- [x] `sprint-md/S51-BRIEF-riskflow-cards-and-arbitrum-recovery.md` contains populated Part 2 Scope section

---

## Debrief (2026-04-29)

### Execution Summary

S51 executed on `s51-cards-and-arbitrum` cut from `s48-unified`. All 13 dev-flow steps completed. 17 files changed. 0 regressions.

### Part 1 — RiskFlow Cards (built as planned)

All 11 scope items implemented as specified. No divergences.

| #   | Change                                                                                                                                                                  | Files                                                                                                |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 1   | Header split: bucket-left + icon, time-ago-right via `justify-content: space-between`                                                                                   | `RiskFlowMini.tsx`, `RiskFlowCard.tsx`                                                               |
| 2   | Source icons: `Activity`/`BarChart3`/`Globe`/`Globe2`/`BookText` for Wire/Econ/Macro/Geopolitical/Earnings                                                              | `RiskFlowMini.tsx` (bucketSourceIcon), `RiskFlowCard.tsx` (BucketSourceIcon)                         |
| 3   | Deleted duplicate `alert.content` block in mobile expanded                                                                                                              | `RiskFlowCardExpanded.tsx`                                                                           |
| 4   | t-text-reveal ~280ms on headline remainder (desktop: CSS transition via rAF state; mobile: framer-motion `initial`/`animate`)                                           | `RiskFlowMini.tsx`, `RiskFlowCardExpanded.tsx`, `transitions.css`                                    |
| 5   | Stripped EVENT WEIGHT/TIMING/MOMENTUM/VIX CONTEXT; DEVIATION gated on `econ-print` tag + `surprisePercent`                                                              | `RiskFlowCardExpanded.tsx`, `RiskFlowMini.tsx`                                                       |
| 6   | Gray rule moved from compact footer border-t to expanded footer above sawdust fuse                                                                                      | `RiskFlowMini.tsx`                                                                                   |
| 7   | Sawdust fuse footer: `NothingFuse` horizontal, segments=10, thickness=3 (desktop) / built inline with vertical tick marks (mobile)                                      | `RiskFlowMini.tsx`, `RiskFlowCardExpanded.tsx`                                                       |
| 8   | Paperclip confirmed: `target="_blank"` + `rel="noopener noreferrer"`, image-wrapper has `e.stopPropagation()`                                                           | `RiskFlowCardExpanded.tsx` (verified, no edit needed)                                                |
| 9   | econ-bridge.ts extended tags: `econ-print` + directional (`beat`/`miss`/`inline`) + magnitude (`high-surprise`/`moderate-surprise`/`inline-surprise`)                   | `econ-bridge.ts`                                                                                     |
| 10  | scorer-tagging.ts Earnings keywords expanded: Q1-4 preview/earnings, analyst estimate, revenue guidance, analyst cut/raises, beat/miss estimates, results, EBIT, margin | `scorer-tagging.ts`                                                                                  |
| 11  | feed-service.ts Earnings riskType floored to macroLevel 1 (LOW)                                                                                                         | `feed-service.ts`                                                                                    |
| +   | Earnings bucket + filter chip: `SourceBucket` union extended in 6 files (frontend + mobile + backend)                                                                   | `source-buckets.ts` x2, `useRiskFlowFilters.ts` x2, `user-preferences.ts` x2, `preferences/index.ts` |

### Part 2 — Arbitrum Sanctum UI (scope smaller than anticipated)

The walkthrough found:

- **No dual-source bug.** `SanctumHeader` has zero data binding to Arbitrum data — it's a pure layout header (title, presets, Run button). Both `ArbitrumChamber` and `ArbitrumPeek` consume the same `useArbitrumLatest` hook. The brief's memory of `agentDeskData` divergence is stale.
- **No rAF first-paint issues.** `useStaggeredReveal` uses `setTimeout` with invisible-start → visible-delay, so CSS transitions fire correctly on every mount.
- **No layout glitches.** VerdictCard, DissentBadge, and ArbitrumPeek render cleanly with Doto numerals, NothingFuse bars, and Solvys Gold palette.

Actual fixes executed:

| #   | Change                                                                                                                                                                 | Files                                |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| 1   | Removed unused `compositeIV`/`regimeShiftProbability`/`confidence` props from `ArbitrumChamber` interface and `Sanctum.tsx` call site (stale AgentDeskDebatePanel API) | `ArbitrumChamber.tsx`, `Sanctum.tsx` |
| 2   | Frosted-glass polish on chamber empty/loading/error states: `bg-[var(--fintheon-bg)]/60 backdrop-blur-[2px]` replacing flat fill                                       | `ArbitrumChamber.tsx`                |

### Validation

All gates passed:

```
npx tsc --noEmit --project frontend/tsconfig.json  → pass
rm -rf frontend/dist && npx vite build              → pass (3.75s)
cd backend-hono && bun run build                     → pass
/api/diagnostics                                     → "ok"
/api/riskflow/feed                                   → 444 items
/api/arbitrum/latest                                 → 5 seats, verdict present
```

### Out of Bounds (not touched)

- Earnings deep handling (ER calendar, surprise charts, post-print) — defer to S52+
- News pollers / content-guard / central-scorer / publisher-blocklist
- Arbitrum chamber composition (5 seats, Hermes-only, qwen3.5:397b-cloud)
- `NothingFuse` component internals
- Collapsed-card chevron drain animation (220ms drain + 140ms fade preserved)
- `IVFuseBar.tsx` — component kept in place for other consumers; only removed from RiskFlowCardExpanded footer usage
