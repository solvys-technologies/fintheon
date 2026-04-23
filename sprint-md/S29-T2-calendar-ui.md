# Sprint Brief: S29-T2 — Calendar UI + Performance Tab Refactor

## Context

The Performance tab (bottom-right of Fintheon) is getting a **Trading Calendar heatmap** — a monthly grid view of P&L, modeled on ProjectX's native calendar. You build two visual variants of the same data (ProjectX-clone and Solvys-aesthetic), plus a segmented view-selector on the Performance tab. You also **split the existing `AgentPerformanceTab.tsx` (474 lines)** because it violates our 300-line-per-file rule and is about to gain a lot more surface area.

You are working in **parallel** with three other Claude Desktop windows (T1 data layer, T3 chat modernize, T4 catalyst panel). **Do NOT touch** any backend files, any chat UI, or the catalyst slide-out.

## Branch Target

`feat/s29-t2-calendar-W`

Create from `main`:

```bash
cd /Users/freethefranks/Documents/Fintheon
git checkout main && git pull
git checkout -b feat/s29-t2-calendar-W
```

## Scope — Included

- [ ] **Split `frontend/components/journal/AgentPerformanceTab.tsx`** (474 lines) into sub-components, each ≤300 lines
- [ ] Add segmented control at the top of `PerformanceJournal.tsx`: **Dashboard | Calendar**
- [ ] New directory: `frontend/components/journal/TradingCalendar/` with:
  - `index.tsx` — container, manages view-variant + granularity state
  - `ProjectXCalendar.tsx` — ProjectX-clone view
  - `SolvysCalendar.tsx` — Solvys-aesthetic view
  - `CalendarCell.tsx` — shared day-cell primitive
  - `WeekTotalCell.tsx` — right-column weekly total
  - `CalendarNav.tsx` — month navigation + "Today" button
  - `CalendarControls.tsx` — Agentic/Human toggle + day/week/month pill tabs
  - `EquityCurveDrawer.tsx` — shadcn Line chart expanded view on cell click
  - `hooks/useTradeCalendarData.ts` — fetch + aggregate from T1's API
  - `types.ts` — shared types (CalendarSelection, CalendarTrade, etc.)
- [ ] Wire cell-click → emit `CalendarSelection` that filters existing KPI cards
- [ ] Append changelog entry

## Scope — Excluded (DO NOT TOUCH)

- Anything under `backend-hono/` (T1 owns)
- `frontend/components/chat/**` (T3 owns)
- `frontend/components/journal/CatalystSlideOut/` (T4 creates this; you integrate via prop contract at unification)
- Do NOT modify `useChatWithAuth.ts` or any chat hooks

## Known Issues to Preserve

- **300-line rule** — every file you create or leave behind must be ≤300 lines. That's why we're splitting `AgentPerformanceTab.tsx` first.
- **Solvys design principles** (from `.claude/skills/solvys-feels/`):
  - No gradients, no shadows, no blur, no emojis in UI chrome
  - Flat OKLCH colors only
  - Monochrome canvas: BG `#050402`, Text `#f0ead6`, Accent `#c79f4a` (Solvys Gold)
  - Industrial warmth — precise, not cold
- **Electron desktop** — verify via `npx tsc --noEmit` and `rm -R dist && npx vite build`. **Do NOT** start a vite dev server. **Do NOT** use browser preview tools.
- **Never use `rm -rf`** — safety hook blocks it. Use `rm -R`.
- **T1 may not have shipped yet** — `useTradeCalendarData.ts` must gracefully handle `/api/projectx/trades` returning 404 or errors. Render an empty-state cell layout. Don't crash.
- **Match the ProjectX screenshot exactly** for `ProjectXCalendar`:
  - 7-column grid (Su–Sa), **but Sa column shows weekly total** (labeled "Week N" above $ amount + trade count)
  - Today's cell has a blue circle (#3b82f6) behind the date number + blue outline on the cell
  - Previous/next month bleed days have opacity ~0.3
  - Green cells (profit): dark green-tinted bg + bright green $ amount + dim "N trades" below
  - Red cells (loss): dark red-tinted bg + bright red $ amount + dim "N trades" below
  - Empty cells: black bg, just the date number
  - Header: "Monthly P/L: $X.XX" centered, bold, green/red based on sign
  - Month nav: `< Apr 2026 >` on left + "Today" button on right

