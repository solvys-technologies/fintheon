# S9-T3: Dashboard Redesign + NarrativeMap Fix + Econ Intelligence + Sanctum Cleanup

**Sprint**: S9 — Fix Everything Right
**Track**: T3 (after T1 completes, parallel with T2/T4)
**Branch**: `v.8.28.1`

## Context
Dashboard needs a side-by-side layout (Brief left, Calendar right) with a needle divider. NarrativeMap (renamed from NarrativeFlow) crashes with "hub-Sector Rotation" error. Only ~100 catalyst cards load despite 640+ items in the backend DB. Econ Intelligence section is stuck on "Fetching economic data..." with no fallback. IV Risk Bars on Sanctum Page 0 still render and need to be deleted. Content area has padding between sidebar and main content.

**IMPORTANT**: T1 renamed components. Use NEW names:
- `ExecutiveDashboard` → `MainDashboard` (file: `executive/MainDashboard.tsx`)
- `NarrativeFlow` → `NarrativeMap` (file: `narrative/NarrativeMap.tsx`)
- Tab IDs: `executive` → `dashboard`, `news` → `riskflow`

## Design Direction
- Solvys Gold palette: BG #050402, Accent #c79f4a, Text #f0ead6
- No gradients, no colored emojis
- Dashboard: one subtle round border, vertical needle divider
- Content fills edge-to-edge between sidebar and panels

---

## FILES TO READ FIRST
- `frontend/components/executive/MainDashboard.tsx` (renamed, 466 lines) — current dashboard layout
- `frontend/components/layout/MainLayout.tsx` (907 lines) — content area, padding
- `frontend/components/narrative/NarrativeForceCanvas.tsx` (778 lines) — force canvas, safeSlug fix, node creation
- `frontend/components/narrative/NarrativeMap.tsx` (renamed, 181 lines) — wrapper component
- `frontend/lib/narrative-seed-loader.ts` — seed loading, localStorage version flag
- `frontend/data/narrative-seed-events.json` — seed event data
- `frontend/components/narrative/SanctumChart.tsx` (493 lines) — IV bars canvas, drawBars()
- `frontend/components/narrative/SanctumEconIntel.tsx` (695 lines) — econ cards, FRED fetch
- `backend-hono/src/services/supabase-service.ts` — readEconHistory(), ECON_KEYWORD_MAP

---

## FIXES

### 1. Dashboard Side-by-Side Layout (MainDashboard.tsx)

Replace the current Page 0 layout with a side-by-side container:

```tsx
{/* Main content — Brief left, Calendar right */}
<div className="flex-1 min-h-0 flex">
  {/* One subtle rounded container */}
  <div className="flex-1 flex border border-[var(--fintheon-accent)]/12 rounded-xl overflow-hidden mx-1 my-1">
    {/* Left: Morning Daily Brief (55%) */}
    <div className="flex-[55] min-w-0 overflow-y-auto p-4">
      {/* MDB Brief content here */}
    </div>

    {/* Needle divider — fades at top/bottom 25% */}
    <div className="w-px relative shrink-0">
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(
            to bottom,
            transparent 0%,
            var(--fintheon-accent) 25%,
            var(--fintheon-accent) 75%,
            transparent 100%
          )`,
          opacity: 0.15,
        }}
      />
    </div>

    {/* Right: Econ Calendar (45%) */}
    <div className="flex-[45] min-w-0 overflow-y-auto p-4">
      {/* Econ calendar content here */}
    </div>
  </div>
