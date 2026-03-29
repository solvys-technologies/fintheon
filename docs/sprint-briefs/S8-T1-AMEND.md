# S8-T1 AMENDMENT: Remaining Bug Fixes

**Branch**: `v.8.28.1`
**Context**: T1 is 68% done. These items were skipped or half-done.

## FILES TO READ FIRST
- `frontend/components/ui/KanbanTitle.tsx` — still has border classes
- `frontend/components/narrative/NarrativeForceCanvas.tsx` — keyboard zoom handler (~line 657)
- `frontend/components/narrative/CategoryScoreCard.tsx` — check for border-l-2
- `frontend/components/narrative/SanctumBriefing.tsx` — check for border-l-2
- `frontend/components/chat/FintheonThread.tsx` — check for border-l-2
- `frontend/components/settings/ClawnalystDesk.tsx` — check for border-l-2

## FIXES

### 1. Kill ALL Kanban Borders (NOT DONE)
Grep the entire frontend for `border-l-2` and `border-l-4`:
```bash
grep -rn "border-l-2\|border-l-4" frontend/components/ --include="*.tsx"
```
For EACH result:
- If it's a kanban-style left accent border → replace with `border` (all sides) or remove entirely
- Components to check: KanbanTitle, CategoryScoreCard, SanctumBriefing, FintheonThread, CommandmentsSidebar, RegimeCard, RiskFlowDetailCard, PersonaDropdown, ReasoningPart
- KanbanTitle.tsx: strip the `border-` classes from TONE_CLASSES. Replace with flat heading (text only, no bordered container)
- DO NOT touch RiskFlowPanel AlertRow borders (those are card borders, not kanban)

### 2. Fix Keyboard Zoom (PARTIAL)
In `NarrativeForceCanvas.tsx` around line 657:
- Current: listens for bare `=` and `-` keys
- Fix: add `e.metaKey || e.ctrlKey` check so it responds to Cmd+= and Cmd+-
- Keep `e.preventDefault()` to stop browser zoom

```typescript
if ((e.metaKey || e.ctrlKey) && (e.key === '=' || e.key === '+')) {
  e.preventDefault();
  reactFlow.zoomIn({ duration: 200 });
} else if ((e.metaKey || e.ctrlKey) && e.key === '-') {
  e.preventDefault();
  reactFlow.zoomOut({ duration: 200 });
}
```

### 3. Remove MiniMap White Square (NOT DONE)
Check NarrativeForceCanvas.tsx for any `<MiniMap` or `<Controls` from @xyflow/react. Remove both the component and import. If there's a white square in the top-right corner, find what renders it and remove.

### 4. Install Impeccable (NOT DONE)
```bash
npx skills add pbakaus/impeccable
```
Run this from the project root. If it fails, skip — it's nice-to-have.

## VERIFICATION
1. `grep -rn "border-l-2\|border-l-4" frontend/components/ --include="*.tsx"` returns 0 results (or only intentional card borders)
2. Cmd+= and Cmd+- zoom the canvas
3. No white square/MiniMap on the Observatory
4. `npx vite build` — clean

## DO NOT
- Do NOT touch force layout, rope engine, or card rendering
- Do NOT modify backend code
- Do NOT add new components