## Implementation Steps

### 1. Split `AgentPerformanceTab.tsx` (before adding anything new)

Read the current file. Identify natural seams — likely:

- KPI cards (top row)
- Performance chart
- Trade log / details table
- Any other distinct sections

Extract each seam into its own file under `frontend/components/journal/performance-tab/`:

- `AgentPerformanceStats.tsx` (KPI cards)
- `AgentPerformanceChart.tsx`
- `AgentPerformanceTradeLog.tsx`
- etc.

Leave `AgentPerformanceTab.tsx` as a thin orchestrator (≤150 lines) that composes the sub-components and manages shared state (filters, date range).

### 2. Add the view toggle to `PerformanceJournal.tsx`

Add a segmented control at the top:

```
[ Dashboard ] [ Calendar ]
```

State: `view: "dashboard" | "calendar"`. Default `"dashboard"` (preserves current behavior — users opt into the calendar).

### 3. Build `TradingCalendar/index.tsx`

This is the shell. It manages:

- `variant: "projectx" | "solvys"` (toggle in header)
- `granularity: "day" | "week" | "month"` (pill tabs in header)
- `originFilter: "all" | "user" | "autopilot"` (Agentic/Human toggle in header)
- `selection: CalendarSelection | null` (which cell is selected)

Fetches data via `useTradeCalendarData(from, to, originFilter)`.

Renders either `<ProjectXCalendar>` or `<SolvysCalendar>` based on `variant`.

### 4. Build `ProjectXCalendar.tsx`

Match the screenshot pixel-close (see "Known Issues" above for spec). Use a CSS grid:

```css
grid-template-columns: repeat(7, 1fr);
```

Each cell renders `<CalendarCell>` with the day's data. The Saturday column cells render `<WeekTotalCell>` instead, showing the week aggregate.

Aspect ratio: each cell ~1.6:1 (wider than tall). Gridlines: 1px `rgba(255,255,255,0.08)`.

### 5. Build `SolvysCalendar.tsx`

Same data model, different aesthetic:

- BG `#050402`, border `#1a1a1a`
- Profit color: Solvys Gold `#c79f4a` (yes — accent carries "positive" in our system, not green)
- Loss color: `#b4443a` (muted rust, stays in OKLCH warm palette — NO bright red)
- Text: `#f0ead6`
- Pull tokens from `.claude/skills/solvys-feels/reference/css-tokens.md` and `solvys-gold-palette.md`
- Flat — no fills except the accent/loss band, no borders except 1px token-color gridlines

The cell content shows the **same four lines** as ProjectX:

1. Date number (top-left)
2. Net $ P&L (big, center)
3. Trade count · W/L (small, below) — e.g. `8 trades · 5W 3L`

### 6. Build `CalendarControls.tsx`

Three controls in the calendar header row:

- **View variant toggle:** `[ ProjectX ][ Solvys ]` (segmented)
- **Granularity pills:** `[ Day ][ Week ][ Month ]` — default Month. Day and Week drill in to a single day/week view.
- **Origin toggle:** `[ All ][ Human ][ Agentic ]`

### 7. Cell-click behavior

When a cell is clicked:

1. Emit `CalendarSelection` up to the parent
2. The parent (TradingCalendar/index) passes `selection` to:
   - The existing KPI cards (via context or prop — choose based on how `AgentPerformanceTab` is structured after the split) → they re-render scoped to `selection.from`–`selection.to`
   - `<EquityCurveDrawer>` — opens as a right-slide or bottom-drawer with an expanded **shadcn Line chart** of the equity curve over the selection range
