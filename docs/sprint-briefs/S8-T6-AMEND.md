# S8-T6 AMENDMENT: RiskFlow + Timeline Polish

**Branch**: `v.8.28.1`
**Context**: T6 is 70% done. Infinite scroll and toasts work. Polish items remain.

## FILES TO READ
- `frontend/components/RiskFlowPanel.tsx` (~line 603-640) — header area
- `frontend/components/ui/AutoRefreshToggle.tsx` — toggle component
- `frontend/components/feed/NewsSection.tsx` — full-page RiskFlow feed

## GAPS

### 1. Auto Polling Description (PARTIAL)
Current: "Auto 30s" label with `hidden xl:inline` next to the toggle.
Brief says: "Automatically refreshes every 30 seconds" as descriptive text.

Fix in `RiskFlowPanel.tsx`:
- Change "Auto 30s" to a tooltip on the AutoRefreshToggle: `title="Automatically refreshes every 30 seconds"`
- In the expanded filter area (when panel is open), add a small description line: `<span className="text-[8px] text-zinc-600">Auto-refresh: polls sources every 30s</span>`
- In NewsSection.tsx (full feed view), add the same description near the toggle

### 2. RiskFlow Indicator Title (PARTIAL)
Current header layout: `[Zap] RiskFlow [badge] [X dot]`
Brief says: Add "RiskFlow" title text specifically to the LEFT of the X indicator.

The title IS already left of the X dot — this is already correct. But verify in NewsSection.tsx too — the full feed view should also show "RiskFlow" title with the X status dot.

Check `NewsSection.tsx` — does it have the same header pattern? If not, make them consistent.

## VERIFICATION
1. Hover AutoRefreshToggle → tooltip shows "Automatically refreshes every 30 seconds"
2. Expanded RiskFlow panel → description text visible
3. Full feed (NewsSection) → same header pattern as sidebar RiskFlow
4. `npx vite build` — clean

## DO NOT
- Do NOT modify infinite scroll logic (it works)
- Do NOT modify toast notifications (they work)
- Do NOT touch backend
