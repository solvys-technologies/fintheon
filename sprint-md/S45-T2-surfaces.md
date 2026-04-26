# Sprint Brief: S45-T2 — Day Card Surfaces

## Context

T2 owns every user-visible surface for the S45 Day Card / Desk Drift / Plan Feedback feature. The Day Card lives under Volatility Read in Sanctum. Strategium's StickyBulletin gets a 5th tab "Day Card" with Mon–Fri preview pills (no expansion — tap scrolls to Sanctum DayCard). Mobile's bulletin gets a parity 5th tab. The trading journal entry composer gets a `PlanFeedbackBlock` for each window per day (Followed / Faded / Sat-out triad + reason chips). The Strategium header gets a `DriftIndicator` pill (3 visual states). A `StreakBadge` (Doto numeral, gold pulse on milestone) appears on the Day Card. The whole feature uses a **fading-ruler-line** primitive instead of borders — this is the singular visual character of S45. T1 ships the backend in parallel; this brief stays out of `backend-hono/**` and `supabase/**` entirely.

## Branch Target

`s45-day-card` (shared with T1)

## Scope — Included

- [ ] **NEW** `frontend/components/shared/FadingRuler.tsx` — visual primitive (horizontal + vertical variants), the ONLY divider used on new surfaces
- [ ] **NEW** `frontend/styles/fading-ruler.css` (or Tailwind utility class — pick the project's idiom)
- [ ] **NEW** `frontend/components/narrative/DayCard.tsx` — Sanctum surface, lays out Desk Theme + data table + streak/drift footer
- [ ] **NEW** `frontend/components/strategium/DayCardBulletinTab.tsx` — Mon–Fri preview pills, no expansion, tap = scroll-to-Sanctum-DayCard
- [ ] **NEW** `frontend/components/strategium/DriftIndicator.tsx` — header pill, 4 states (in-window / drift-alert / tilt-stop / dead-volume)
- [ ] **NEW** `frontend/components/streak/StreakBadge.tsx` — Doto numeral + gold pulse on milestones 5/10/21/50
- [ ] **NEW** `frontend/components/journal/PlanFeedbackBlock.tsx` — 3-segment NothingFuse triad, right-stacked chevron when Faded selected, reason-chip dropdown
- [ ] **NEW** `frontend/hooks/useDayPlan.ts` — `GET /api/day-plan/today`, 60s poll
- [ ] **NEW** `frontend/hooks/useDayPlanWeek.ts` — `GET /api/day-plan/week`, mount + 5min refresh
- [ ] **NEW** `frontend/hooks/useDriftStatus.ts` — `GET /api/day-plan/drift-status`, 60s poll
- [ ] **NEW** `frontend/hooks/useStreak.ts` — `GET /api/day-plan/streak`, mount + 5min refresh
- [ ] **NEW** `frontend/hooks/usePlanFeedback.ts` — `POST /api/day-plan/feedback`, returns `{submit, isSubmitting}`
- [ ] **NEW** `frontend/types/day-plan.ts` — mirrors `backend-hono/src/types/day-plan.ts` from T1 (orchestrator validates parity at unification)
- [ ] **NEW** `mobile/components/bulletin/MobileBulletinDayCard.tsx` — parity tab, mobile-token aware
- [ ] **NEW** `mobile/types/day-plan.ts` — mirrors backend types
- [ ] **EDIT** `frontend/components/narrative/Sanctum.tsx` — insert `<DayCard />` at line 256 (after `<NextSessionForecastCard />`)
- [ ] **EDIT** `frontend/components/StickyBulletin.tsx` — add 5th SECTION `{ id: "daycard", icon: TrendingUp, label: "Day Card" }`; conditional render block when `b.activeSection === "daycard"`
- [ ] **EDIT** `mobile/components/bulletin/MobileBulletin.tsx` — parity 5th tab
- [ ] **EDIT** the journal entry composer (search `frontend/components/journal/` for the entry component — likely `JournalEntry.tsx` or `EntryComposer.tsx`) — wire `<PlanFeedbackBlock />` once per window per day
- [ ] **EDIT** `src/lib/changelog.ts` — append T2 entry

## Scope — Excluded (DO NOT TOUCH)

- All of `backend-hono/**`
- All of `supabase/migrations/**`
- `backend-hono/src/services/day-plan/*` (T1 owns)
- `backend-hono/src/services/desk-drift/*` (T1 owns)

## Reuse Inventory (existing code to call, not reinvent)

- `frontend/components/narrative/Sanctum.tsx:256` — exact insertion point after `<NextSessionForecastCard />`. Insert `<DayCard />` as a sibling.
- `frontend/components/StickyBulletin.tsx:30–35` — SECTIONS array literal. Append the 5th entry. Add the conditional render block in the same pattern as the existing 4 (search "activeSection ===" for the pattern).
- `frontend/hooks/useStickyBulletin.ts` — section state hook. Already returns `{activeSection, setActiveSection}` pattern; the 5th tab uses it natively.
- `frontend/components/narrative/useIVScoreData.ts` — **template** for 60s polling hooks. Mirror the structure for `useDayPlan`, `useDriftStatus`, `useStreak`.
- `frontend/components/narrative/BlendedVIXCard.tsx` — sibling card in the Volatility Read column. Match its surface treatment (panel sizing, spacing, type scale).
- `frontend/components/narrative/NextSessionForecastCard.tsx` — sibling above DayCard's insertion point. Match its label hierarchy.
- **RiskFlowCard mobile anatomy spec** (in agent memory: `feedback_riskflow_card_anatomy.md`) — Doto numeral + segmented NothingFuse + right-stacked chevron. Apply to:
  - DayCard data table (right-justified Doto values)
  - StreakBadge (Doto count)
  - PlanFeedbackBlock triad (3-segment NothingFuse + right-stacked chevron when Faded)
- `frontend/components/IVStack.tsx` (or wherever the IV stack primitive lives) — reuse for any IV display in the bulletin preview pills.
- `mobile/components/bulletin/MobileBulletin.tsx` — current 4-tab layout. Add a 5th in the same style; respect mobile token system (memory: `feedback_riskflow_card_anatomy.md` notes mobile keeps its own inline copy due to token system divergence — same applies here).
- `frontend/components/Doto*.tsx` — find the Doto numeral primitive. Reuse for streak count + price values + IV scores in preview pills.
- **`solvys-transitions` skill** — use `t-badge` for the streak milestone pulse, `t-modal` if PlanFeedbackBlock ever opens as a sheet.

## Known Issues to Preserve

- The `frontend/components/StickyBulletin.tsx` component currently uses 4 SECTIONS. **Memory pin** (`feedback_strategium_maximize_button_dead.md`): never re-add the Maximize2 / fullscreen toggle. The 5th tab must NOT introduce one.
- **Memory pin** (`feedback_no_glass_effects.md`): no `backdrop-blur`, no `box-shadow`. Use flat surfaces + (in this sprint) the new fading ruler primitive — NOT borders.
- **Memory pin** (`feedback_send_button_style.md`): if any submit button appears in PlanFeedbackBlock, it must be a circular ArrowUp button, never a paper-airplane / Send icon.
- Recent S43/S44 changelog entries reflect intentional Refinement Glass Gate work — do not "clean up" anything in `RefinementGlassGate.tsx` or adjacent.
- **Memory pin** (`feedback_persisted_state_normalize_on_mount.md`): if `useStickyBulletin` reads localStorage for the active section and the saved value is a now-removed mode, normalize on mount. Adding the 5th tab does NOT remove any existing tab, so this is informational only.

## Implementation Steps

1. **Type mirror first.** Wait for T1 to publish `backend-hono/src/types/day-plan.ts` (post commits will broadcast it). Mirror to `frontend/types/day-plan.ts` and `mobile/types/day-plan.ts`. Keep all field names, types, and unions identical.
2. **FadingRuler primitive.** `FadingRuler.tsx` props: `{ orientation?: 'horizontal' | 'vertical', className?: string }`. CSS:
   ```css
   .fading-ruler {
     width: 100%;
     height: 1px;
     background: linear-gradient(
       to right,
       transparent 0%,
       rgba(199, 159, 74, 0) 5%,
       rgba(199, 159, 74, 0.35) 50%,
       rgba(199, 159, 74, 0) 95%,
       transparent 100%
     );
     border: none;
   }
   .fading-ruler--vertical {
     width: 1px;
     height: 100%;
     background: linear-gradient(
       to bottom,
       transparent 0%,
       rgba(199, 159, 74, 0) 5%,
       rgba(199, 159, 74, 0.35) 50%,
       rgba(199, 159, 74, 0) 95%,
       transparent 100%
     );
   }
   ```
   The gradient stops (transparent → low-opacity gold → transparent) are intentional — this is a divider, not a fill, so the no-gradients rule is honored. Only export this; replace every place a glass-surface border would have lived.
3. **Hooks.** Mirror `useIVScoreData.ts` shape. Each hook returns `{ data, isLoading, error }`. Polling intervals as specified above.
4. **DayCard.tsx layout** (under Volatility Read):

   ```
   Desk Theme
   {1-line message tying idea to brief catalyst}

   ── fading ruler ──

   Event:                              {Event name or "—"}
   Trading Window:                     {HH:MM-HH:MM}
   Prices of Interest:           {25580.00, 25660.00}    (right-justified, Doto)
   Invalidation Point:                  {25420.00}
   Profit Target:                       {25920.00}
   Expected Move:                       {± 0.84%}

   ── fading ruler ──

   Streak  [Doto: 7]    Drift  ◯ in-window
   ```

   Container: NO border. Glass panel background OK. Titles left-justified, values right-justified, monospace gutter (use `font-mono` or repo's monospace token). Two prices max, one target.

5. **DayCardBulletinTab.tsx** (Strategium, desktop):
   - 5 rows Mon–Fri
   - Each row: `[DAY label]  [IV score in Doto]  [N windows]  [event name truncated]`
   - Tap row → `document.getElementById('day-card-anchor')?.scrollIntoView({ behavior: 'smooth' })` (anchor ID set on DayCard root)
   - NO expansion, NO modal, NO inline detail
   - Dividers between rows = FadingRuler
6. **DriftIndicator.tsx** in Strategium header:
   - Visual states (6px dot):
     - In-window: `rgba(240, 234, 214, 0.3)`, no animation
     - Drift Alert: `rgba(199, 159, 74, 0.85)`, no animation
     - Tilt-stop: `rgba(220, 80, 80, 0.95)`, slow pulse
     - Dead Volume Warning: `rgba(199, 159, 74, 0.95)`, slow pulse
   - Reads from `useDriftStatus()`. Tooltip shows the message text.
7. **StreakBadge.tsx**:
   - Doto numeral, size matches existing IV stack numeral
   - Gold pulse animation on milestone crossings (5, 10, 21, 50). Use `solvys-transitions` `t-badge` if available, else CSS keyframes.
8. **PlanFeedbackBlock.tsx**:
   - 3-segment NothingFuse: `[Followed | Faded | Sat-out]`
   - When Faded selected, right-stacked chevron expands a reason-chip row: `Better setup elsewhere | Plan felt wrong | News override | Tilt | FOMO | Risk-off | Other`
   - Free-text "why" only when Tilt/FOMO selected (lightweight — single `<input>`)
   - Submit button: circular ArrowUp (memory pin)
   - Calls `usePlanFeedback().submit({ window_id, action, reason_code, reason_text })`
9. **Sanctum.tsx edit** at line 256: insert `<DayCard id="day-card-anchor" />` immediately after `<NextSessionForecastCard />`. Verify it lands in the non-chart-mode left 55% Volatility Read column.
10. **StickyBulletin.tsx edit** lines 30–35: append `{ id: "daycard" as const, icon: TrendingUp, label: "Day Card" }` to SECTIONS. Then add a conditional render block matching existing 4: `{b.activeSection === "daycard" && <DayCardBulletinTab />}`.
11. **MobileBulletin.tsx edit**: same pattern as desktop, but render `<MobileBulletinDayCard />` (mobile-token-aware copy of DayCardBulletinTab).
12. **Journal entry composer edit**: locate the entry-composer component in `frontend/components/journal/`. For each window in today's day_plan (from `useDayPlan`), render `<PlanFeedbackBlock window={w} />`. One block per window, divided by FadingRuler.
13. **Changelog entry.** Append:
    ```ts
    { date: '2026-04-26THH:mm:ss', agent: 'claude-code', summary: 'S45-T2: DayCard + Strategium daycard tab + mobile parity + journal PlanFeedbackBlock + DriftIndicator + StreakBadge + FadingRuler primitive', files: ['frontend/components/narrative/DayCard.tsx', 'frontend/components/strategium/*', 'frontend/components/streak/*', 'frontend/components/journal/PlanFeedbackBlock.tsx', 'frontend/components/shared/FadingRuler.tsx', 'frontend/components/narrative/Sanctum.tsx', 'frontend/components/StickyBulletin.tsx', 'mobile/components/bulletin/*'] }
    ```

## Acceptance Criteria

- [ ] DayCard renders under Volatility Read in Sanctum (non-chart-mode), shows all 7 lines (Desk Theme + 6 data lines)
- [ ] StickyBulletin has 5th tab "Day Card"; tap a Mon–Fri pill scrolls Sanctum DayCard into view; no expansion, no inline detail
- [ ] MobileBulletin has parity 5th tab using mobile token system
- [ ] DriftIndicator pill in Strategium header reflects 4 states correctly via `useDriftStatus`
- [ ] StreakBadge shows current streak in Doto; milestone pulse fires at 5/10/21/50
- [ ] PlanFeedbackBlock renders inside journal entry composer once per window; Followed/Faded/Sat-out triad + reason chips work; circular ArrowUp submit
- [ ] FadingRuler is the ONLY divider on new surfaces — no glass borders, no kanban borders, no card-outlines anywhere
- [ ] `npx tsc --noEmit --project frontend/tsconfig.json` clean
- [ ] `cd mobile && npx tsc --noEmit` clean
- [ ] `cd frontend && rm -rf dist && npx vite build` clean
- [ ] `cd mobile && rm -rf dist && npx vite build` clean
- [ ] Browser Harness Playwright pass on staging

## Validation Commands

```bash
# Type check
npx tsc --noEmit --project frontend/tsconfig.json
cd mobile && npx tsc --noEmit

# Frontend build
cd frontend && rm -rf dist && npx vite build

# Mobile build (CRITICAL: rm -rf dist first — memory pin feedback_clean_rebuild_mobile)
cd mobile && rm -rf dist && npx vite build

# Browser Harness (smoke)
# Open Sanctum on staging, verify DayCard renders, tap Strategium Day Card tab,
# verify Mon-Fri pills, tap a pill, verify scroll-to-DayCard, open journal,
# verify PlanFeedbackBlock, toggle Followed/Faded/Sat-out, submit a feedback row.
```

## Commit Format

```
[v5.31.0] feat: S45-T2 DayCard surface + Strategium tab + mobile parity + journal PlanFeedbackBlock + DriftIndicator + StreakBadge + FadingRuler
```

## Banned ornaments

No kanban borders. No gradients-as-fills (the FadingRuler IS a divider, not a fill). No emojis. No AI sparkles. No card-outlines on the new surfaces. Solvys palette only: BG `#050402`, Accent `#c79f4a`, Text `#f0ead6`. Glass surface treatment is OK for the panel BG; just no enclosing border.

## Open Questions (non-blocking)

- Journal entry composer file name — recon left this open. Search `frontend/components/journal/` for the entry-composer; if structure differs, adapt the wire-up at step 12.
- Doto primitive location — locate the Doto numeral component; if it lives somewhere unexpected, the import path adjusts but the spec doesn't.
- Mobile token system divergence — if mobile lacks a fading-ruler equivalent, write a mobile-specific copy in `mobile/components/shared/`.
