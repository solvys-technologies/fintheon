# Task Brief: Dashboard Dispatch/Calendar Frame — Increase Min Height
**Date:** 2026-04-03
**Scope:** Increase the min-height of the Dispatch + Session Calendar row on the Dashboard so it doesn't shrink when content loads
**Estimated files:** 1

## Context
On the MainDashboard (Page 1 / Briefing), the top row contains the Dusk Dispatch (left, 55%) and Session Calendar (right, 45%). When news items load below in the RiskFlow section, the Dispatch/Calendar frame shrinks to a visually uncomfortable height. The current `min-h-[420px]` is too low — needs to be taller to remain readable even when RiskFlow items push up.

## Files to Read First
- `frontend/components/executive/MainDashboard.tsx:245` — The line with `min-h-[420px]` that controls the Dispatch/Calendar frame height.
- Read lines 236-311 for full context of the Briefing + Calendar row layout.

## What to Change

### `frontend/components/executive/MainDashboard.tsx`
- **Action:** Modify
- **Line 245:** Change `min-h-[420px]` to `min-h-[520px]` on the flex container that holds Dispatch + Calendar.
  ```
  Before: <div className="flex-1 min-h-[420px] flex mt-2">
  After:  <div className="flex-1 min-h-[520px] flex mt-2">
  ```

## Key Rules
- This is a single-line change. The 100px increase gives breathing room without making the frame dominate the viewport.
- The page is vertically scrollable (`snap-start` scroll snap), so a taller frame won't clip — it just means less RiskFlow visible without scrolling.
- If 520px still feels too short after testing, 560px is the next reasonable step — but don't go above 600px as it would push KPIs and RiskFlow too far down.

## DO NOT
- Change any other layout, component, or section
- Modify the Calendar or Dispatch internal components
- Add responsive breakpoints (the whole dashboard is desktop-only)

## Verification
```bash
cd frontend && npx vite build
```
Visually confirm on Dashboard that the Dispatch/Calendar row maintains a comfortable height even when 10+ RiskFlow items are loaded below.

## Changelog Entry
```typescript
{
  date: '2026-04-03T00:00:00',
  agent: 'claude-code',
  summary: 'Increase Dispatch/Calendar frame min-height from 420px to 520px to prevent cramped layout when RiskFlow loads',
  files: ['frontend/components/executive/MainDashboard.tsx']
}
```
