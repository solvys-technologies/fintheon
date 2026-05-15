# Sprint Brief: S62-T24 — Econ Countdown Widget: State Review + Slot Alignment

- **Linear**: SOL-70
- **Parent ORCH**: @sprint-md/S62-ORCH-platform-qa-hygiene.md
- **Branch**: `sprint/S62`
- **Assignee**: Shashank
- **Wave**: 2 (independent — parallel with T22, T25)

## Context

The econ countdown widget (`EconCountdownWidget.tsx`) lives in the top header and surfaces upcoming economic events with a live countdown. It must handle all states gracefully — loading, data-present, empty (no events), and error (API failure). The widget also has a modal variant (`EconCountdownModal.tsx`) that must share the same state logic. Slot alignment in the header must match other header widgets for visual consistency.

## Branch Target

`sprint/S62`

## Scope — Included

- [ ] `frontend/components/layout/EconCountdownWidget.tsx` — state review
  - Loading state (spinner/skeleton while fetching events)
  - Data state (countdown renders, updates in real-time)
  - Empty state (no upcoming events — graceful empty, not a crash)
  - Error state (API failure — graceful error, not a white screen)
- [ ] `frontend/components/feed/EconCountdownModal.tsx` — verify same state logic as widget
- [ ] `frontend/components/layout/TopHeader.tsx` — slot alignment check (widget slot matches other header widgets)
- [ ] `frontend/components/layout/MainLayout.tsx` — layout context verification
- [ ] `frontend/components/narrative/SanctumOpsChips.tsx` — ops chips that may reference countdown data
- [ ] `frontend/components/feed/RiskFlowMain.tsx` — RiskFlow feed (if it renders countdown data)
- [ ] `frontend/components/SignalFeed.tsx` — Signal feed (if it renders countdown data)
- [ ] `frontend/hooks/useFloatingDrag.ts` — drag hook used by the widget for positioning

## Scope — Excluded (DO NOT TOUCH)

- Countdown data fetching logic — verify presence, don't rewrite the fetch
- Backend econ event endpoints — frontend-only review
- New features (sound alerts, notifications, etc.) — audit only
- Econ countdown animations — handled in S62-T22 (SOL-68)

## State Checklist

For each state in `EconCountdownWidget.tsx`, verify:

| State | Expected Behavior | Check |
|-------|------------------|-------|
| Loading | Skeleton/spinner visible while fetching | [ ] |
| Data | Live countdown timer, event name, time remaining | [ ] |
| Empty | Graceful "no upcoming events" message | [ ] |
| Error | Error message with retry affordance | [ ] |
| Data → Empty | Clean transition when last event expires | [ ] |
| Empty → Data | Widget re-renders when new events arrive | [ ] |

## Slot Alignment Checklist

Verify the widget slot in `TopHeader.tsx`:

- [ ] Vertical alignment matches adjacent header widgets
- [ ] Padding/spacing consistent with header slot pattern
- [ ] No overflow or clipping at narrow viewport widths
- [ ] Widget respects header z-index (doesn't overlap drawer/modals)

## Solvys Feels — Aesthetic Rules

- **Widget card**: frosted-glass surface (`bg-[var(--fintheon-bg)]/80 backdrop-blur-md`)
- **Border**: thin accent border (`border-[var(--fintheon-accent)]/15`)
- **Countdown digits**: tabular numbers (monospace for ticking)
- **Accent**: Solvys Gold (`#c79f4a`) for time-critical events (< 5 minutes)
- **No**: gradients, emojis, AI sparkles, Kanban borders

## Acceptance Criteria

- [ ] Widget renders in header with all states covered
- [ ] Loading state shows skeleton/spinner
- [ ] Data state shows live countdown
- [ ] Empty state shows graceful message (no crash)
- [ ] Error state shows error with retry
- [ ] Countdown updates correctly in real-time (no drift)
- [ ] Modal variant (`EconCountdownModal.tsx`) shares same state logic
- [ ] Slot alignment matches other header widgets
- [ ] `npx tsc --noEmit --project frontend/tsconfig.json` passes
- [ ] `npx vite build` passes
- [ ] No console errors during state transitions

## Validation Commands

```bash
# Type check
npx tsc --noEmit --project frontend/tsconfig.json

# Frontend build
rm -rf dist && npx vite build

# Check widget file size and state coverage
wc -l frontend/components/layout/EconCountdownWidget.tsx
wc -l frontend/components/feed/EconCountdownModal.tsx
```

## Commit Format

```
[v.6.0.27-s62-t24] fix: econ countdown widget — state review, slot alignment, edge cases
```
