# Sprint Brief: T2 — Desk Plan UI: Multi-Window + Lockout Button + Price Gating

## Context

The Desk Plan is displayed as a single card on desktop (`DayCard.tsx`) and mobile (`MobileDeskPlan.tsx`). Starting with sprint S64, the system generates multiple trading windows per day. The UI needs chevron navigation to cycle between windows, a lockout button integrated into the streak control row, and price data hidden on each card until 15 minutes before that window's start time. The lockout feature was shipped in S63 — this track places the lockout button in its new location and reads existing lockout state.

**Design rules — Solvys banned ornaments (NO GRADIENTS, NO EMOJIS, NO KANBAN BORDERS, NO AI SPARKLES, NO GENERIC SHADOWS).** Use Solvys Gold accent (#c79f4a), warm near-black (#050402), frosted-glass surfaces where separation is needed.

## Branch Target

`sprint/S64`

## Scope — Included

- [ ] `frontend/components/narrative/DayCard.tsx` — Add chevron navigation for multiple trading windows, price hiding until 15min pre-window, lockout button placement
- [ ] `frontend/components/narrative/DayPlanChevronNav.tsx` [NEW] — Chevron arrows component for cycling windows (left/right arrows, window counter indicator)
- [ ] `frontend/components/narrative/PriceRevealTag.tsx` [NEW] — Small countdown/status badge that shows "HIDDEN" or "reveals in Xm" until 15min before window
- [ ] `frontend/components/layout/TopHeader.tsx` — Position lockout button next to streak line area (left of chevrons, same row, right-justified on streak text)
- [ ] `mobile/components/home/MobileDeskPlan.tsx` — Add dot-indicator navigation for multi-window (dot pagination instead of arrows), price hiding, lockout state awareness

## Scope — Excluded (DO NOT TOUCH)

- Lockout service or hook internals (`lockout.ts`, `useLockout.ts`, lockout routes) — handled by T3
- Backend day-plan services or routes — handled by T1
- Agent instruction files — handled by T4
- Any RiskFlow files — off-limits per sprint constraint

## Reuse Inventory (existing code to call, not reinvent)

- `useLockout()` at `frontend/hooks/useLockout.ts` — returns `{ state, loading, lock, unlock, refresh }`; import and call `lock()`/`unlock()` from DayCard; DO NOT modify this hook (T3 owns it)
- `DayCard` existing structure at `frontend/components/narrative/DayCard.tsx` — current card layout, streak display element, price display
- `MobileDeskPlan` existing structure at `mobile/components/home/MobileDeskPlan.tsx` — current mobile layout
- API endpoint `GET /api/day-plan/today` — returns current day's plan with windows array; the response shape includes `windows[]` with `startTime`, `endTime`, `prices`, `entry`, `target`, `invalidation`

## Known Issues to Preserve

- The streak counter is an existing element in DayCard — the chevron arrows and lockout button go on the same row, right-justified relative to the streak text
- Lockout button should call existing `useLockout().lock(30)` / `useLockout().unlock()` — T3 will add enhanced behavior later; for now the button just toggles the existing S63 lockout
- Price data on cards: the window's `startTime` is compared to `Date.now()`. If `startTime - 15min > now`, show "PRICE HIDDEN" or a countdown. If within 15min or past, show prices normally.

## Implementation Steps

1. **DayPlanChevronNav.tsx [NEW]**: A small row component with left arrow, window counter ("1/3"), right arrow. Props: `currentIndex: number`, `totalWindows: number`, `onPrev: () => void`, `onNext: () => void`. Style: Solvys Gold arrows, narrow sizing to fit on streak row.
2. **PriceRevealTag.tsx [NEW]**: Receives `windowStartTime: string` (ISO). Compares to `Date.now()` every 10s. If > 15min away, shows "HIDDEN" with a small lock icon (NO emoji — use SVG or text). If within 15min, shows countdown "Reveals in Xm". After start, renders nothing (prices visible normally).
3. **DayCard.tsx modifications**:
   - Add state `currentWindowIndex` (0-based)
   - Fetch `/api/day-plan/today` and parse `windows[]` array
   - Display the current window's data
   - Import `DayPlanChevronNav` and place it on the streak line row, right-justified
   - Import lockout hook: `const { state, lock, unlock } = useLockout()`
   - Add lockout button on the same row, LEFT of the chevrons. A small pill button. Label: `state.locked ? "UNLOCK" : "LOCK"`
   - Wrap price-related elements in `PriceRevealTag` logic — only show prices when current window is within 15min
4. **TopHeader.tsx** (optional — check if DayCard already renders in its own container; if lockout button should be in header, place it there; otherwise keep it in DayCard). Based on the user's description ("lockout button sits on same row as chevrons on the streak line"), the button lives in DayCard, not the header. Skip TopHeader.tsx unless instructed otherwise.
5. **MobileDeskPlan.tsx modifications**:
   - Add state `currentWindowIndex`
   - Replace single-window display with dot-indicator navigation
   - Add price hiding logic (same as DayCard)
   - Add lockout state awareness (show lockout status badge)

## Acceptance Criteria

- [ ] Chevron arrows navigate forward/backward through multiple trading windows
- [ ] Window counter shows e.g. "1/3" for 3 windows
- [ ] Lockout button renders on the same row as the streak counter, left of the chevrons
- [ ] Lockout button calls existing `lock()`/`unlock()` from `useLockout`
- [ ] Prices are hidden on cards until 15 minutes before the window start time
- [ ] Countdown shows "Reveals in Xm" when within 15 minutes
- [ ] Mobile dot-indicator navigation works for multi-window views
- [ ] Entire UI obeys Solvys design rules (no gradients, no emojis, no Kanban borders, no AI sparkles)

## Validation Commands

```bash
# Frontend type-check
npx tsc --noEmit --project frontend/tsconfig.json

# Clean build
rm -rf dist && npx vite build

# Mobile type-check (if separate tsconfig)
cd mobile && npx tsc --noEmit 2>/dev/null || true
```

## Commit Format

```
[v.6.13.1] feat: T2 multi-window DayCard + lockout button + price gating
```