3. Also exposes `selection` so T4's CatalystSlideOut can read it at unification time

**Interface contract with T4:**

```typescript
// In types.ts
export interface CalendarSelection {
  kind: "day" | "week" | "month";
  from: Date;
  to: Date;
}
```

T4 will import this type. Export it as a named export so T4 can consume.

### 8. `EquityCurveDrawer.tsx`

shadcn Line chart (use existing shadcn setup in the repo — check `frontend/components/ui/` for chart primitives). Data: running sum of `realizedPnL` across the selection range, ordered by `entryAt`. Drawer closes via X button or ESC.

### 9. `useTradeCalendarData.ts` hook

```typescript
export function useTradeCalendarData(
  from: string,
  to: string,
  origin: "all" | "user" | "autopilot",
) {
  // fetch /api/projectx/trades with try/catch
  // on error, return { trades: [], loading: false, error }
  // aggregate by day: { [isoDate]: { pnl, count, wins, losses } }
  // return { byDay, weekTotals, monthTotal, loading, error }
}
```

### 10. Optional stretch (if time permits)

- Quarterly and annual zoom-out views — same data model, different aggregation. Add `year` to the granularity pill. Not required to ship.

### 11. Changelog

Append to `src/lib/changelog.ts`:

```typescript
{
  date: "2026-04-22T<HH:MM>:00",
  agent: "T2/Wealth",
  summary: "S29-T2: Split AgentPerformanceTab, added TradingCalendar (ProjectX + Solvys views), Agentic/Human toggle, equity curve drawer",
  files: [
    "frontend/components/journal/AgentPerformanceTab.tsx",
    "frontend/components/journal/PerformanceJournal.tsx",
    "frontend/components/journal/performance-tab/*",
    "frontend/components/journal/TradingCalendar/*",
  ],
},
```

## Acceptance Criteria

- [ ] `AgentPerformanceTab.tsx` ≤ 150 lines after split
- [ ] Every file in `frontend/components/journal/performance-tab/` and `TradingCalendar/` ≤ 300 lines
- [ ] Segmented control on Performance tab toggles between Dashboard and Calendar
- [ ] ProjectX view matches the screenshot visually (weekday header, weekly-total right column, green/red cells, today indicator, faded bleed days)
- [ ] Solvys view uses Solvys Gold for profit, no bright red for loss, flat, no gradients/shadows/blur
- [ ] Agentic/Human toggle changes the displayed cells (filters by `origin`)
- [ ] Day/Week/Month granularity pills switch aggregation
- [ ] Clicking a cell opens the equity curve drawer AND re-filters the KPI cards
- [ ] `CalendarSelection` type is exported for T4
- [ ] Graceful empty state when backend returns no trades or 404
- [ ] `npx tsc --noEmit --project frontend/tsconfig.json` clean
- [ ] `rm -R dist && npx vite build` completes
- [ ] No browser preview tools used; verified by rebuilding DMG and opening the app

## Validation Commands

```bash
cd /Users/freethefranks/Documents/Fintheon/frontend
npm install --legacy-peer-deps
npx tsc --noEmit
rm -R dist
npx vite build

# Rebuild + relaunch to eyeball
cd /Users/freethefranks/Documents/Fintheon
npx electron-builder --mac dmg
cd /Applications && rm -R Fintheon.app 2>/dev/null
cp -R /Users/freethefranks/Documents/Fintheon/desktop-dist/mac-arm64/Fintheon.app /Applications/
open /Applications/Fintheon.app
```

## Commit Format

```
[T2] refactor: split AgentPerformanceTab into sub-components
[T2] feat: add TradingCalendar with ProjectX and Solvys views
[T2] feat: add Agentic/Human toggle and granularity pills
[T2] feat: equity curve drawer on cell click
```

No version stamps on branch commits. Final unification will tag `v.5.22.9W`.
