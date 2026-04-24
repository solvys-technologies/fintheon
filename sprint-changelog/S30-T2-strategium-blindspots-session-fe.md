# Sprint Brief: S30-T2 — Strategium Widget Swap + Blindspots Promotion + Session Consolidation (Frontend)

## Context

Sprint 1 of the S30/S31/S32 Super Sprint. This track reshapes three areas at once:

1. **Strategium right panel**: remove the `BlindspotsWidget` and replace it with a new `WeeklyPerformanceWidget` that shows a per-day readout of the user's selected instrument (TopStepX header dropdown).
2. **Performance tab Blindspots**: promote the current inline Blindspots card into a full-width **before/after row** (current blindspots on the left, corrective actions on the right).
3. **Session consolidation**: collapse the 3 session cards (Infractions Today, Discipline Score, Emotional Control) + the Hermes Summary card + the Your Notes card into ONE dense `SessionJournalPanel` subsection. All sliders scale on **0.0–10.0** (decimal), not 0–100. Submit button persists everything via T3's backend.

## Branch Target

`s30-performance`

## Scope — Included

- [ ] **Strategium widget swap** in `frontend/components/layout/MainLayout.tsx`:
  - Remove `BlindspotsWidget` from the widget config/deck
  - Add `WeeklyPerformanceWidget` in its slot (top-half of Strategium)
- [ ] **Delete** `frontend/components/mission-control/BlindspotsWidget.tsx` (174 lines)
- [ ] **New component** `frontend/components/mission-control/WeeklyPerformanceWidget.tsx`:
  - One row per weekday (Mon–Fri of current week)
  - Columns: day label (left) · instrument point delta (center) · % change (right-justified)
  - Instrument = the header's TopStepX dropdown value (lift from existing context; if none exists, read from `SettingsContext.topstepxInstrument` or equivalent and fall back to `"MNQ"`)
  - Each row has a chevron on the far right; clicking expands the row inline to show:
    - `IVStack` (reuse `frontend/components/shared/IVStack.tsx`) with that day's IV score
    - 1-line summary (pulled from `scored_riskflow_items` top item for that date, or a stub if none)
    - 2-3 brief metrics: session high/low for the instrument, largest trade P&L, trade count
  - No glass effects, no gradients — thin accent border + BG `#050402`
  - File under 300 lines