</div>
```

The needle divider: 1px wide, `var(--fintheon-accent)` at 15% opacity, fades to transparent at top and bottom 25% — looks like a thin needle or pin.

### 2. Kill Horizontal Padding (MainLayout.tsx)

Check the content area at line ~723:
```tsx
<div className="flex-1 overflow-hidden relative min-w-0 flex flex-col">
```

And the inner content wrapper at line ~741:
```tsx
<div className={`h-full relative flex-1 flex flex-col ${topStepXEnabled ? 'pointer-events-none' : ''}`}>
```

Kill any `px-*`, `pl-*`, `pr-*`, `mx-*`, `ml-*`, `mr-*`, `gap-*` between the NavSidebar div and the content div. Content should fill edge-to-edge.

Also check if MainDashboard.tsx itself has outer padding (`px-2.5` found at line 236) — reduce or remove so content fills the container.

### 3. Fix NarrativeMap Crash (NarrativeForceCanvas.tsx)

The `safeSlug()` function was already added (lines 62-71) to prevent the "hub-Sector Rotation" crash. Verify it works:

```bash
grep -n "safeSlug" frontend/components/narrative/NarrativeForceCanvas.tsx
```

Should show usage at lines 273 and 287 (in `buildSimData()`). If the canvas STILL crashes:
- Check if any catalyst cards have `narrative: undefined` or `narrative: null` — safeSlug handles this with fallback to 'rate-cut-cycle'
- Check if `NARRATIVE_THREADS` has all 10 threads defined
- Check if `HUB_POSITIONS` has positions for all 10 thread slugs
- Check for any other place where `hub-${thread}` is constructed WITHOUT using `safeSlug`

### 4. Populate NarrativeMap with 640+ Items

Currently only ~100 catalyst cards load via seed events. The backend has 640+ scored items. Wire the backend feed to auto-import as catalyst cards on init.

In `NarrativeMap.tsx` (renamed from NarrativeFlow.tsx), the auto-import currently only imports HIGH/CRITICAL severity RiskFlow alerts (lines 46-57):
```typescript
const highAlerts = alerts.filter(a => a.severity === 'high' || a.severity === 'critical');
```

**Fix**: Import ALL alerts, not just high severity:
```typescript
// Import ALL RiskFlow items as catalyst cards (not just high/critical)
useEffect(() => {
  if (alerts.length === 0) return;
  const existingRfIds = new Set(
    state.catalysts.filter(c => c.riskflowItemId).map(c => c.riskflowItemId!)
  );
  const imported = importRiskFlowItems(alerts, existingRfIds);
  if (imported.length > 0) {
    dispatch({ type: 'BULK_ADD_CATALYSTS', catalysts: imported });
  }
}, [alerts, state.catalysts, dispatch]);
```

Remove the `highAlerts` filter. All 50+ items from RiskFlowContext should become catalyst cards.

Also check `frontend/lib/narrative-seed-loader.ts`:
- What seed version flag is it using? Should be `v8` or higher
- How many seed events does the JSON file have?
- Verify `loadSeedEvents()` actually runs by checking the localStorage flag

### 5. Fix Econ Intelligence (SanctumEconIntel.tsx)

The component fetches from `/api/data/econ-history/{ticker}` but cards show "Fetching economic data..." indefinitely.

**Debug steps**:
1. Start backend: `cd backend-hono && bun run dev`
2. Test endpoint: `curl localhost:8080/api/data/econ-history/CPI?limit=5`
3. If empty: the `ECON_KEYWORD_MAP` patterns in `backend-hono/src/services/supabase-service.ts` don't match actual headlines in `scored_riskflow_items`

**Frontend fix in SanctumEconIntel.tsx**:
- Add error handling + timeout (5s) for each card fetch
- If fetch fails or returns empty: show "No data available" instead of infinite loading
- Add a retry button

```tsx
// Add timeout to fetch
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 5000);
try {
  const res = await fetch(`${API}/api/data/econ-history/${ticker}?limit=5`, { signal: controller.signal });
  // ... process response
} catch (err) {
  setError('No data available');
} finally {
  clearTimeout(timeout);
  setLoading(false);
}
```

### 6. Remove IV Risk Bars from Sanctum Page 0 (SanctumChart.tsx)

In `SanctumChart.tsx`:
1. Find the `CATS` array (line ~42) — DELETE it
2. Find `drawBars()` function (line ~70) — DELETE the entire function
3. Find the `<canvas>` element that renders IV bars (line ~487-490) — DELETE it
4. Find any call to `drawBars()` (line ~442) — DELETE the call
5. Keep the TradingView chart and projection overlay — only remove the colored IV bars

---

## VERIFICATION

```bash
# 1. Build passes
npx vite build

# 2. No IV bars canvas
grep -n "drawBars\|CATS.*MiroShark" frontend/components/narrative/SanctumChart.tsx
# Should return 0 results

# 3. safeSlug is in use
grep -c "safeSlug" frontend/components/narrative/NarrativeForceCanvas.tsx
# Should return 3+

# 4. No stale highAlerts filter in NarrativeMap
grep -n "highAlerts" frontend/components/narrative/NarrativeMap.tsx
# Should return 0 results

# 5. Dashboard has needle divider
grep -n "needle\|linear-gradient.*transparent.*accent.*transparent" frontend/components/executive/MainDashboard.tsx
# Should return 1+ result
```

## Changelog Entry
```typescript
{ date: '2026-03-30T00:30:00', agent: 'claude-code', summary: 'S9-T3: Dashboard side-by-side with needle divider, kill content padding, fix NarrativeMap crash + populate 640+ items, fix Econ Intelligence loading, remove IV bars from Sanctum', files: ['frontend/components/executive/MainDashboard.tsx', 'frontend/components/layout/MainLayout.tsx', 'frontend/components/narrative/NarrativeForceCanvas.tsx', 'frontend/components/narrative/NarrativeMap.tsx', 'frontend/components/narrative/SanctumChart.tsx', 'frontend/components/narrative/SanctumEconIntel.tsx'] }
```

## DO NOT
- Do NOT rename components (T1 did that)
- Do NOT modify RiskFlowContext (T2 owns that)
- Do NOT modify chat interfaces (T4 owns that)
- Do NOT modify IV scoring logic (T2 owns that)
- Do NOT modify the TradingView chart integration — only remove the IV bars overlay
- Do NOT touch RiskFlowMini or RiskFlowMain (T2 owns indicators)
