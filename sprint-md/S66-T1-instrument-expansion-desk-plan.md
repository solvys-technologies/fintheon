# Sprint Brief: T1 — Instrument Expansion + Desk Plan Multi-Week + Pre-Session Pricing

## Context

The agentic layer must present multiple trading plans at all times — cycling through weeks of Desk Plans ahead (determined by TWT), with each day having its own plan. If multiple plans exist for a single day, all must appear in the cycle. Every instrument needs database analysis via TV RSS, with IV scoring tailored per instrument and persisted globally across web, mobile, and desktop.

## Branch Target

`sprint/S66`

## Scope — Included

### Backend: Instrument Expansion
- [ ] `backend-hono/src/services/iv-scoring/instrument.ts:30-178` — Add missing instruments to INSTRUMENT_BETAS: `/ZT` (2-Year Treasury, beta -0.2, fallbackPrice 108), crypto basket: `/BTC` (BTC futures, beta 0.15, fallbackPrice 95000), `/ETH` (ETH futures, beta 0.18, fallbackPrice 3500). Currencies basket: `/6A` (AUD, beta 0.2), `/6C` (CAD, beta 0.25), `/6S` (CHF, beta 0.15). Also add `/ZN` (already exists, check it).
- [ ] `backend-hono/src/services/day-plan/tv-bars-fetcher.ts:29-50` — Expand SYMBOL_MAP for all new instruments. Add scanner mappings: ZT (CBOT:ZT1!), BTC (COINBASE:BTCUSD), ETH (COINBASE:ETHUSD), 6A (CME:6A1!), 6C (CME:6C1!), 6S (CME:6S1!). For crypto, use `market: "crypto"` if scanner supports it, else fall back to quotes().
- [ ] `backend-hono/src/services/iv-scoring/computation.ts` — Update scoring computation to accept instrument parameter. Adjust beta weight per instrument in the blended score. The instrument param should flow from `selectedSymbol.symbol` in the frontend through the API route to the computation layer.
- [ ] `backend-hono/src/services/iv-scoring/ticker.ts` — Update ticker utilities to support per-instrument tick values and sizes from INSTRUMENT_BETAS.
- [ ] `backend-hono/src/services/iv-scoring/config.ts` — Add per-instrument configuration overrides (if needed).
- [ ] `backend-hono/src/routes/market-data/iv-score/*` — Ensure IV score routes pass instrument param. The existing `/api/market-data/iv-score` endpoint already accepts `symbol` — verify it reaches the computation layer.
- [ ] `backend-hono/src/services/riskflow/central-scorer.ts` — RiskFlow IV scoring must use the per-instrument IV score. Pass instrument context through the scoring pipeline.
- [ ] `backend-hono/src/routes/market-data/risk-signals` and related — Ensure market heat feature uses per-instrument data for stronger signals.
- [ ] `backend-hono/migrations/043_instrument_preferences.sql` **[NEW file]** — Create table `user_instrument_preferences` with columns: `user_id uuid references auth.users`, `selected_instrument text not null default '/NQ'`, `updated_at timestamptz default now()`. RLS policy for user-level read/write.

### Backend: Multi-Week Desk Plan
- [ ] `backend-hono/src/services/day-plan/window-scheduler.ts:202-229` — `planWeek()` currently generates 5 weekdays from reference. Extend `planWeeks(ref: Date, weekCount: number): PlannedDay[][]` that returns an array of week arrays. The TWT (Trading Week Template) determines the trading days pattern. Each week gets its own `PlannedDay[]`. If `triggerWeekPlan` is called for multiple weeks, generate plans for each week.
- [ ] `backend-hono/src/services/day-plan/window-scheduler.ts` — Handle multiple plans per day: if econ events for a day include both morning and afternoon windows (different categories), generate separate `PlannedDay` entries (same date, different window times). The `buildPlannedDay` function already supports `windows[]` array — ensure each distinct event category window produces a separate entry in the multi-plan array.
- [ ] `backend-hono/src/services/desk-planner.ts:113-158` — `triggerWeekPlan()` currently generates 1 week. Extend to accept optional `{ weekCount?: number }` parameter (default 4 weeks ahead). Each week calls `planWeek()` with the appropriate reference date. Store all generated plans in Supabase via `generateDayPlan()`.
- [ ] `backend-hono/src/services/day-plan/day-plan-service.ts:57-213` — `generateDayPlan()` uses `planDay()` which gets one `PlannedDay`. For multi-plan-per-day, the method should generate a plan for EACH window in the PlannedDay. If planned.windows.length > 1, generate separate day plans (differentiated by `windowLabel` or stored as separate rows with a `plan_variant` discriminator field).
- [ ] `backend-hono/src/routes/day-plan/handlers.ts` — Add `GET /api/day-plan/multi-week` endpoint. Parameters: `from` (ISO date), `to` (ISO date), `instrument` (optional). Returns `{ weeks: DayPlan[][] }` — nested array where each inner array is one week of day plans. Each day may have multiple plans if variants exist.
- [ ] `backend-hono/src/routes/day-plan/index.ts` — Register the multi-week route.
- [ ] `backend-hono/src/types/day-plan.ts` — Add `planVariant?: string` field to `DayPlan` type for differentiating multiple plans on the same date.