- [ ] **New component** `frontend/components/journal/BlindspotsRow.tsx`:
  - Full-width row on Performance tab (sits below KPI row, above SessionJournalPanel)
  - 2-column grid: left card "Current Blindspots", right card "Corrective Actions"
  - Data sources (ok to stub for now; the wiring is T3's): reads from an exported `useBlindspots()` hook that returns `{ blindspots: string[], corrections: string[], updatedAt }` — implement the hook with a local stub array until a backend source lands
  - Title row with an info tooltip explaining the before/after semantics
- [ ] **New component** `frontend/components/journal/SessionJournalPanel.tsx`:
  - Replaces the existing 3-card layout for Session + the separate Hermes Summary card + the Your Notes card
  - One dense panel with:
    - Infractions Today (integer counter + "+" button)
    - Discipline Score slider (0.0–10.0, step 0.1)
    - Emotional Control slider (0.0–10.0, step 0.1, labels "Tilted ↔ Composed")
    - Hermes Summary (read-only, populated by T3's Routine; shows "No session data yet." placeholder until it lands)
    - Your Notes textarea (multi-line, placeholder "Observations, reflections, lessons learned…")
    - Single **Submit** button that `PUT`s to `/api/session-journal` (T3 endpoint)
  - On mount, `GET /api/session-journal?date=today` and pre-fill fields (no-op + empty form if 404)
  - Debounce: do NOT auto-save — require explicit Submit click (matches existing UX)
  - File under 300 lines — extract sub-pieces into local components if needed
- [ ] Edit `frontend/components/journal/HumanPsychTab.tsx`:
  - Remove `SessionNotesPanel` import + usage
  - If `SessionNotesPanel` is not used elsewhere, delete the file too (grep first)
- [ ] Edit `frontend/components/journal/PerformanceJournal.tsx`:
  - Insert `<BlindspotsRow />` as its own full-width row below KPIs (T1 will have moved KPIs there)
  - Insert `<SessionJournalPanel />` where the 3 session cards currently live
  - Remove the now-orphaned inline Blindspots JSX (lines ~341-374) — but coordinate with T1 if they already removed it as part of the top-row flip
- [ ] Add type `SessionJournal` in `shared/index.ts` (append only):
  - `{ id, userId, date (YYYY-MM-DD), infractions, disciplineScore, emotionalControl, hermesSummary, notes, createdAt, updatedAt }`
- [ ] Changelog entry + per-file header comments

## Scope — Excluded (DO NOT TOUCH)

- `frontend/components/journal/performance/TradeActivityHeatmap.tsx` — T1
- `frontend/components/journal/performance/SPYDailyHeatmap.tsx` — T1
- `frontend/lib/trade-colors.ts` / `frontend/lib/user-preferences.ts` — T1
- `frontend/components/journal/TradingCalendar/**` — T4
- `frontend/components/journal/DayDetailModal.tsx` — T4
- All `backend-hono/**` — T3/T4
- Do NOT implement the backend endpoint for session-journal; assume T3 ships it

## Known Issues to Preserve

- Scores were historically in 0–100 in some legacy UI. TP has locked the new scale as **0.0–10.0 decimal**. Sliders must reflect this.
- `SessionNotesPanel` exists in `HumanPsychTab.tsx` (309 lines total). Migrate carefully — if any logic inside it is reused elsewhere (grep for imports), preserve the reusable pieces in a shared location instead of inline deletion.
- S29 recent changelog (2026-04-22) includes CatalystSlideOut and chat modernization — don't revert any of that.

## Implementation Steps

1. Grep `SessionNotesPanel` usage repo-wide. Confirm `HumanPsychTab.tsx` is the only consumer.
2. Grep `BlindspotsWidget` usage repo-wide. Confirm `MainLayout.tsx` (or `MissionControlContent.tsx`) is the only mount site.
3. Read `MainLayout.tsx` to learn the widget-deck config pattern. Mirror that for `WeeklyPerformanceWidget`.
4. Build `WeeklyPerformanceWidget.tsx`:
   - Derive Mon–Fri of current week
   - Fetch per-day instrument OHLC from existing `yahoo-market.ts` quote service via a frontend hook (grep for existing useQuote / useInstrument hooks)
   - Render rows + chevron expansion state
5. Build `BlindspotsRow.tsx` with the local stubbed hook.
6. Build `SessionJournalPanel.tsx` with all 5 fields + Submit wiring to `PUT /api/session-journal`.
7. Insert both new panels into `PerformanceJournal.tsx`. Leave a clear comment `// T2: session panel here`, `// T2: blindspots row here`.
8. Delete `BlindspotsWidget.tsx` and remove its config entry in `MainLayout.tsx`.
9. Remove `SessionNotesPanel` usage from `HumanPsychTab.tsx`; delete the component file if unused.
10. Append `SessionJournal` type to `shared/index.ts`.
11. Changelog + file headers.

## Acceptance Criteria

- [ ] Strategium right panel no longer shows a Blindspots card
- [ ] `WeeklyPerformanceWidget` visible in Strategium top-half, renders 5 rows, chevron expands inline
- [ ] Performance tab shows a full-width Blindspots row with 2-column before/after layout
- [ ] Session area is ONE consolidated panel, not 3 cards — Hermes + Notes live inside it
- [ ] Sliders show values like `7.3 / 10.0`, not `73 / 100`
- [ ] Submit button sends `PUT /api/session-journal` (network tab confirms) and reload repopulates
- [ ] `BlindspotsWidget.tsx` is deleted
- [ ] All new files are under 300 lines
- [ ] `tsc --noEmit` + `vite build` pass
- [ ] Changelog entry added

## Validation Commands

```bash
# Type check
npx tsc --noEmit --project frontend/tsconfig.json

# Clean build
rm -rf dist && npx vite build

# Confirm deleted files
test ! -f frontend/components/mission-control/BlindspotsWidget.tsx && echo "BlindspotsWidget deleted OK"

# Confirm new files
wc -l frontend/components/mission-control/WeeklyPerformanceWidget.tsx \
      frontend/components/journal/BlindspotsRow.tsx \
      frontend/components/journal/SessionJournalPanel.tsx

# Verify session-journal API call in built bundle
grep -r "/api/session-journal" frontend/ | head -5
```

## Commit Format

```
[v5.22.10W] feat: S30-T2 strategium widget swap + blindspots promotion + session consolidation
```