### Backend: Pre-Session Pricing
- [ ] `backend-hono/src/services/day-plan/window-scheduler.ts` — In `planWeek()` or `triggerWeekPlan()`, add logic to trigger price fetching 30 minutes before each window's start time. Use `refreshPricesFromTV()` from `instrument.ts` which already fetches live quotes.
- [ ] `backend-hono/src/services/day-plan/day-plan-service.ts:93-109` — The existing price fetch (`refreshPricesFromTV()`, `fetchInstrumentBars()`) happens during plan generation. For pre-session pricing, add a cron or scheduled job that fetches prices 30min before window start. Use `node-cron` similar to `startDeskPlanCron()`. Store prices in `day_plan_windows` table (add `session_price` column).
- [ ] `backend-hono/migrations/044_session_prices.sql` **[NEW file]** — Add `session_price numeric` column to `day_plan_windows` table. Store the pre-session price fetched 30min before window start.
- [ ] **Fix the pricing bug**: Today, prices never showed up during active Desk Plan sessions. Root cause: `PriceRevealTag` gates price visibility to 15min before window, but the prices themselves may not be populated. Ensure `day_plan_windows.prices_of_interest` is populated during `generateDayPlan()` (it already is via `roundPricesOfInterest()`) AND that the frontend reads it correctly.

### Frontend: Desk Plan Multi-Week
- [ ] `frontend/components/narrative/DayCard.tsx:160-275` — Replace `WindowControlRow` label "Day of week" with "Trading Window" showing the window time right-aligned. Update the `getDayPlanHeading()` call to use window time format.
- [ ] `frontend/components/narrative/DayCard.tsx:327-402` — `WindowControlRow` currently shows label + dotted leader + value + chevrons. Change label from date/day to "Trading Window" + window time on the right. The chevrons cycle through multi-week plans (not just windows within a day).
- [ ] `frontend/components/narrative/DayCard.tsx` — **Top row lock button**: At the very top of the Desk Plan widget (header row), add a lock/unlock button. No background color, just `border border-[var(--fintheon-accent)]/30` + lock/unlock icon. Use Nothing display font styling (`fontFamily: "var(--font-data)"`). Text reads "LOCK" or "UNLOCK" next to the icon. Add CSS class `desk-plan-lock-btn` for T3's shimmer animation target. Wire to `useLockout()` hook toggle.
- [ ] `frontend/components/narrative/DayPlanChevronNav.tsx` — Extend from window-level cycling to week-level cycling. Accept `currentPlanIndex: number`, `totalPlans: number` (across all weeks). The chevrons advance through all plans in sequence: Monday Week1, Tuesday Week1, ..., Friday Week4 (or however many weeks). When multiple plans exist for the same date, include both in the sequence.
- [ ] `frontend/hooks/useDayPlan.ts` — Update to fetch from `/api/day-plan/today` and also poll `/api/day-plan/multi-week` for the cycling data.
- [ ] `frontend/hooks/useDayPlanWeek.ts` — Update to use multi-week endpoint. Return `{ weeks, currentPlanIndex, totalPlans, goNext, goPrev, currentPlan }`.

### Frontend: Settings
- [ ] `frontend/contexts/SettingsContext.tsx` — Add `selectedInstrument: string` field (default `'/NQ'`). Add setter. Read from localStorage key `fintheon:selected-instrument` on init, fall back to API call to `user_instrument_preferences`. On change, persist to localStorage AND POST to backend to save.
- [ ] `frontend/components/settings/TradingTab.tsx` — Add instrument selector dropdown. List all supported instruments from INSTRUMENT_BETAS (grouped: Equity Index Futures, Commodities, Bonds, Crypto, Currencies). Current selection highlighted. Search/filter optional.
- [ ] `frontend/components/settings/TradingTab.tsx` — Check for any existing instrument list in Profile tab or General settings. If present, remove instrument selection from there and consolidate into Trading tab.
- [ ] `frontend/types/market-data.ts` — Ensure `IVScoreResponse.instrument` field exists and is populated by the backend.

### Frontend: Arbitrum Instrument Dropdown
- [ ] `frontend/components/arbitrum/ArbitrumChamber.tsx:258-277` — Add instrument dropdown in the Arbritrum header row (alongside "Arbitrum Chamber" label). The dropdown lists all supported instruments. Changing instrument reloads the chamber's latest verdict for that instrument.
- [ ] `frontend/components/arbitrum/ArbitrumSettingsPanel.tsx` — Add instrument selection in settings if not handled by chamber header.
- [ ] `frontend/hooks/useArbitrumLatest.ts` — Accept optional instrument parameter. Pass to backend when fetching latest verdict.

### Mobile
- [ ] `mobile/components/settings/SettingsPage.tsx` — Add instrument selector matching desktop Trading tab.
- [ ] `mobile/contexts/SettingsContext.tsx` — Add `selectedInstrument` field (mirror desktop).
- [ ] `mobile/components/home/MobileDeskPlan.tsx` — Update to show multi-week cycling (simplified mobile view).

## Scope — Excluded (DO NOT TOUCH)

- `electron/main.cjs` — T2 owns all Electron changes
- `electron/preload.cjs` — T2 owns
- `frontend/components/LockScreen.tsx` — T2 owns (NEW file, T2 creates)
- `frontend/components/layout/TopHeader.tsx` — T3 owns toolbar overhaul
- `frontend/components/layout/NavSidebar.tsx` — T3 owns pill bar changes
- `frontend/components/IVScoreCard.tsx` — T3 owns sizing reference but T1 can read it
- `frontend/components/chat/` — T4 owns all chat changes
- `frontend/components/settings/BlockerTab.tsx` — T2 owns lockout settings
- `src/lib/changelog.ts` — T5 owns

## Reuse Inventory

- `calculateImpliedPoints()` at `backend-hono/src/services/iv-scoring/instrument.ts:264` — Rule-of-16 implied points. T1 adds per-instrument beta weighting.
- `refreshPricesFromTV()` at `backend-hono/src/services/iv-scoring/instrument.ts:191` — Live TV price cache refresh. T1 uses this for pre-session pricing.
- `fetchTvQuotes()` at `backend-hono/src/services/day-plan/tv-bars-fetcher.ts:133` — Scanner quote fetcher. T1 extends SYMBOL_MAP to call this for new instruments.
- `planWeek()` at `backend-hono/src/services/day-plan/window-scheduler.ts:205` — Weekly plan generation. T1 extends to multi-week.
- `generateDayPlan()` at `backend-hono/src/services/day-plan/day-plan-service.ts:57` — Plan generation. T1 ensures pricing fills correctly.
- `useLockout()` at `frontend/hooks/useLockout.ts` — Lockout toggle hook. T1 uses for DayCard lock button.
- `DayPlanChevronNav` at `frontend/components/narrative/DayPlanChevronNav.tsx` — Existing chevron nav. T1 extends for multi-week.
- `useArbitrumLatest` at `frontend/hooks/useArbitrumLatest.ts` — Arbitrum data hook. T1 adds instrument param.
- `FadingRuler` at `frontend/components/shared/FadingRuler.tsx` — Divider component. T1 may use for DayCard sections.

## Known Issues to Preserve

- S65 just touched `DayCard.tsx`, `DayPlanChevronNav.tsx`, `settings/BlockerTab.tsx`, `settings/TradingTab.tsx`, `useLockout.ts`. Preserve the S65 intent — these were "Settings platform defaults and lockout policy" changes.
- S64 touched `instrument.ts` (removed hardcoded currentPrice, added fallbackPrice + live cache). Preserve that architecture.
- The `onConflict: "team_id,date"` upsert in `persistDayPlan()` means only one plan per team per date. For multi-plan-per-day, either add a discriminator or store variants in a separate table.
- `triggerWeekPlan()` already has an idempotency check (`readDayPlan` before `generateDayPlan`). Multi-plan must respect this.
- The `TOOLBAR_PILL_CLASS` const in `TopHeader.tsx:78-79` is `h-8` — T3 will use this as the reference height. T1 should not change it.

## Implementation Steps

1. **Add new instruments to INSTRUMENT_BETAS** (`instrument.ts:30-178`). Insert `/ZT`, `/BTC`, `/ETH`, `/6A`, `/6C`, `/6S` entries. Verify existing `/ZN` is present.
2. **Expand SYMBOL_MAP** (`tv-bars-fetcher.ts:29-50`). Add scanner+UDF mappings for all new instruments.
3. **Create migration 043** for `user_instrument_preferences` table with RLS.
4. **Wire per-instrument IV** in `computation.ts` and `config.ts`. Pass `instrument` through to `calculateImpliedPoints()`.
5. **Extend planWeek to planWeeks** (`window-scheduler.ts:202`). Support `weekCount` parameter.
6. **Multiple plans per day**: In `buildPlannedDay()`, if `windows.length > 0`, create a separate PlannedDay entry for each distinct category window. Currently `categoriesSeen` set prevents duplicates — remove that constraint and let each window become its own plan.
7. **Extend triggerWeekPlan** (`desk-planner.ts:113`) to accept `weekCount`. Generate and persist plans for each day in each week.
8. **Multi-week API endpoint** (`day-plan/handlers.ts`). `GET /multi-week?from=2026-05-14&to=2026-06-14&instrument=/NQ` returns `{ weeks: DayPlan[][] }`.
9. **Pre-session pricing**: Add `session_price` column (migration 044). Add cron in `desk-planner.ts` that fires 30min before each window start, calls `refreshPricesFromTV()`, and updates `day_plan_windows.session_price`.
10. **Fix pricing bug**: Verify `pricesOfInterest` array is populated in `generateDayPlan()` (it already computes `roundPricesOfInterest`). Check that `PriceRevealTag.tsx` gating threshold is correct (15min before window).
11. **DayCard "Trading Window" label**: Change `WindowControlRow` label from `getDayPlanHeading(plan?.date)` to `"Trading Window"` with window time (`window.startTime - window.endTime`) right-aligned.
12. **DayCard top row lock button**: Add button with CSS class `desk-plan-lock-btn`, no bg, border only, Nothing font, `Lock`/`LockOpen` icon. Wire to `useLockout()`.
13. **DayPlanChevronNav multi-week**: Change props and behavior from window-level to plan-level cycling. Load from multi-week API.
14. **useDayPlanWeek hook**: Update to call `/multi-week` endpoint. Return all plans across weeks. Expose cycling state.
15. **SettingsContext instrument**: Add `selectedInstrument` field, localStorage + API persistence.
16. **TradingTab instrument dropdown**: Add grouped dropdown. Remove from Profile tab if present.
17. **Arbitrum instrument dropdown**: Add to chamber header. Pass to `useArbitrumLatest`.
18. **Mobile**: Mirror instrument selector in SettingsPage. Update MobileDeskPlan for multi-week.

## Acceptance Criteria

- [ ] All instruments (NQ, ES, YM, GC, CL, SIL, ZB, ZT, ZN, BTC/ETH, 6A/6C/6S/6J/6E/6B) are in INSTRUMENT_BETAS with correct beta/tick/size
- [ ] All instruments have SYMBOL_MAP entries for TV scanner
- [ ] User can select instrument in Trading Settings dropdown (web + mobile)
- [ ] IV score is tailored per selected instrument — VIX-based implied points use the correct beta
- [ ] Changing instrument applies globally (web, mobile, desktop) — selection persists
- [ ] `GET /api/day-plan/multi-week` returns multi-week plan data
- [ ] Desk Plan chevron navigation cycles through weeks, not just windows
- [ ] Multiple plans for same day appear in the cycle
- [ ] DayCard shows "Trading Window" with time instead of day of week
- [ ] DayCard top row has lock button (border-only, Nothing font, functional)
- [ ] Prices are populated in Desk Plan before session starts (30min pre-session)
- [ ] Market heat is stronger with per-instrument data
- [ ] Arbitrum instrument dropdown loads analysis for selected instrument
- [ ] `npx tsc --noEmit` passes on frontend and mobile
- [ ] `vite build` passes on frontend and mobile (rm -rf dist first)
- [ ] `bun run build` passes on backend

## Validation Commands

```bash
npx tsc --noEmit --project frontend/tsconfig.json
rm -rf dist && npx vite build
```

```bash
cd backend-hono && bun run build
```

```bash
cd mobile && npx tsc --noEmit && rm -rf dist && npx vite build
```

```bash
curl -s http://localhost:8080/api/day-plan/multi-week | head -c 500
```

## Commit Format

```
[v6.2.0] feat: T1 instrument expansion + desk plan multi-week + pre-session pricing
```
